class Storage {
    constructor() {
        this.dbName = 'diary_entries';
    }

    normalizeDateKey(dateStr) {
        if (typeof dateStr !== 'string') return null;
        const cleaned = dateStr.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

        // Accept ISO timestamps and keep only YYYY-MM-DD part
        const isoMatch = cleaned.match(/^(\d{4}-\d{2}-\d{2})T/);
        return isoMatch ? isoMatch[1] : null;
    }

    // Save an entry
    saveEntry(date, data) {
        const normalizedDate = this.normalizeDateKey(date);
        if (!normalizedDate) return { success: false, error: 'Valid date is required (YYYY-MM-DD)' };
        
        try {
            const entries = this.getEntries();
            const normalizedData = (data && typeof data === 'object')
                ? { ...data, date: normalizedDate }
                : data;
            entries[normalizedDate] = normalizedData;
            localStorage.setItem(this.dbName, JSON.stringify(entries));
            return { success: true };
        } catch (e) {
            console.error("Save failed", e);
            return { success: false, error: e.message };
        }
    }

    // Get all entries
    getEntries() {
        const entriesStr = localStorage.getItem(this.dbName);
        return entriesStr ? JSON.parse(entriesStr) : {};
    }

    // Get single entry
    getEntry(date) {
        const entries = this.getEntries();
        return entries[date] || null;
    }

    // Delete entry
    deleteEntry(date) {
        const entries = this.getEntries();
        if (entries[date]) {
            delete entries[date];
            localStorage.setItem(this.dbName, JSON.stringify(entries));
            return true;
        }
        return false;
    }

    // Check if entry exists
    hasEntry(date) {
        const entries = this.getEntries();
        return !!entries[date];
    }

    // Clear all data (Dangerous)
    clearAll() {
        localStorage.removeItem(this.dbName);
    }

    // Export single entry as JSON matching the strict output.json structure
    exportEntry(date) {
        const entry = this.getEntry(date);
        if (!entry) return null;

        // Ensure structure matches output.json exactly
        // We assume 'entry' object is already built with this structure by the UI
        // But for safety, we can re-construct or validator here.
        // For now, we'll return it directly as we'll enforce structure in UI.js
        
        // However, let's map it to be safe if we change internal storage structure later.
        // The prompt asks to "output file same @[output.json]".
        
        return JSON.stringify(entry, null, 2);
    }
    
    // Import from JSON file content
    importEntries(jsonContent) {
       try {
           const data = JSON.parse(jsonContent);
           /* 
               Handle two cases:
               1. Array of entries (Backup)
               2. Single entry object
           */
           
           let count = 0;
           
            if (Array.isArray(data)) {
               // Backup format? Or list of entries?
               // Let's assume backup is an object { "YYYY-MM-DD": {...}, ... } or array
               // If it's the requested output format, it has a "date" field.
               
               data.forEach(item => {
                   const dateKey = item?.date ? this.normalizeDateKey(item.date) : null;
                   if (dateKey) {
                       this.saveEntry(dateKey, item);
                       count++;
                   }
               });
           } else {
               // Single object
               // Check if it's our direct backup format (Map) VS single entry
                if (data.date && data.version) {
                     // Single Output.json format
                     const dateKey = this.normalizeDateKey(data.date);
                     if (dateKey) {
                         this.saveEntry(dateKey, data);
                         count = 1;
                     }
                } else {
                    // Maybe it's a bulk backup object keyed by date
                    Object.keys(data).forEach(dateKey => {
                        const normalizedDate = this.normalizeDateKey(dateKey);
                        if (normalizedDate) {
                            this.saveEntry(normalizedDate, data[dateKey]);
                            count++;
                        }
                    });
                }
           }
           
           return { success: true, count };
       } catch(e) {
           return { success: false, error: e.message };
       }
    }

    // Download file helper
    downloadJSON(filename, content) {
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
