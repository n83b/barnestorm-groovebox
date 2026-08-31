import { validatePackManifest } from "./sequencer.mjs?v=dev";

const DATABASE_NAME = "barnestorm-groovebox-packs";
const DATABASE_VERSION = 1;
const PACK_STORE = "packs";
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export function validatePackPointer(pointer, baseUrl = globalThis.location?.href ?? "http://localhost/") {
  if (!pointer || typeof pointer !== "object") {
    throw new TypeError("The current pack pointer must be an object.");
  }
  if (pointer.schemaVersion !== 1) {
    throw new TypeError("The current pack pointer has an unsupported schema version.");
  }
  if (typeof pointer.packId !== "string" || pointer.packId.length === 0) {
    throw new TypeError("The current pack pointer must include a pack id.");
  }
  if (typeof pointer.manifestUrl !== "string" || pointer.manifestUrl.length === 0) {
    throw new TypeError("The current pack pointer must include a manifest URL.");
  }

  const releasedAt = parseTimestamp(pointer.releasedAt, "release");
  const expiresAt = parseTimestamp(pointer.expiresAt, "expiry");
  if (expiresAt <= releasedAt) {
    throw new TypeError("The current pack expiry must be after its release.");
  }

  return {
    schemaVersion: 1,
    packId: pointer.packId,
    manifestUrl: new URL(pointer.manifestUrl, baseUrl).href,
    releasedAt: new Date(releasedAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString()
  };
}

export function getDaysRemaining(expiresAt, now = new Date()) {
  const expiry = Date.parse(expiresAt);
  const current = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(expiry) || !Number.isFinite(current)) return null;
  return Math.max(0, Math.ceil((expiry - current) / 86_400_000));
}

export async function sha256Hex(data, subtle = globalThis.crypto?.subtle) {
  if (!subtle?.digest) {
    throw new Error("SHA-256 verification is unavailable in this browser.");
  }
  const hash = await subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function downloadPack(pointer, {
  fetchImpl = globalThis.fetch?.bind(globalThis),
  digestImpl = sha256Hex,
  onProgress = () => {}
} = {}) {
  if (!fetchImpl) throw new Error("Fetch is unavailable.");

  const manifestResponse = await fetchImpl(pointer.manifestUrl, { cache: "no-store" });
  if (!manifestResponse.ok) {
    throw new Error(`Could not load pack manifest (${manifestResponse.status}).`);
  }

  const manifest = validatePackManifest(await manifestResponse.json());
  if (manifest.id !== pointer.packId) {
    throw new Error("The current pack pointer and manifest ids do not match.");
  }

  const samples = [];
  for (const [trackIndex, track] of manifest.tracks.entries()) {
    validateTrackIntegrity(track, trackIndex);
    const sampleUrl = new URL(track.file, pointer.manifestUrl).href;
    const response = await fetchImpl(sampleUrl);
    if (!response.ok) {
      throw new Error(`Could not load ${track.name ?? track.id} (${response.status}).`);
    }

    const data = await response.arrayBuffer();
    if (data.byteLength !== track.byteLength) {
      throw new Error(`${track.name ?? track.id} has an unexpected file size.`);
    }
    const actualHash = await digestImpl(data);
    if (actualHash.toLowerCase() !== track.sha256.toLowerCase()) {
      throw new Error(`${track.name ?? track.id} failed its integrity check.`);
    }

    samples.push({
      trackId: track.id,
      contentType: response.headers?.get?.("content-type") ?? "audio/wav",
      data
    });
    onProgress({ completed: trackIndex + 1, total: manifest.tracks.length, track });
  }

  return {
    id: manifest.id,
    manifest: {
      ...manifest,
      releasedAt: pointer.releasedAt,
      expiresAt: pointer.expiresAt
    },
    samples,
    storedAt: new Date().toISOString()
  };
}

export class IndexedDbPackRepository {
  constructor({ indexedDB = globalThis.indexedDB } = {}) {
    this.indexedDB = indexedDB;
    this.databasePromise = null;
  }

  async get(packId) {
    if (!packId) return null;
    const database = await this.#open();
    return requestResult(database.transaction(PACK_STORE).objectStore(PACK_STORE).get(packId));
  }

  async getLatest() {
    const database = await this.#open();
    const records = await requestResult(
      database.transaction(PACK_STORE).objectStore(PACK_STORE).getAll()
    );
    return records.sort((left, right) => {
      const leftDate = Date.parse(left.manifest?.releasedAt ?? left.storedAt) || 0;
      const rightDate = Date.parse(right.manifest?.releasedAt ?? right.storedAt) || 0;
      return rightDate - leftDate;
    })[0] ?? null;
  }

  async put(delivery) {
    const database = await this.#open();
    await transactionComplete(database, (store) => store.put(delivery));
    return delivery;
  }

  async #open() {
    if (!this.indexedDB?.open) {
      throw new Error("IndexedDB is unavailable.");
    }
    if (this.databasePromise) return this.databasePromise;

    this.databasePromise = new Promise((resolve, reject) => {
      const request = this.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.addEventListener("upgradeneeded", () => {
        if (!request.result.objectStoreNames.contains(PACK_STORE)) {
          request.result.createObjectStore(PACK_STORE, { keyPath: "id" });
        }
      });
      request.addEventListener("success", () => resolve(request.result));
      request.addEventListener("error", () => reject(request.error));
      request.addEventListener("blocked", () => reject(new Error("Pack storage upgrade was blocked.")));
    });

    try {
      return await this.databasePromise;
    } catch (error) {
      this.databasePromise = null;
      throw error;
    }
  }
}

