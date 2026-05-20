/**
 * Storage v2 — IndexedDB Backend
 * -----------------------------------------------
 * All public methods are async (return Promises).
 *
 * DB Layout:
 *   Database     : "diary_app_db"
 *   Object Store : "entries"
 *   Key (keyPath): "date"  (YYYY-MM-DD string)
 *
 * Data is imported only via JSON backup/restore.
 * No automatic migration from old localStorage.
 * -----------------------------------------------
 */
class Storage {
    constructor() {
        this.DB_NAME    = 'diary_app_db';
        this.DB_VERSION = 1;
        this.STORE_NAME = 'entries';

        // Single shared DB connection promise — reused across all calls
        this._dbPromise = this._openDB();
    }

    // ------------------------------------------------------------------ //
    //  PRIVATE — IndexedDB Setup
    // ------------------------------------------------------------------ //

    /**
     * Open (and if needed upgrade) the IndexedDB database.
     * Returns a Promise<IDBDatabase>.
     */
    _openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    db.createObjectStore(this.STORE_NAME, { keyPath: 'date' });
                }
            };

            req.onsuccess  = (e) => resolve(e.target.result);
            req.onerror    = (e) => reject(e.target.error);
            req.onblocked  = ()  => console.warn('[Storage] IDB open blocked');
        });
    }

    /**
     * Wrap an IDBRequest in a Promise.
     */
    _promisify(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror   = (e) => reject(e.target.error);
        });
    }

    /**
     * Get a read-write transaction on the entries store.
     */
    async _txRW() {
        const db = await this._dbPromise;
        return db.transaction(this.STORE_NAME, 'readwrite').objectStore(this.STORE_NAME);
    }

    /**
     * Get a read-only transaction on the entries store.
     */
    async _txRO() {
        const db = await this._dbPromise;
        return db.transaction(this.STORE_NAME, 'readonly').objectStore(this.STORE_NAME);
    }

    // ------------------------------------------------------------------ //
    //  PUBLIC — Date Key Helpers (synchronous)
    // ------------------------------------------------------------------ //

    /**
     * Normalise any date string to YYYY-MM-DD.
     * Returns null if the string is not a recognisable date.
     */
    normalizeDateKey(dateStr) {
        if (typeof dateStr !== 'string') return null;
        const cleaned = dateStr.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

        // Accept ISO timestamps — keep only the date part
        const isoMatch = cleaned.match(/^(\d{4}-\d{2}-\d{2})T/);
        return isoMatch ? isoMatch[1] : null;
    }

    // ------------------------------------------------------------------ //
    //  PUBLIC — CRUD  (all async)
    // ------------------------------------------------------------------ //

    /**
     * Save (insert or overwrite) a diary entry for the given date.
     * @param {string} date   - YYYY-MM-DD
     * @param {object} data   - Plain JS object (v4.2 structure)
     * @returns {Promise<{success:boolean, error?:string}>}
     */
    async saveEntry(date, data) {
        const normalizedDate = this.normalizeDateKey(date);
        if (!normalizedDate) {
            return { success: false, error: 'Valid date required (YYYY-MM-DD)' };
        }
        try {
            const store  = await this._txRW();
            const record = (data && typeof data === 'object')
                ? { ...data, date: normalizedDate }
                : { date: normalizedDate };
            await this._promisify(store.put(record));
            return { success: true };
        } catch (e) {
            console.error('[Storage] saveEntry failed:', e);
            return { success: false, error: e.message };
        }
    }

    /**
     * Retrieve all entries as a plain object keyed by date string.
     * @returns {Promise<Object>}  e.g. { "2026-05-20": {...}, ... }
     */
    async getEntries() {
        try {
            const store   = await this._txRO();
            const records = await this._promisify(store.getAll());
            const result  = {};
            records.forEach(r => { result[r.date] = r; });
            return result;
        } catch (e) {
            console.error('[Storage] getEntries failed:', e);
            return {};
        }
    }

    /**
     * Retrieve a single entry.
     * @param {string} date - YYYY-MM-DD
     * @returns {Promise<object|null>}
     */
    async getEntry(date) {
        const normalized = this.normalizeDateKey(date);
        if (!normalized) return null;
        try {
            const store  = await this._txRO();
            const result = await this._promisify(store.get(normalized));
            return result ?? null;
        } catch (e) {
            console.error('[Storage] getEntry failed:', e);
            return null;
        }
    }

    /**
     * Delete a single entry.
     * @param {string} date - YYYY-MM-DD
     * @returns {Promise<boolean>}
     */
    async deleteEntry(date) {
        const normalized = this.normalizeDateKey(date);
        if (!normalized) return false;
        try {
            const store = await this._txRW();
            await this._promisify(store.delete(normalized));
            return true;
        } catch (e) {
            console.error('[Storage] deleteEntry failed:', e);
            return false;
        }
    }

    /**
     * Check whether an entry exists for the given date.
     * @param {string} date - YYYY-MM-DD
     * @returns {Promise<boolean>}
     */
    async hasEntry(date) {
        const entry = await this.getEntry(date);
        return entry !== null;
    }

    /**
     * Delete ALL entries from the database. Use with caution.
     * @returns {Promise<void>}
     */
    async clearAll() {
        try {
            const store = await this._txRW();
            await this._promisify(store.clear());
        } catch (e) {
            console.error('[Storage] clearAll failed:', e);
        }
    }

    // ------------------------------------------------------------------ //
    //  PUBLIC — Export / Import  (data-unchanged, v4.2 compatible)
    // ------------------------------------------------------------------ //

    /**
     * Export a single entry as a formatted JSON string.
     * The object is returned exactly as stored — no field modifications.
     * @param {string} date - YYYY-MM-DD
     * @returns {Promise<string|null>}
     */
    async exportEntry(date) {
        const entry = await this.getEntry(date);
        if (!entry) return null;
        return JSON.stringify(entry, null, 2);
    }

    /**
     * Import entries from a JSON string.
     * Handles three formats:
     *   1. Bulk backup object  — { "YYYY-MM-DD": {...}, ... }
     *   2. Array of entries    — [ { date: "YYYY-MM-DD", ... }, ... ]
     *   3. Single entry object — { date: "YYYY-MM-DD", version: "4.2", ... }
     *
     * IMPORTANT: Data goes in exactly as-is — no fields added, removed, or modified.
     *
     * @param {string} jsonContent - Raw JSON string from file
     * @returns {Promise<{success:boolean, count:number, error?:string}>}
     */
    async importEntries(jsonContent) {
        try {
            const data = JSON.parse(jsonContent);
            let count  = 0;

            if (Array.isArray(data)) {
                // Format 2 — array
                for (const item of data) {
                    const dateKey = item?.date ? this.normalizeDateKey(item.date) : null;
                    if (dateKey) {
                        await this.saveEntry(dateKey, item);
                        count++;
                    }
                }
            } else if (data && typeof data === 'object') {
                if (data.date && data.version) {
                    // Format 3 — single entry
                    const dateKey = this.normalizeDateKey(data.date);
                    if (dateKey) {
                        await this.saveEntry(dateKey, data);
                        count = 1;
                    }
                } else {
                    // Format 1 — bulk backup object keyed by date
                    for (const [dateKey, entry] of Object.entries(data)) {
                        const normalized = this.normalizeDateKey(dateKey);
                        if (normalized) {
                            await this.saveEntry(normalized, entry);
                            count++;
                        }
                    }
                }
            }

            return { success: true, count };
        } catch (e) {
            console.error('[Storage] importEntries failed:', e);
            return { success: false, count: 0, error: e.message };
        }
    }

    // ------------------------------------------------------------------ //
    //  PUBLIC — File Download Helper (synchronous)
    // ------------------------------------------------------------------ //

    /**
     * Trigger a JSON file download in the browser.
     * @param {string} filename - e.g. "diary-backup-2026-05-20.json"
     * @param {string} content  - JSON string
     */
    downloadJSON(filename, content) {
        const blob = new Blob([content], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
