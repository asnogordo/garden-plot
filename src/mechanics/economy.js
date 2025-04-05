// src/mechanics/economy.js
const { db } = require('../database');

class EconomySystem {
  constructor() {
    this.initDatabase();
    
    // Define item shop catalog
    this.shopCatalog = {
      // Seeds
      "sunflower_seed": {
        name: "Sunflower Seeds",
        emoji: "🌻",
        description: "Seeds to grow sunflowers",
        category: "seed",
        price: 10,
        quantity: 1
      },
      "carrot_seed": {
        name: "Carrot Seeds",
        emoji: "🥕",
        description: "Seeds to grow carrots",
        category: "seed",
        price: 8,
        quantity: 1
      },
      "tulip_seed": {
        name: "Tulip Seeds",
        emoji: "🌷",
        description: "Seeds to grow tulips",
        category: "seed",
        price: 15,
        quantity: 1
      },
      
      // Tools
      "watering_can": {
        name: "Watering Can",
        emoji: "🚿",
        description: "Waters multiple plants at once",
        category: "tool",
        price: 100,
        durability: 50,
        effect: "water_multiple"
      },
      "fertilizer": {
        name: "Fertilizer",
        emoji: "💩",
        description: "Improves soil quality",
        category: "tool",
        price: 50,
        durability: 5,
        effect: "improve_soil"
      },
      
      // Plot upgrades
      "plot_expansion": {
        name: "Plot Expansion",
        emoji: "📏",
        description: "Increases plot size by 1",
        category: "upgrade",
        price: 500,
        effect: "expand_plot"
      },
      
      // Decorations
      "garden_gnome": {
        name: "Garden Gnome",
        emoji: "🧙",
        description: "A cute decoration that increases luck",
        category: "decoration",
        price: 200,
        effect: "luck_boost"
      },
      "bird_bath": {
        name: "Bird Bath",
        emoji: "🐦",
        description: "Attracts birds that help with pest control",
        category: "decoration",
        price: 150,
        effect: "pest_control"
      }
    };
  }

  initDatabase() {
    db.serialize(() => {
      // Create user_economy table
      db.run(`CREATE TABLE IF NOT EXISTS user_economy (
        user_id TEXT PRIMARY KEY,
        dublooms INTEGER DEFAULT 0,
        last_daily_reward INTEGER
      )`);
      
      // Create user_inventory table
      db.run(`CREATE TABLE IF NOT EXISTS user_inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        item_id TEXT,
        quantity INTEGER DEFAULT 0,
        durability INTEGER,
        acquired_at INTEGER
      )`);
      
      // Create marketplace_listings table
      db.run(`CREATE TABLE IF NOT EXISTS marketplace_listings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seller_id TEXT,
        item_id TEXT,
        quantity INTEGER,
        price INTEGER,
        listed_at INTEGER
      )`);
      
      // Create transaction_history table
      db.run(`CREATE TABLE IF NOT EXISTS transaction_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        transaction_type TEXT,
        amount INTEGER,
        details TEXT,
        timestamp INTEGER
      )`);
    });
  }

  // Get user's economy data (dublooms, etc.)
  async getUserEconomy(userId) {
    return new Promise((resolve, reject) => {
      db.get("SELECT * FROM user_economy WHERE user_id = ?", [userId], (err, row) => {
        if (err) return reject(err);
        
        if (row) {
          resolve(row);
        } else {
          // Create new economy record for user
          const now = Date.now();
          const startingDublooms = 50; // Give new users some starting dublooms
          
          db.run(
            "INSERT INTO user_economy (user_id, dublooms, last_daily_reward) VALUES (?, ?, ?)",
            [userId, startingDublooms, 0],
            function(err) {
              if (err) return reject(err);
              
              resolve({
                user_id: userId,
                dublooms: startingDublooms,
                last_daily_reward: 0
              });
            }
          );
        }
      });
    });
  }

  // Update user's dubloom balance
  async updateDublooms(userId, amount) {
    const economy = await this.getUserEconomy(userId);
    const newBalance = Math.max(0, economy.dublooms + amount); // Prevent negative balance
    
    return new Promise((resolve, reject) => {
      db.run(
        "UPDATE user_economy SET dublooms = ? WHERE user_id = ?",
        [newBalance, userId],
        function(err) {
          if (err) return reject(err);
          
          // Log transaction
          const transactionType = amount >= 0 ? "earn" : "spend";
          db.run(
            "INSERT INTO transaction_history (user_id, transaction_type, amount, details, timestamp) VALUES (?, ?, ?, ?, ?)",
            [userId, transactionType, Math.abs(amount), "Dubloom update", Date.now()]
          );
          
          resolve({
            previousBalance: economy.dublooms,
            newBalance,
            change: amount
          });
        }
      );
    });
  }