export class PackDelivery {
  constructor({
    pointerUrl = "./assets/packs/current.json",
    repository = new IndexedDbPackRepository(),
    fetchImpl = globalThis.fetch?.bind(globalThis),
    digestImpl = sha256Hex,
    onStatusChange = () => {}
  } = {}) {
    this.pointerUrl = pointerUrl;
    this.repository = repository;
    this.fetchImpl = fetchImpl;
    this.digestImpl = digestImpl;
    this.onStatusChange = onStatusChange;
  }

  async loadCurrent({ fallbackPackId = null, quiet = false } = {}) {
    const report = (status, detail) => {
      if (!quiet) this.onStatusChange(status, detail);
    };
    report("checking");

    const fallback = await this.#readFallback(fallbackPackId);

    try {
      if (!this.fetchImpl) throw new Error("Fetch is unavailable.");
      const pointerUrl = new URL(
        this.pointerUrl,
        globalThis.location?.href ?? "http://localhost/"
      ).href;
      const response = await this.fetchImpl(pointerUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Could not check the current pack (${response.status}).`);
      }
      const pointer = validatePackPointer(await response.json(), pointerUrl);
      const cached = await this.#readPack(pointer.packId);
      if (cached) {
        report("cached", cached);
        return { delivery: cached, offline: false };
      }

      report("downloading", { completed: 0, total: 8 });
      const delivery = await downloadPack(pointer, {
        fetchImpl: this.fetchImpl,
        digestImpl: this.digestImpl,
        onProgress: (progress) => report("downloading", progress)
      });
      await this.#storePack(delivery);
      report("downloaded", delivery);
      return { delivery, offline: false };
    } catch (error) {
      if (fallback) {
        report("offline", { ...fallback, error });
        return { delivery: fallback, offline: true, error };
      }
      report("error", error);
      throw error;
    }
  }

  async #readFallback(packId) {
    return await this.#readPack(packId) ?? this.#readLatest();
  }

  async #readPack(packId) {
    try {
      return await this.repository.get(packId);
    } catch {
      return null;
    }
  }

  async #readLatest() {
    try {
      return await this.repository.getLatest();
    } catch {
      return null;
    }
  }

  async #storePack(delivery) {
    try {
      await this.repository.put(delivery);
    } catch {
      // The downloaded pack can still be used for this session when storage is unavailable.
    }
  }
}

function validateTrackIntegrity(track, trackIndex) {
  if (!Number.isInteger(track.byteLength) || track.byteLength <= 0) {
    throw new TypeError(`Track ${trackIndex + 1} must declare its byte length.`);
  }
  if (typeof track.sha256 !== "string" || !SHA256_PATTERN.test(track.sha256.toLowerCase())) {
    throw new TypeError(`Track ${trackIndex + 1} must declare a SHA-256 hash.`);
  }
}

function parseTimestamp(value, label) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new TypeError(`The current pack ${label} timestamp is invalid.`);
  }
  return timestamp;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

function transactionComplete(database, mutate) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PACK_STORE, "readwrite");
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("abort", () => reject(transaction.error));
    transaction.addEventListener("error", () => reject(transaction.error));
    mutate(transaction.objectStore(PACK_STORE));
  });
}
