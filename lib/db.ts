import fs from 'fs';
import path from 'path';

let sqlite3: any;
let open: any;

try {
  sqlite3 = require('sqlite3');
  open = require('sqlite').open;
} catch (e) {
  console.log('Native sqlite3 not available, using JSON fallback');
}

const JSON_DB_PATH = path.join(process.cwd(), 'database.json');

class JsonDb {
  data: { places: any[] } = { places: [] };

  constructor() {
    this.load();
  }

  load() {
    if (fs.existsSync(JSON_DB_PATH)) {
      try {
        this.data = JSON.parse(fs.readFileSync(JSON_DB_PATH, 'utf-8'));
      } catch (e) {
        this.data = { places: [] };
      }
    }
  }

  save() {
    fs.writeFileSync(JSON_DB_PATH, JSON.stringify(this.data, null, 2));
  }

  async all(sql: string, params: any[] = []) {
    return [...this.data.places].sort((a, b) => 
      new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()
    );
  }

  async run(sql: string, params: any[] = []) {
    const [osm_id, name, category, address, opening_hours, phone, website, photo_url, rating, last_updated] = params;
    const existingIndex = this.data.places.findIndex(p => p.osm_id === osm_id);
    const place = { osm_id, name, category, address, opening_hours, phone, website, photo_url, rating, last_updated };
    
    if (existingIndex > -1) {
      this.data.places[existingIndex] = place;
    } else {
      this.data.places.push(place);
    }
    this.save();
  }
}

let dbInstance: any = null;

export async function getDb() {
  if (dbInstance) return dbInstance;

  if (sqlite3 && open) {
    try {
      const dbPath = path.join(process.cwd(), 'database.sqlite');
      dbInstance = await open({
        filename: dbPath,
        driver: sqlite3.Database,
      });

      await dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS places (
          osm_id TEXT PRIMARY KEY,
          name TEXT,
          category TEXT,
          address TEXT,
          opening_hours TEXT,
          phone TEXT,
          website TEXT,
          photo_url TEXT,
          rating TEXT,
          last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      return dbInstance;
    } catch (e) {
      console.error('Failed to initialize SQLite, falling back to JSON', e);
    }
  }

  dbInstance = new JsonDb();
  return dbInstance;
}