  // Give daily reward to user
  async claimDailyReward(userId) {
    const economy = await this.getUserEconomy(userId);
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    // Check if daily reward is available
    if (now - economy.last_daily_reward < oneDayMs) {
      const nextRewardTime = economy.last_daily_reward + oneDayMs;
      const timeRemainingMs = nextRewardTime - now;
      const timeRemainingHours = Math.ceil(timeRemainingMs / (60 * 60 * 1000));
      
      return {
        success: false,
        message: `You've already claimed your daily reward. Next reward available in ${timeRemainingHours} hours.`,
        nextRewardTime
      };
    }
    
    // Calculate reward amount (base + streak bonus)
    const baseReward = 25;
    const streakBonus = this.calculateStreakBonus(economy.last_daily_reward, now);
    const totalReward = baseReward + streakBonus;
    
    // Update user's dublooms and last reward time
    return new Promise((resolve, reject) => {
      db.run(
        "UPDATE user_economy SET dublooms = dublooms + ?, last_daily_reward = ? WHERE user_id = ?",
        [totalReward, now, userId],
        function(err) {
          if (err) return reject(err);
          
          // Log transaction
          db.run(
            "INSERT INTO transaction_history (user_id, transaction_type, amount, details, timestamp) VALUES (?, ?, ?, ?, ?)",
            [userId, "daily_reward", totalReward, `Daily reward (base: ${baseReward}, streak: ${streakBonus})`, now]
          );
          
          resolve({
            success: true,
            message: `You claimed your daily reward of ${totalReward} Dublooms! (${baseReward} base + ${streakBonus} streak bonus)`,
            reward: totalReward
          });
        }
      );
    });
  }

  // Calculate streak bonus for daily rewards
  calculateStreakBonus(lastRewardTime, currentTime) {
    if (!lastRewardTime) return 0;
    
    const oneDayMs = 24 * 60 * 60 * 1000;
    const twoDaysMs = 2 * oneDayMs;
    const daysDifference = Math.floor((currentTime - lastRewardTime) / oneDayMs);
    
    // If the last reward was claimed approximately 1 day ago (within 2 days), it's a streak
    if (daysDifference >= 1 && daysDifference < 2) {
      // Get current streak count from transaction history
      return new Promise((resolve, reject) => {
        db.all(
          "SELECT * FROM transaction_history WHERE user_id = ? AND transaction_type = 'daily_reward' ORDER BY timestamp DESC LIMIT 30",
          [userId],
          (err, rows) => {
            if (err) return reject(err);
            
            let streakCount = 1; // Start with 1 for today
            let lastTimestamp = currentTime;
            
            for (const row of rows) {
              const daysBetween = Math.floor((lastTimestamp - row.timestamp) / oneDayMs);
              
              if (daysBetween === 1) {
                // Consecutive day, increment streak
                streakCount++;
                lastTimestamp = row.timestamp;
              } else if (daysBetween > 1) {
                // Streak broken
                break;
              }
            }
            
            // Bonus is 5 coins per day of streak, capped at 50
            const bonus = Math.min(streakCount * 5, 50);
            resolve(bonus);
          }
        );
      });
    }
    
    // No streak if more than 2 days since last reward
    return 0;
  }

