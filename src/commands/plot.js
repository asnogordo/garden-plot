// src/commands/plot.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const plotSystem = require('../mechanics/plot');
const plantSystem = require('../mechanics/plants');
const weatherSystem = require('../mechanics/weather');
const economySystem = require('../mechanics/economy');
const displayManager = require('../utils/displayManager');
const config = require('../config'); // Add this line

module.exports = {
  data: new SlashCommandBuilder()
    .setName('plot')
    .setDescription('Manage your garden plot')
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View your garden plot'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('plant')
        .setDescription('Plant a seed in your garden')
        .addStringOption(option =>
          option
            .setName('seed')
            .setDescription('The type of seed to plant')
            .setRequired(true)
            .setAutocomplete(true))
        .addIntegerOption(option =>
          option
            .setName('x')
            .setDescription('X coordinate (0-based)')
            .setRequired(true)
            .setMinValue(0))
        .addIntegerOption(option =>
          option
            .setName('y')
            .setDescription('Y coordinate (0-based)')
            .setRequired(true)
            .setMinValue(0)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('water')
        .setDescription('Water your plants')
        .addIntegerOption(option =>
          option
            .setName('x')
            .setDescription('X coordinate (0-based)')
            .setRequired(true)
            .setMinValue(0))
        .addIntegerOption(option =>
          option
            .setName('y')
            .setDescription('Y coordinate (0-based)')
            .setRequired(true)
            .setMinValue(0)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('harvest')
        .setDescription('Harvest a plant')
        .addIntegerOption(option =>
          option
            .setName('x')
            .setDescription('X coordinate (0-based)')
            .setRequired(true)
            .setMinValue(0))
        .addIntegerOption(option =>
          option
            .setName('y')
            .setDescription('Y coordinate (0-based)')
            .setRequired(true)
            .setMinValue(0)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('info')
        .setDescription('Get information about an item in your plot')
        .addIntegerOption(option =>
          option
            .setName('x')
            .setDescription('X coordinate (0-based)')
            .setRequired(true)
            .setMinValue(0))
        .addIntegerOption(option =>
          option
            .setName('y')
            .setDescription('Y coordinate (0-based)')
            .setRequired(true)
            .setMinValue(0)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('improve')
        .setDescription('Improve soil quality at a specific location')
        .addIntegerOption(option =>
          option
            .setName('x')
            .setDescription('X coordinate (0-based)')
            .setRequired(true)
            .setMinValue(0))
        .addIntegerOption(option =>
          option
            .setName('y')
            .setDescription('Y coordinate (0-based)')
            .setRequired(true)
            .setMinValue(0))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    try {
      // Update all plants before handling command
      await plantSystem.updateAllPlants(userId);
      
      switch (subcommand) {
        case 'view':
          await handleViewCommand(interaction);
          break;
        case 'plant':
          await handlePlantCommand(interaction);
          break;
        case 'water':
          await handleWaterCommand(interaction);
          break;
        case 'harvest':
          await handleHarvestCommand(interaction);
          break;
        case 'info':
          await handleInfoCommand(interaction);
          break;
        case 'improve':
          await handleImproveCommand(interaction);
          break;
        default:
          await interaction.reply('Unknown subcommand');
      }
    } catch (error) {
      console.error('Error in plot command:', error);
      await interaction.reply({ 
        content: `An error occurred: ${error.message}`, 
        ephemeral: true 
      });
    }
  },

  // Autocomplete handler for seed selection
  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    const userId = interaction.user.id;
    
    if (focusedOption.name === 'seed') {
      try {
        // Get user's seeds
        const userSeeds = await plantSystem.getUserSeeds(userId);
        
        if (Object.keys(userSeeds).length === 0) {
          return interaction.respond([
            { name: "You don't have any seeds. Visit the shop to buy some!", value: "none" }
          ]);
        }
        
        const seedChoices = Object.entries(userSeeds)
          .filter(([seedId, seed]) => seed.quantity > 0)
          .map(([seedId, seed]) => {
            const plantDetails = plantSystem.getPlantDetails(seedId);
            const name = plantDetails ? 
              `${plantDetails.emoji} ${plantDetails.name} (${seed.quantity})` : 
              `${seedId} (${seed.quantity})`;
            
            return {
              name: name.slice(0, 100), // Discord limits option names to 100 chars
              value: seedId
            };
          });
        
        await interaction.respond(seedChoices);
      } catch (error) {
        console.error('Error in autocomplete:', error);
        await interaction.respond([
          { name: "Error fetching seeds", value: "error" }
        ]);
      }
    }
  }
};

// Command handlers
async function handleViewCommand(interaction) {
  const userId = interaction.user.id;
  
  // Defer reply as this might take a moment
  await interaction.deferReply();
  
  try {
    // Get current weather
    const { weather, season } = await weatherSystem.getCurrentWeather();
    
    // Render the plot
    const plotDisplay = await plotSystem.renderPlot(userId);
    
    // Get user's economy data
    const economy = await economySystem.getUserEconomy(userId);
    
    // Create embed
    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle(`${interaction.user.username}'s Garden Plot`)
      .setDescription(plotDisplay)
      .addFields(
        { name: 'Season', value: `${season.charAt(0).toUpperCase() + season.slice(1)}`, inline: true },
        { name: 'Weather', value: `${weather}`, inline: true },
        { name: 'Dublooms', value: `${economy.dublooms} ${config.DUBLOOM_EMOJI}`, inline: true }
      )
      .setFooter({ text: 'Use /plot plant to plant seeds, /plot water to water plants, and /plot harvest to collect rewards!' });
    
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error rendering plot:', error);
    await interaction.editReply(`Error displaying your plot: ${error.message}`);
  }
}

async function handlePlantCommand(interaction) {
  const userId = interaction.user.id;
  const seedId = interaction.options.getString('seed');
  const x = interaction.options.getInteger('x');
  const y = interaction.options.getInteger('y');
  
  // Check for "none" value from autocomplete
  if (seedId === "none" || seedId === "error") {
    await interaction.reply({
      content: "You don't have any seeds to plant. Visit the shop to buy some!",
      ephemeral: true
    });
    return;
  }
  
  try {
    // Plant the seed
    const result = await plantSystem.plantSeed(userId, seedId, x, y);
    
    // Get plant details for the embed
    const plantDetails = plantSystem.getPlantDetails(seedId);
    
    if (result.success) {
      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('Seed Planted')
        .setDescription(`You planted a ${plantDetails.emoji} ${plantDetails.name} at coordinates (${x}, ${y})!`)
        .addFields(
          { name: 'Growth Time', value: formatDuration(plantDetails.growthStages[0].duration) }
        );
      
      await interaction.reply({ embeds: [embed] });
    } else {
      await interaction.reply({
        content: result.message,
        ephemeral: true
      });
    }
  } catch (error) {
    await interaction.reply({
      content: `Error planting seed: ${error.message}`,
      ephemeral: true
    });
  }
}

async function handleWaterCommand(interaction) {
  const userId = interaction.user.id;
  const x = interaction.options.getInteger('x');
  const y = interaction.options.getInteger('y');
  
  try {
    // Get the item at the specified position
    const item = await plotSystem.getPlotItemAtPosition(userId, x, y);
    
    if (!item || item.item_type !== 'plant') {
      await interaction.reply({
        content: "There's no plant at this location to water.",
        ephemeral: true
      });
      return;
    }
    
    // Water the plant
    const result = await plantSystem.waterPlant(userId, item.id);
    
    if (result.success) {
      const plantDetails = plantSystem.getPlantDetails(item.item_id);
      
      const embed = new EmbedBuilder()
        .setColor('#1E90FF')
        .setTitle('Plant Watered')
        .setDescription(`You watered your ${plantDetails.emoji} ${plantDetails.name}!`)
        .addFields(
          { name: 'New Water Level', value: `${result.newWaterLevel}%` }
        );
      
      await interaction.reply({ embeds: [embed] });
    } else {
      await interaction.reply({
        content: result.message,
        ephemeral: true
      });
    }
  } catch (error) {
    await interaction.reply({
      content: `Error watering plant: ${error.message}`,
      ephemeral: true
    });
  }
}

async function handleHarvestCommand(interaction) {
  const userId = interaction.user.id;
  const x = interaction.options.getInteger('x');
  const y = interaction.options.getInteger('y');
  
  try {
    // Get the item at the specified position
    const item = await plotSystem.getPlotItemAtPosition(userId, x, y);
    
    if (!item || item.item_type !== 'plant') {
      await interaction.reply({
        content: "There's no plant at this location to harvest.",
        ephemeral: true
      });
      return;
    }
    
    // Attempt to harvest
    const result = await plantSystem.harvestPlant(userId, item.id);
    
    if (result.success) {
      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('Plant Harvested')
        .setDescription(result.message);
      
      // Add reward fields
      if (result.rewards.dublooms) {
        embed.addFields({ name: 'Dublooms', value: `${result.rewards.dublooms} ${config.DUBLOOM_EMOJI}`, inline: true });
      }
      
      if (result.rewards.seeds) {
        embed.addFields({ name: 'Seeds', value: `${result.rewards.seeds} 🌱`, inline: true });
      }
      
      if (result.rewards.experience) {
        embed.addFields({ name: 'Experience', value: `${result.rewards.experience} ⭐`, inline: true });
      }
      
      if (result.rewards.fruit) {
        embed.addFields({ 
          name: 'Fruit', 
          value: `${result.rewards.fruit.emoji} ${result.rewards.fruit.name}`, 
          inline: true 
        });
      }
      
      await interaction.reply({ embeds: [embed] });
    } else {
      await interaction.reply({
        content: result.message,
        ephemeral: true
      });
    }
  } catch (error) {
    await interaction.reply({
      content: `Error harvesting plant: ${error.message}`,
      ephemeral: true
    });
  }
}

async function handleInfoCommand(interaction) {
  const userId = interaction.user.id;
  const x = interaction.options.getInteger('x');
  const y = interaction.options.getInteger('y');
  
  try {
    // Get the item at the specified position
    const item = await plotSystem.getPlotItemAtPosition(userId, x, y);
    
    if (!item) {
      // Get plot to check soil information
      const plot = await plotSystem.getPlot(userId);
      const soilType = plot.soil_quality[`${x},${y}`] || "normal";
      
      const embed = new EmbedBuilder()
        .setColor('#8B4513')
        .setTitle('Soil Information')
        .setDescription(`This plot at (${x}, ${y}) is empty.`)
        .addFields(
          { name: 'Soil Type', value: soilType.charAt(0).toUpperCase() + soilType.slice(1) },
          { name: 'Description', value: getSoilDescription(soilType) }
        );
      
      await interaction.reply({ embeds: [embed] });
      return;
    }
    
    // Handle different item types
    if (item.item_type === 'plant') {
      const plantDetails = plantSystem.getPlantDetails(item.item_id);
      const currentStage = plantDetails.growthStages[item.growth_stage];
      const nextStage = item.growth_stage < plantDetails.growthStages.length - 1 ? 
        plantDetails.growthStages[item.growth_stage + 1] : null;
      
      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle(`${plantDetails.name} ${plantDetails.emoji}`)
        .setDescription(`Location: (${x}, ${y})`)
        .addFields(
          { name: 'Growth Stage', value: `${currentStage.name} ${currentStage.emoji}`, inline: true },
          { name: 'Health', value: `${item.health}%`, inline: true },
          { name: 'Water Level', value: `${item.water_level}%`, inline: true }
        );
      
      if (nextStage) {
        const timeRemaining = calculateTimeRemaining(item);
        embed.addFields({ 
          name: 'Next Stage', 
          value: `${nextStage.name} ${nextStage.emoji} in ${formatDuration(timeRemaining)}` 
        });
      } else if (currentStage.harvestable) {
        embed.addFields({ name: 'Status', value: 'Ready to harvest! 🌟' });
      } else {
        embed.addFields({ name: 'Status', value: 'Fully grown' });
      }
      
      await interaction.reply({ embeds: [embed] });
    } else if (item.item_type === 'decoration') {
      // Handle decoration info
      const embed = new EmbedBuilder()
        .setColor('#9370DB')
        .setTitle(`Decoration`)
        .setDescription(`There's a decoration at (${x}, ${y})`)
        .addFields(
          { name: 'Type', value: item.item_id }
        );
      
      await interaction.reply({ embeds: [embed] });
    } else {
      await interaction.reply({
        content: `Unknown item type at this location.`,
        ephemeral: true
      });
    }
  } catch (error) {
    await interaction.reply({
      content: `Error getting item info: ${error.message}`,
      ephemeral: true
    });
  }
}

async function handleImproveCommand(interaction) {
  const userId = interaction.user.id;
  const x = interaction.options.getInteger('x');
  const y = interaction.options.getInteger('y');
  
  try {
    // Check if user has fertilizer
    const inventory = await economySystem.getUserInventory(userId);
    const fertilizerItem = inventory.find(item => item.item_id === 'fertilizer' && item.quantity > 0);
    
    if (!fertilizerItem) {
      await interaction.reply({
        content: "You need fertilizer to improve soil. Visit the shop to buy some!",
        ephemeral: true
      });
      return;
    }
    
    // Get the current soil type
    const plot = await plotSystem.getPlot(userId);
    const currentSoil = plot.soil_quality[`${x},${y}`] || "normal";
    
    if (currentSoil === "fertile") {
      await interaction.reply({
        content: "This soil is already at the highest quality level!",
        ephemeral: true
      });
      return;
    }
    
    // Use fertilizer
    await economySystem.removeInventoryItem(userId, 'fertilizer', 1);
    
    // Improve soil
    const updatedPlot = await plotSystem.improveSoilQuality(userId, x, y);
    const newSoil = updatedPlot.soil_quality[`${x},${y}`];
    
    const embed = new EmbedBuilder()
      .setColor('#8B4513')
      .setTitle('Soil Improved')
      .setDescription(`You used fertilizer to improve the soil at (${x}, ${y})!`)
      .addFields(
        { name: 'Previous Soil', value: currentSoil.charAt(0).toUpperCase() + currentSoil.slice(1) },
        { name: 'New Soil', value: newSoil.charAt(0).toUpperCase() + newSoil.slice(1) },
        { name: 'Fertilizer Left', value: `${fertilizerItem.quantity - 1}` }
      );
    
    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    await interaction.reply({
      content: `Error improving soil: ${error.message}`,
      ephemeral: true
    });
  }
}

// Helper function to calculate time remaining until next growth stage
function calculateTimeRemaining(plantItem) {
  const now = Date.now();
  const plantId = plantItem.item_id;
  const plant = plantSystem.getPlantDetails(plantId);
  
  if (!plant) return 0;
  
  const currentStage = plantItem.growth_stage;
  const stageDefinition = plant.growthStages[currentStage];
  
  if (!stageDefinition || !stageDefinition.duration) return 0;
  
  const elapsedTime = now - plantItem.last_updated;
  const timeRemaining = Math.max(0, stageDefinition.duration - elapsedTime);
  
  return timeRemaining;
}

// Helper function to format duration
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${seconds}s`;
  }
}

// Helper function to get soil description
function getSoilDescription(soilType) {
  switch (soilType) {
    case 'poor':
      return 'Poor soil. Plants grow slowly and produce fewer rewards.';
    case 'normal':
      return 'Average soil quality. Plants grow at normal rates.';
    case 'fertile':
      return 'Rich, fertile soil. Plants grow faster and produce better rewards!';
    default:
      return 'Unknown soil type.';
  }
}