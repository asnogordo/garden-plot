// src/mechanics/plants.js
const { db } = require('../database');
const plotSystem = require('./plot');
const weatherSystem = require('./weather');
const config = require('../config');

// Plant registry - definitions of all available plants
const plantRegistry = {
  // Basic Plants (always available)
  "sunflower": {
    name: "Sunflower",
    emoji: "🌻",
    growthStages: [
      { name: "seed", emoji: "🌱", duration: 6 * 3600 * 1000 }, // 6 hours
      { name: "sprout", emoji: "🌿", duration: 12 * 3600 * 1000 }, // 12 hours
      { name: "budding", emoji: "🪴", duration: 24 * 3600 * 1000 }, // 24 hours
      { name: "flowering", emoji: "🌻", duration: 0 }, // final stage
    ],
    waterNeeds: 60, // water level needed (out of 100)
    harvestReward: {
      dublooms: 15,
      seeds: 2,
      experience: 10,
    },
    soilPreference: "normal",
    weatherPreference: "☀️", // Grows best in sun
  },
  
  "carrot": {
    name: "Carrot",
    emoji: "🥕",
    growthStages: [
      { name: "seed", emoji: "🌱", duration: 4 * 3600 * 1000 }, // 4 hours
      { name: "sprout", emoji: "🌿", duration: 8 * 3600 * 1000 }, // 8 hours
      { name: "growing", emoji: "🌿", duration: 12 * 3600 * 1000 }, // 12 hours
      { name: "harvest", emoji: "🥕", duration: 0 }, // final stage
    ],
    waterNeeds: 50,
    harvestReward: {
      dublooms: 10,
      seeds: 1,
      experience: 8,
    },
    soilPreference: "fertile",
    weatherPreference: "🌧️", // Grows best in rain
  },
  
  "tulip": {
    name: "Tulip",
    emoji: "🌷",
    growthStages: [
      { name: "seed", emoji: "🌱", duration: 8 * 3600 * 1000 }, // 8 hours
      { name: "sprout", emoji: "🌿", duration: 16 * 3600 * 1000 }, // 16 hours
      { name: "budding", emoji: "🪴", duration: 24 * 3600 * 1000 }, // 24 hours
      { name: "flowering", emoji: "🌷", duration: 0 }, // final stage
    ],
    waterNeeds: 70,
    harvestReward: {
      dublooms: 20,
      seeds: 2,
      experience: 15,
    },
    soilPreference: "normal",
    weatherPreference: "🌈", // Grows best during rainbow weather
  },
  
  // Advanced Plants (unlocked at higher levels)
  "apple_tree": {
    name: "Apple Tree",
    emoji: "🍎",
    level_required: 5,
    growthStages: [
      { name: "sapling", emoji: "🌱", duration: 24 * 3600 * 1000 }, // 1 day
      { name: "growing", emoji: "🌿", duration: 3 * 24 * 3600 * 1000 }, // 3 days
      { name: "small_tree", emoji: "🌴", duration: 5 * 24 * 3600 * 1000 }, // 5 days
      { name: "tree", emoji: "🌳", duration: 0 }, // final stage before fruiting
      { name: "fruiting", emoji: "🍎", duration: 0, harvestable: true }, // harvestable, cycles back to tree
    ],
    waterNeeds: 80,
    harvestReward: {
      dublooms: 50,
      seeds: 0, // Trees don't give seeds directly
      fruit: { name: "Apple", emoji: "🍎", value: 25 },
      experience: 50,
    },
    soilPreference: "fertile",
    weatherPreference: "☀️", // Grows best in sun
    persistent: true, // Doesn't disappear after harvest
    regrowDuration: 3 * 24 * 3600 * 1000, // 3 days to regrow fruit
  },
  
  // Seasonal Plants (only available during specific seasons)
  "pumpkin": {
    name: "Pumpkin",
    emoji: "🎃",
    seasonal: "fall", // Only available in fall
    growthStages: [
      { name: "seed", emoji: "🌱", duration: 12 * 3600 * 1000 }, // 12 hours
      { name: "sprout", emoji: "🌿", duration: 24 * 3600 * 1000 }, // 24 hours
      { name: "growing", emoji: "🪴", duration: 2 * 24 * 3600 * 1000 }, // 2 days
      { name: "harvest", emoji: "🎃", duration: 0 }, // final stage
    ],
    waterNeeds: 65,
    harvestReward: {
      dublooms: 30,
      seeds: 3,
      experience: 25,
    },
    soilPreference: "fertile",
    weatherPreference: "🌧️", // Grows best in rain
  },
};

class PlantSystem {
  constructor() {
    this.initDatabase();
    this.plantRegistry = plantRegistry;
  }

