// src/mechanics/plot.js
const { db } = require('../database');
const config = require('../config');
const displayManager = require('../utils/displayManager');

class PlotSystem {
  constructor() {
    this.initDatabase();
  }

  initDatabase() {
    db.serialize(() => {
      // Create plots table with soil quality zones and expanded size
      db.run(`CREATE TABLE IF NOT EXISTS plots (
        user_id TEXT PRIMARY KEY,
        size INTEGER DEFAULT 5,
        soil_quality TEXT DEFAULT '{"default":"normal"}',
        last_tended INTEGER,
        plot_level INTEGER DEFAULT 1,
        experience INTEGER DEFAULT 0,
        created_at INTEGER
      )`);

      // Create plot_items table (plants, decorations, etc. placed on the plot)
      db.run(`CREATE TABLE IF NOT EXISTS plot_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plot_id TEXT,
        item_type TEXT,
        item_id TEXT,
        x INTEGER,
        y INTEGER,
        planted_at INTEGER,
        growth_stage INTEGER DEFAULT 0,
        health INTEGER DEFAULT 100,
        water_level INTEGER DEFAULT 50,
        last_updated INTEGER,
        FOREIGN KEY(plot_id) REFERENCES plots(user_id)
      )`);
    });
  }

  // Get or create a plot for a user
  async getPlot(userId) {
    return new Promise((resolve, reject) => {
      db.get("SELECT * FROM plots WHERE user_id = ?", [userId], (err, row) => {
        if (err) return reject(err);
        
        if (row) {
          // Convert stored JSON string to object
          row.soil_quality = JSON.parse(row.soil_quality);
          resolve(row);
        } else {
          // Create new plot for user
          const now = Date.now();
          const defaultSoilQuality = this.generateDefaultSoilQuality();
          
          db.run(
            "INSERT INTO plots (user_id, size, soil_quality, last_tended, plot_level, experience, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [userId, 5, JSON.stringify(defaultSoilQuality), now, 1, 0, now],
            function(err) {
              if (err) return reject(err);
              
              resolve({
                user_id: userId,
                size: 5,
                soil_quality: defaultSoilQuality,
                last_tended: now,
                plot_level: 1,
                experience: 0,
                created_at: now
              });
            }
          );
        }
      });
    });
  }

