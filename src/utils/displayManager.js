// src/utils/displayManager.js
const plantSystem = require('../mechanics/plants');

class DisplayManager {
  constructor() {
    // Emoji sets for different plot elements
    this.soilEmojis = {
      "poor": "🟤",    // Brown square for poor soil
      "normal": "🟫",  // Brown square for normal soil
      "fertile": "🟢"  // Green circle for fertile soil
    };
    
    // Border characters for plot rendering
    this.borders = {
      topLeft: "+",
      topRight: "+",
      bottomLeft: "+",
      bottomRight: "+",
      horizontal: "-",
      vertical: "|",
      coordinates: false // Set to false to disable coordinates
    };
  }

  // Generate a text-based display of the user's plot
generatePlotDisplay(plot, plotItems) {
  const size = plot.size;
  const display = [];
  
  // Add top border
  let topBorder = this.borders.topLeft + this.borders.horizontal.repeat(size * 2 - 1) + this.borders.topRight;
  display.push(topBorder);
  
  // Generate each row of the plot
  for (let y = 0; y < size; y++) {
    let row = this.borders.vertical;
    
    for (let x = 0; x < size; x++) {
      // Check if there's an item at this position
      const item = plotItems.find(item => item.x === x && item.y === y);
      
      if (item) {
        // Render the item
        if (item.item_type === "plant") {
          const plantId = item.item_id;
          const plant = plantSystem.getPlantDetails(plantId);
          
          if (plant) {
            const stageEmoji = plant.growthStages[item.growth_stage]?.emoji || "❓";
            row += stageEmoji;
          } else {
            row += "🌱"; // Default plant emoji if details not found
          }
        } else if (item.item_type === "decoration") {
          row += item.item_id; // Decoration emoji
        } else {
          row += "❓"; // Unknown item type
        }
      } else {
        // Render empty soil
        const soilType = plot.soil_quality[`${x},${y}`] || "normal";
        row += this.soilEmojis[soilType];
      }
      
      // Add spacing between cells (except the last one)
      if (x < size - 1) {
        row += " ";
      }
    }
    
    row += this.borders.vertical;
    display.push(row);
  }
  
  // Add bottom border
  let bottomBorder = this.borders.bottomLeft + this.borders.horizontal.repeat(size * 2 - 1) + this.borders.bottomRight;
  display.push(bottomBorder);
  
  return display.join("\n");
}

  // Generate plant info display
  generatePlantInfoDisplay(plantId, stage = 0) {
    const plant = plantSystem.getPlantDetails(plantId);
    if (!plant) return "Plant not found";
    
    const stageInfo = plant.growthStages[stage];
    const display = [];
    
    display.push(`🌱 **${plant.name}** (${plant.emoji})`);
    display.push(`Current Stage: ${stageInfo.name} ${stageInfo.emoji}`);
    
    if (stage < plant.growthStages.length - 1) {
      const nextStage = plant.growthStages[stage + 1];
      const hours = nextStage.duration / (60 * 60 * 1000);
      display.push(`Next Stage: ${nextStage.name} ${nextStage.emoji} (${hours} hours)`);
    } else {
      display.push(`Final Stage: ${stageInfo.name} ${stageInfo.emoji}`);
    }
    
    display.push(`Water Needs: ${plant.waterNeeds}%`);
    display.push(`Soil Preference: ${plant.soilPreference}`);
    display.push(`Weather Preference: ${plant.weatherPreference}`);
    
    if (plant.harvestReward) {
      display.push("\n**Rewards:**");
      if (plant.harvestReward.coins) {
        display.push(`- ${plant.harvestReward.coins} coins 💰`);
      }
      if (plant.harvestReward.seeds) {
        display.push(`- ${plant.harvestReward.seeds} seeds 🌱`);
      }
      if (plant.harvestReward.experience) {
        display.push(`- ${plant.harvestReward.experience} XP ⭐`);
      }
      if (plant.harvestReward.fruit) {
        display.push(`- ${plant.harvestReward.fruit.name} ${plant.harvestReward.fruit.emoji}`);
      }
    }
    
    return display.join("\n");
  }

  // Generate inventory display
  generateInventoryDisplay(seeds, resources = null) {
    const display = [];
    
    display.push("**🌱 Seeds:**");
    
    if (Object.keys(seeds).length === 0) {
      display.push("You don't have any seeds yet.");
    } else {
      for (const [plantId, seed] of Object.entries(seeds)) {
        const plantDetails = seed.details || plantSystem.getPlantDetails(plantId);
        if (plantDetails) {
          display.push(`- ${plantDetails.emoji} ${plantDetails.name}: ${seed.quantity}`);
        } else {
          display.push(`- ${plantId}: ${seed.quantity}`);
        }
      }
    }
    
    if (resources) {
      display.push("\n**🧰 Resources:**");
      for (const [resourceId, quantity] of Object.entries(resources)) {
        display.push(`- ${resourceId}: ${quantity}`);
      }
    }
    
    return display.join("\n");
  }

  // Generate weather forecast display
  generateWeatherForecastDisplay(weather, forecast) {
    const display = [];
    
    display.push(`**Current Weather: ${weather}**`);
    display.push(`Forecast for the next ${forecast.length} days:`);
    
    forecast.forEach((day, index) => {
      const date = new Date(day.timestamp);
      display.push(`- Day ${index + 1} (${date.toDateString()}): ${day.weather}`);
    });
    
    return display.join("\n");
  }

  // Generate user stats display
  generateUserStatsDisplay(user, plot) {
    const display = [];
    
    display.push(`**${user.username}'s Garden Stats**`);
    display.push(`Gardener Level: ${plot.plot_level} (${plot.experience}/${plot.plot_level * 100} XP)`);
    display.push(`Plot Size: ${plot.size}x${plot.size}`);
    display.push(`Plants Grown: ${user.plants_grown || 0}`);
    display.push(`Total Harvests: ${user.harvests || 0}`);
    display.push(`Garden Started: ${new Date(plot.created_at).toLocaleDateString()}`);
    
    return display.join("\n");
  }

  // Generate marketplace display
  generateMarketplaceDisplay(listings) {
    const display = [];
    
    display.push("**🏪 Marketplace**");
    
    if (listings.length === 0) {
      display.push("No listings available at the moment.");
    } else {
      display.push("Available items for purchase:");
      
      listings.forEach(listing => {
        display.push(`- ${listing.emoji} ${listing.name}: ${listing.price} Dublooms 💰`);
      });
    }
    
    return display.join("\n");
  }

  // Create a Discord embed for plant information
  createPlantEmbed(plantId, stage = 0) {
    // This would return a Discord.js embed object with plant details
    // Implement when integrating with Discord.js
    const plantInfo = this.generatePlantInfoDisplay(plantId, stage);
    
    return {
      title: `Plant Information`,
      description: plantInfo,
      color: 0x00FF00 // Green color
    };
  }
}

module.exports = new DisplayManager();