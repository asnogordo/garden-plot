// src/database.js
const sqlite3 = require('sqlite3').verbose();
const config = require('./config');

class Database {
  constructor() {
    this.dbPath = config.DB_PATH || './plot.db';
    this.db = null;
    this.connect();
  }

  connect() {
    this.db = new sqlite3.Database(this.dbPath, (err) => {
      if (err) {
        console.error('Error connecting to database:', err);
      } else {
        console.log('Connected to SQLite database');
        this.initMigrations();
      }
    });
  }

  initMigrations() {
    // First create migrations table
    this.db.run(`CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version INTEGER,
      applied_at INTEGER
    )`, (err) => {
      if (err) {
        console.error('Error creating migrations table:', err);
        return;
      }
      
      // ONLY after creating the table, check current version
      this.db.get("SELECT MAX(version) as current_version FROM migrations", (err, row) => {
        if (err) {
          console.error('Error checking migrations:', err);
          return;
        }

        const currentVersion = row && row.current_version ? row.current_version : 0;
        this.runMigrations(currentVersion);
      });
    });
  }

  runMigrations(currentVersion) {
    const migrations = [
      // Version 1: Initial schema - no actions, just a placeholder
      () => {
        console.log('Running migration to version 1: Initial schema');
        // Empty migration - tables will be created by individual modules
      },
      // Version 2: Add indexes AFTER all modules have initialized their tables
      () => {
        console.log('Running migration to version 2: Add indexes');
        // Only try to create indexes after a delay to ensure tables exist
        setTimeout(() => {
          this.db.run("CREATE INDEX IF NOT EXISTS idx_plot_items_plot_id ON plot_items(plot_id)", err => {
            if (err) console.error('Error creating index:', err);
          });
          this.db.run("CREATE INDEX IF NOT EXISTS idx_user_plants_user_id ON user_plants(user_id)", err => {
            if (err) console.error('Error creating index:', err);
          });
          this.db.run("CREATE INDEX IF NOT EXISTS idx_user_inventory_user_id ON user_inventory(user_id)", err => {
            if (err) console.error('Error creating index:', err);
          });
          this.db.run("CREATE INDEX IF NOT EXISTS idx_marketplace_listings_item_id ON marketplace_listings(item_id)", err => {
            if (err) console.error('Error creating index:', err);
          });
        }, 3000); // 3 second delay to ensure tables are created first
      },
    ];

    // Run missing migrations
    for (let i = currentVersion; i < migrations.length; i++) {
      const migrationFn = migrations[i];
      migrationFn();

      // Record migration
      const version = i + 1;
      const now = Date.now();
      this.db.run(
        "INSERT INTO migrations (version, applied_at) VALUES (?, ?)",
        [version, now]
      );
    }
  }

  // Helper for running parameterized queries
  query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  // Helper for getting a single row
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }

  // Helper for running updates/inserts
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) return reject(err);
        resolve({
          lastID: this.lastID,
          changes: this.changes
        });
      });
    });
  }

  // Helper for running multiple statements in a transaction
  transaction(queries) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        let results = [];
        let hasError = false;
        
        queries.forEach(query => {
          if (hasError) return;
          
          this.db.run(query.sql, query.params, function(err) {
            if (err) {
              hasError = true;
              this.db.run('ROLLBACK');
              reject(err);
              return;
            }
            
            results.push({
              lastID: this.lastID,
              changes: this.changes
            });
          });
        });
        
        if (!hasError) {
          this.db.run('COMMIT');
          resolve(results);
        }
      });
    });
  }

  // Close the database connection
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed');
        }
      });
    }
  }
}

const database = new Database();

// Export the singleton database instance and convenience methods
module.exports = {
  db: database.db,
  query: database.query.bind(database),
  get: database.get.bind(database),
  run: database.run.bind(database),
  transaction: database.transaction.bind(database),
  close: database.close.bind(database)
};