  // Generate default soil quality with some randomness
  generateDefaultSoilQuality() {
    const soilTypes = ["poor", "normal", "fertile"];
    const soilQuality = {};
    
    // Generate a more interesting starting plot with some randomness
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        // Center area has higher chance of being fertile
        let typeChances;
        if (x > 1 && x < 4 && y > 1 && y < 4) {
          typeChances = [0.1, 0.4, 0.5]; // [poor, normal, fertile]
        } else {
          typeChances = [0.3, 0.6, 0.1]; // [poor, normal, fertile]
        }
        
        const roll = Math.random();
        let selectedType;
        
        if (roll < typeChances[0]) {
          selectedType = soilTypes[0];
        } else if (roll < typeChances[0] + typeChances[1]) {
          selectedType = soilTypes[1];
        } else {
          selectedType = soilTypes[2];
        }
        
        soilQuality[`${x},${y}`] = selectedType;
      }
    }
    
    return soilQuality;
  }

  // Get all items (plants, decorations) on a plot
  async getPlotItems(userId) {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM plot_items WHERE plot_id = ?", [userId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  // Add an item to a plot (plant, decoration, etc.)
  async addPlotItem(userId, itemType, itemId, x, y) {
    const now = Date.now();
    
    // First check if the position is already occupied
    const existingItem = await this.getPlotItemAtPosition(userId, x, y);
    if (existingItem) {
      throw new Error("This position is already occupied!");
    }
    
    return new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO plot_items (plot_id, item_type, item_id, x, y, planted_at, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [userId, itemType, itemId, x, y, now, now],
        function(err) {
          if (err) return reject(err);
          
          resolve({
            id: this.lastID,
            plot_id: userId,
            item_type: itemType,
            item_id: itemId,
            x: x,
            y: y,
            planted_at: now,
            growth_stage: 0,
            health: 100,
            water_level: 50,
            last_updated: now
          });
        }
      );
    });
  }

  // Get plot item at a specific position
  async getPlotItemAtPosition(userId, x, y) {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM plot_items WHERE plot_id = ? AND x = ? AND y = ?",
        [userId, x, y],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });
  }

  // Update a plot item (e.g., growth stage, health)
  async updatePlotItem(itemId, updates) {
    const updateFields = [];
    const updateValues = [];
    
    for (const [key, value] of Object.entries(updates)) {
      updateFields.push(`${key} = ?`);
      updateValues.push(value);
    }
    
    // Always update the last_updated timestamp
    updateFields.push('last_updated = ?');
    updateValues.push(Date.now());
    
    // Add the itemId as the last value
    updateValues.push(itemId);
    
    const sql = `UPDATE plot_items SET ${updateFields.join(', ')} WHERE id = ?`;
    
    return new Promise((resolve, reject) => {
      db.run(sql, updateValues, function(err) {
        if (err) return reject(err);
        resolve({ changes: this.changes });
      });
    });
  }

  // Remove an item from a plot
  async removePlotItem(itemId) {
    return new Promise((resolve, reject) => {
      db.run("DELETE FROM plot_items WHERE id = ?", [itemId], function(err) {
        if (err) return reject(err);
        resolve({ changes: this.changes });
      });
    });
  }

  // Expand a user's plot (when they level up)
  async expandPlot(userId, newSize) {
    const plot = await this.getPlot(userId);
    
    if (newSize <= plot.size) {
      throw new Error("New size must be larger than current size");
    }
    
    // Generate soil quality for new cells
    const updatedSoilQuality = {...plot.soil_quality};
    
    for (let y = 0; y < newSize; y++) {
      for (let x = 0; x < newSize; x++) {
        const key = `${x},${y}`;
        if (!updatedSoilQuality[key]) {
          // Only generate for new cells
          const soilTypeRoll = Math.random();
          let soilType;
          
          if (soilTypeRoll < 0.3) {
            soilType = "poor";
          } else if (soilTypeRoll < 0.8) {
            soilType = "normal";
          } else {
            soilType = "fertile";
          }
          
          updatedSoilQuality[key] = soilType;
        }
      }
    }
    
    return new Promise((resolve, reject) => {
      db.run(
        "UPDATE plots SET size = ?, soil_quality = ? WHERE user_id = ?",
        [newSize, JSON.stringify(updatedSoilQuality), userId],
        function(err) {
          if (err) return reject(err);
          
          resolve({
            ...plot,
            size: newSize,
            soil_quality: updatedSoilQuality
          });
        }
      );
    });
  }

  // Improve soil quality of a specific cell
  async improveSoilQuality(userId, x, y) {
    const plot = await this.getPlot(userId);
    const soilQuality = {...plot.soil_quality};
    const key = `${x},${y}`;
    
    if (!soilQuality[key]) {
      throw new Error("Invalid plot coordinates");
    }
    
    const currentQuality = soilQuality[key];
    let newQuality = currentQuality;
    
    if (currentQuality === "poor") {
      newQuality = "normal";
    } else if (currentQuality === "normal") {
      newQuality = "fertile";
    }
    
    // Only update if there's a change
    if (newQuality !== currentQuality) {
      soilQuality[key] = newQuality;
      
      return new Promise((resolve, reject) => {
        db.run(
          "UPDATE plots SET soil_quality = ? WHERE user_id = ?",
          [JSON.stringify(soilQuality), userId],
          function(err) {
            if (err) return reject(err);
            
            resolve({
              ...plot,
              soil_quality: soilQuality
            });
          }
        );
      });
    }
    
    return plot;
  }

  // Generate a visual representation of the plot
  async renderPlot(userId) {
    const plot = await this.getPlot(userId);
    const plotItems = await this.getPlotItems(userId);
    
    return displayManager.generatePlotDisplay(plot, plotItems);
  }
}

module.exports = new PlotSystem();