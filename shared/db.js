const path = require("path");
const Database = require("better-sqlite3");

let db;

function dbInit(dataDir) {
  const dbPath = path.join(dataDir, "lapdash.sqlite3");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS circuits (
      circuit_name TEXT PRIMARY KEY,
      picture_path TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS competition_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      circuit_name TEXT NOT NULL,
      group_name TEXT NOT NULL,
      UNIQUE(circuit_name, group_name),
      FOREIGN KEY(circuit_name) REFERENCES circuits(circuit_name)
    );

    CREATE TABLE IF NOT EXISTS world_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      circuit_name TEXT NOT NULL,
      group_name TEXT NOT NULL,
      lap_time_ms INTEGER NOT NULL,
      sector1_ms INTEGER,
      sector2_ms INTEGER,
      sector3_ms INTEGER,
      holder TEXT NOT NULL DEFAULT '',
      UNIQUE(circuit_name, group_name),
      FOREIGN KEY(circuit_name) REFERENCES circuits(circuit_name)
    );

    CREATE TABLE IF NOT EXISTS best_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      circuit_name TEXT NOT NULL,
      group_name TEXT NOT NULL,
      record_date TEXT NOT NULL,
      record_time TEXT NOT NULL,
      weather TEXT NOT NULL DEFAULT '',
      car TEXT NOT NULL DEFAULT '',
      lap_time_ms INTEGER NOT NULL,
      FOREIGN KEY(circuit_name) REFERENCES circuits(circuit_name)
    );

    CREATE INDEX IF NOT EXISTS idx_groups_circuit
      ON competition_groups (circuit_name);

    CREATE INDEX IF NOT EXISTS idx_world_records_circuit_group
      ON world_records (circuit_name, group_name);

    CREATE INDEX IF NOT EXISTS idx_best_records_circuit_group_time
      ON best_records (circuit_name, group_name, lap_time_ms);
  `);

  // Optional: seed minimal demo data if DB is empty (safe for first run)
  const circuitCount = db.prepare(`SELECT COUNT(*) AS c FROM circuits`).get().c;
  if (circuitCount === 0) {
    db.prepare(`INSERT INTO circuits (circuit_name, picture_path, note) VALUES (?, ?, ?)`)
      .run("Suzuka", "", "Seed data. Replace with your own circuits.");

    db.prepare(`INSERT INTO competition_groups (circuit_name, group_name) VALUES (?, ?)`)
      .run("Suzuka", "F1");

    db.prepare(`INSERT INTO world_records (circuit_name, group_name, lap_time_ms, sector1_ms, sector2_ms, sector3_ms, holder)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(circuit_name, group_name) DO NOTHING`)
      .run("Suzuka", "F1", 90000, 30000, 30000, 30000, "Demo");
  }
}

const dbApi = {
  listCircuits() {
    return db.prepare(`
      SELECT circuit_name
      FROM circuits
      ORDER BY circuit_name ASC
    `).all();
  },

  listGroupsForCircuit(circuitName) {
    return db.prepare(`
      SELECT group_name
      FROM competition_groups
      WHERE circuit_name = ?
      ORDER BY group_name ASC
    `).all(circuitName);
  },

  getCircuit(circuitName) {
    return db.prepare(`
      SELECT circuit_name, picture_path, note
      FROM circuits
      WHERE circuit_name = ?
    `).get(circuitName);
  },

  getWorldRecord(circuitName, groupName) {
    return db.prepare(`
      SELECT circuit_name, group_name, lap_time_ms, sector1_ms, sector2_ms, sector3_ms, holder
      FROM world_records
      WHERE circuit_name = ? AND group_name = ?
    `).get(circuitName, groupName) || null;
  },

  // Per your request: DESC (even though times are usually ASC)
  listBestRecords(circuitName, groupName, limit = 10) {
    return db.prepare(`
      SELECT record_date, record_time, lap_time_ms, car, weather
      FROM best_records
      WHERE circuit_name = ? AND group_name = ?
      ORDER BY lap_time_ms DESC
      LIMIT ?
    `).all(circuitName, groupName, limit);
  },

  insertBestRecord(payload) {
    const {
      circuit_name,
      group_name,
      record_date,
      record_time,
      weather = "",
      car = "",
      lap_time_ms
    } = payload || {};

    if (!circuit_name || !group_name || !record_date || !record_time || !Number.isFinite(lap_time_ms)) {
      throw new Error("insertBestRecord: invalid payload");
    }

    const stmt = db.prepare(`
      INSERT INTO best_records (circuit_name, group_name, record_date, record_time, weather, car, lap_time_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      circuit_name,
      group_name,
      record_date,
      record_time,
      weather,
      car,
      lap_time_ms
    );

    return { id: info.lastInsertRowid };
  }
};

module.exports = { dbInit, dbApi };