  initDatabase() {
    db.serialize(() => {
      // Create user_plants table to track owned seeds
      db.run(`CREATE TABLE IF NOT EXISTS user_plants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        plant_id TEXT,
        quantity INTEGER DEFAULT 0,
        discovered_at INTEGER
      )`);
      
      // Create plant_history table for statistics
      db.run(`CREATE TABLE IF NOT EXISTS plant_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        plant_id TEXT,
        action TEXT,
        timestamp INTEGER,
        result TEXT
      )`);
    });
  }

  // Get all available plants
  getAvailablePlants(userLevel = 1, season = null) {
    const availablePlants = {};
    
    for (const [plantId, plant] of Object.entries(this.plantRegistry)) {
      // Check level requirements
      if (plant.level_required && plant.level_required > userLevel) {
        continue;
      }
      
      // Check seasonal availability
      if (plant.seasonal && plant.seasonal !== season && season !== null) {
        continue;
      }
      
      availablePlants[plantId] = plant;
    }
    
    return availablePlants;
  }

  // Get plant details
  getPlantDetails(plantId) {
    return this.plantRegistry[plantId];
  }

  // Get user's seed inventory
  async getUserSeeds(userId) {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM user_plants WHERE user_id = ?", [userId], (err, rows) => {
        if (err) return reject(err);
        
        // Format the results into an easy-to-use object
        const seeds = {};
        (rows || []).forEach(row => {
          seeds[row.plant_id] = {
            ...row,
            details: this.getPlantDetails(row.plant_id)
          };
        });
        
        resolve(seeds);
      });
    });
  }

  // Add seeds to user's inventory
  async addSeeds(userId, plantId, quantity) {
    const now = Date.now();
    
    return new Promise((resolve, reject) => {
      db.get("SELECT * FROM user_plants WHERE user_id = ? AND plant_id = ?", [userId, plantId], (err, row) => {
        if (err) return reject(err);
        
        if (row) {
          // Update existing record
          db.run(
            "UPDATE user_plants SET quantity = quantity + ? WHERE id = ?",
            [quantity, row.id],
            function(err) {
              if (err) return reject(err);
              
              resolve({
                ...row,
                quantity: row.quantity + quantity
              });
            }
          );
        } else {
          // Create new record
          db.run(
            "INSERT INTO user_plants (user_id, plant_id, quantity, discovered_at) VALUES (?, ?, ?, ?)",
            [userId, plantId, quantity, now],
            function(err) {
              if (err) return reject(err);
              
              resolve({
                id: this.lastID,
                user_id: userId,
                plant_id: plantId,
                quantity: quantity,
                discovered_at: now
              });
            }
          );
        }
      });
    });
  }

  // Remove seeds from user's inventory
  async removeSeeds(userId, plantId, quantity) {
    return new Promise((resolve, reject) => {
      db.get("SELECT * FROM user_plants WHERE user_id = ? AND plant_id = ?", [userId, plantId], (err, row) => {
        if (err) return reject(err);
        
        if (!row || row.quantity < quantity) {
          return reject(new Error("Not enough seeds"));
        }
        
        const newQuantity = row.quantity - quantity;
        
        db.run(
          "UPDATE user_plants SET quantity = ? WHERE id = ?",
          [newQuantity, row.id],
          function(err) {
            if (err) return reject(err);
            
            resolve({
              ...row,
              quantity: newQuantity
            });
          }
        );
      });
    });
  }

  // Plant a seed on the user's plot
  async plantSeed(userId, plantId, x, y) {
    // Check if user has the seed
    try {
      await this.removeSeeds(userId, plantId, 1);
    } catch (error) {
      throw new Error("You don't have any seeds of this type to plant");
    }
    
    // Check if the plant is available (season, level)
    const userPlot = await plotSystem.getPlot(userId);
    const availablePlants = this.getAvailablePlants(userPlot.plot_level);
    
    if (!availablePlants[plantId]) {
      // Refund the seed
      await this.addSeeds(userId, plantId, 1);
      throw new Error("This plant is not available to you yet");
    }
    
    // Add plant to plot
    try {
      const plantedItem = await plotSystem.addPlotItem(userId, "plant", plantId, x, y);
      
      // Log in history
      await this.logPlantAction(userId, plantId, "plant", "success");
      
      return {
        success: true,
        message: `You planted a ${this.plantRegistry[plantId].name}!`,
        plant: plantedItem
      };
    } catch (error) {
      // Refund the seed if planting failed
      await this.addSeeds(userId, plantId, 1);
      throw error;
    }
  }

  // Update plant growth based on time passed
  async updatePlantGrowth(plotItem) {
    const now = Date.now();
    const plantId = plotItem.item_id;
    const plant = this.plantRegistry[plantId];
    
    if (!plant) {
      return plotItem; // No changes if plant not found in registry
    }
    
    const timePassed = now - plotItem.last_updated;
    let currentGrowthStage = plotItem.growth_stage;
    const currentStageDefinition = plant.growthStages[currentGrowthStage];
    
    // If not at final stage and enough time has passed
    if (currentStageDefinition.duration > 0 && timePassed >= currentStageDefinition.duration) {
      // Advance to next stage
      currentGrowthStage++;
      
      // Update the plot item
      await plotSystem.updatePlotItem(plotItem.id, {
        growth_stage: currentGrowthStage
      });
      
      // Return updated item
      return {
        ...plotItem,
        growth_stage: currentGrowthStage,
        last_updated: now
      };
    }
    
    return plotItem; // No changes
  }

  // Update all plants on a user's plot
  async updateAllPlants(userId) {
    const plotItems = await plotSystem.getPlotItems(userId);
    const plantItems = plotItems.filter(item => item.item_type === "plant");
    
    const updates = [];
    for (const plantItem of plantItems) {
      const updatedPlant = await this.updatePlantGrowth(plantItem);
      updates.push(updatedPlant);
    }
    
    return updates;
  }

  // Water a plant
  async waterPlant(userId, itemId) {
    const plotItems = await plotSystem.getPlotItems(userId);
    const plantItem = plotItems.find(item => item.id === itemId && item.item_type === "plant");
    
    if (!plantItem) {
      throw new Error("Plant not found");
    }
    
    // Increase water level (cap at 100)
    const newWaterLevel = Math.min(100, plantItem.water_level + 25);
    
    await plotSystem.updatePlotItem(plantItem.id, {
      water_level: newWaterLevel
    });
    
    return {
      success: true,
      message: `You watered your ${this.plantRegistry[plantItem.item_id].name}!`,
      newWaterLevel
    };
  }

  // Harvest a plant
  async harvestPlant(userId, itemId) {
    const plotItems = await plotSystem.getPlotItems(userId);
    const plantItem = plotItems.find(item => item.id === itemId && item.item_type === "plant");
    
    if (!plantItem) {
      throw new Error("Plant not found");
    }
    
    const plantId = plantItem.item_id;
    const plant = this.plantRegistry[plantId];
    
    if (!plant) {
      throw new Error("Unknown plant type");
    }
    
    const currentGrowthStage = plantItem.growth_stage;
    const currentStageDefinition = plant.growthStages[currentGrowthStage];
    
    // Check if plant is harvestable
    if (!currentStageDefinition.harvestable && currentGrowthStage < plant.growthStages.length - 1) {
      throw new Error("This plant is not ready to harvest yet");
    }
    
    // Calculate rewards
    const rewardMultiplier = this.calculateRewardMultiplier(plantItem);
    const rewards = {
      dublooms: Math.floor(plant.harvestReward.dublooms * rewardMultiplier),
      experience: Math.floor(plant.harvestReward.experience * rewardMultiplier),
    };
    
    // Add rewards to user
    // (This would use other systems like economy and user experience)
    
    // Add seeds if applicable
    if (plant.harvestReward.seeds > 0) {
      const seedCount = Math.floor(plant.harvestReward.seeds * rewardMultiplier);
      await this.addSeeds(userId, plantId, seedCount);
      rewards.seeds = seedCount;
    }
    
    // Add fruits/resources if applicable
    if (plant.harvestReward.fruit) {
      rewards.fruit = plant.harvestReward.fruit;
      // Would add to user inventory
    }
    
    // Handle plant after harvest
    if (plant.persistent) {
      // For persistent plants (like trees), reset to non-harvestable state
      const resetStage = plant.growthStages.findIndex(stage => stage.name === "tree" || !stage.harvestable);
      await plotSystem.updatePlotItem(plantItem.id, {
        growth_stage: resetStage,
        health: 100, // Refresh health
        water_level: 50 // Reset water level
      });
    } else {
      // For non-persistent plants, remove from plot
      await plotSystem.removePlotItem(plantItem.id);
    }
    
    // Log in history
    await this.logPlantAction(userId, plantId, "harvest", "success");
    
    return {
      success: true,
      message: `You harvested your ${plant.name}!`,
      rewards
    };
  }

  // Calculate rewards multiplier based on plant health, water level, soil, etc.
  calculateRewardMultiplier(plantItem) {
    let multiplier = 1.0;
    
    // Factor in plant health
    multiplier *= plantItem.health / 100;
    
    // Factor in water level (optimal is 50-80%)
    const waterLevel = plantItem.water_level;
    if (waterLevel >= 50 && waterLevel <= 80) {
      multiplier *= 1.2; // Bonus for optimal water
    } else if (waterLevel < 30 || waterLevel > 90) {
      multiplier *= 0.8; // Penalty for poor watering
    }
    
    // Would factor in soil quality and weather preferences here
    
    return multiplier;
  }

  // Log plant actions for history/statistics
  async logPlantAction(userId, plantId, action, result) {
    const now = Date.now();
    
    return new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO plant_history (user_id, plant_id, action, timestamp, result) VALUES (?, ?, ?, ?, ?)",
        [userId, plantId, action, now, result],
        function(err) {
          if (err) return reject(err);
          resolve({ id: this.lastID });
        }
      );
    });
  }
}

module.exports = new PlantSystem();