  // Get user's inventory
  async getUserInventory(userId) {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM user_inventory WHERE user_id = ?", [userId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  // Add item to user's inventory
  async addInventoryItem(userId, itemId, quantity = 1, durability = null) {
    const now = Date.now();
    
    // Check if item already exists in inventory
    const inventory = await this.getUserInventory(userId);
    const existingItem = inventory.find(item => item.item_id === itemId);
    
    if (existingItem && durability === null) {
      // Update quantity for stackable items
      return new Promise((resolve, reject) => {
        db.run(
          "UPDATE user_inventory SET quantity = quantity + ? WHERE id = ?",
          [quantity, existingItem.id],
          function(err) {
            if (err) return reject(err);
            
            resolve({
              ...existingItem,
              quantity: existingItem.quantity + quantity
            });
          }
        );
      });
    } else {
      // Add new item
      return new Promise((resolve, reject) => {
        db.run(
          "INSERT INTO user_inventory (user_id, item_id, quantity, durability, acquired_at) VALUES (?, ?, ?, ?, ?)",
          [userId, itemId, quantity, durability, now],
          function(err) {
            if (err) return reject(err);
            
            resolve({
              id: this.lastID,
              user_id: userId,
              item_id: itemId,
              quantity,
              durability,
              acquired_at: now
            });
          }
        );
      });
    }
  }

  // Remove item from user's inventory
  async removeInventoryItem(userId, itemId, quantity = 1) {
    const inventory = await this.getUserInventory(userId);
    const existingItem = inventory.find(item => item.item_id === itemId);
    
    if (!existingItem || existingItem.quantity < quantity) {
      throw new Error("Not enough items in inventory");
    }
    
    if (existingItem.quantity > quantity) {
      // Update quantity
      return new Promise((resolve, reject) => {
        db.run(
          "UPDATE user_inventory SET quantity = quantity - ? WHERE id = ?",
          [quantity, existingItem.id],
          function(err) {
            if (err) return reject(err);
            
            resolve({
              ...existingItem,
              quantity: existingItem.quantity - quantity
            });
          }
        );
      });
    } else {
      // Remove item entirely
      return new Promise((resolve, reject) => {
        db.run(
          "DELETE FROM user_inventory WHERE id = ?",
          [existingItem.id],
          function(err) {
            if (err) return reject(err);
            
            resolve({ removed: true });
          }
        );
      });
    }
  }

  // Shop functionality
  getShopCatalog(category = null) {
    if (category) {
      // Filter catalog by category
      const filteredCatalog = {};
      
      for (const [itemId, item] of Object.entries(this.shopCatalog)) {
        if (item.category === category) {
          filteredCatalog[itemId] = item;
        }
      }
      
      return filteredCatalog;
    }
    
    return this.shopCatalog;
  }

  // Buy item from shop
  async buyItem(userId, itemId, quantity = 1) {
    const item = this.shopCatalog[itemId];
    
    if (!item) {
      throw new Error("Item not found in shop catalog");
    }
    
    const totalCost = item.price * quantity;
    const economy = await this.getUserEconomy(userId);
    
    if (economy.dublooms < totalCost) {
      throw new Error("Not enough Dublooms to purchase this item");
    }
    
    // Deduct dublooms
    await this.updateDublooms(userId, -totalCost);
    
    // Add item to inventory
    const durability = item.durability || null;
    await this.addInventoryItem(userId, itemId, quantity, durability);
    
    // Log transaction
    const now = Date.now();
    await new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO transaction_history (user_id, transaction_type, amount, details, timestamp) VALUES (?, ?, ?, ?, ?)",
        [userId, "purchase", totalCost, `Purchased ${quantity}x ${item.name}`, now],
        function(err) {
          if (err) return reject(err);
          resolve();
        }
      );
    });
    
    return {
      success: true,
      message: `You purchased ${quantity}x ${item.name} for ${totalCost} Dublooms!`,
      item,
      quantity,
      totalCost
    };
  }

  // Marketplace functionality
  async getMarketplaceListings(category = null) {
    let sql = "SELECT * FROM marketplace_listings";
    const params = [];
    
    if (category) {
      sql += " WHERE item_id IN (SELECT item_id FROM user_inventory WHERE category = ?)";
      params.push(category);
    }
    
    sql += " ORDER BY listed_at DESC";
    
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  // Create marketplace listing
  async createListing(userId, itemId, quantity, price) {
    // Verify user has the item
    try {
      await this.removeInventoryItem(userId, itemId, quantity);
    } catch (error) {
      throw new Error("You don't have enough of this item to list");
    }
    
    const now = Date.now();
    
    return new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO marketplace_listings (seller_id, item_id, quantity, price, listed_at) VALUES (?, ?, ?, ?, ?)",
        [userId, itemId, quantity, price, now],
        function(err) {
          if (err) {
            // Try to return the item to inventory if listing fails
            try {
              this.addInventoryItem(userId, itemId, quantity);
            } catch (returnError) {
              console.error("Failed to return item to inventory:", returnError);
            }
            
            return reject(err);
          }
          
          resolve({
            id: this.lastID,
            seller_id: userId,
            item_id: itemId,
            quantity,
            price,
            listed_at: now
          });
        }
      );
    });
  }

  // Buy from marketplace
  async buyFromMarketplace(userId, listingId) {
    // Get listing details
    const listing = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM marketplace_listings WHERE id = ?", [listingId], (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error("Listing not found"));
        resolve(row);
      });
    });
    
    // Verify user has enough dublooms
    const economy = await this.getUserEconomy(userId);
    
    if (economy.dublooms < listing.price) {
      throw new Error("Not enough Dublooms to purchase this listing");
    }
    
    // Deduct dublooms from buyer
    await this.updateDublooms(userId, -listing.price);
    
    // Add dublooms to seller
    await this.updateDublooms(listing.seller_id, listing.price);
    
    // Add item to buyer's inventory
    await this.addInventoryItem(userId, listing.item_id, listing.quantity);
    
    // Remove listing
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM marketplace_listings WHERE id = ?", [listingId], function(err) {
        if (err) return reject(err);
        resolve();
      });
    });
    
    // Log transaction
    const now = Date.now();
    await new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO transaction_history (user_id, transaction_type, amount, details, timestamp) VALUES (?, ?, ?, ?, ?)",
        [userId, "marketplace_purchase", listing.price, `Purchased listing #${listingId}`, now],
        function(err) {
          if (err) return reject(err);
          resolve();
        }
      );
    });
    
    return {
      success: true,
      message: `You purchased ${listing.quantity}x of item ${listing.item_id} for ${listing.price} Dublooms!`,
      listing
    };
  }
}

module.exports = new EconomySystem();