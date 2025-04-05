// src/commands/shop.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const economySystem = require('../mechanics/economy');
const config = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Visit the garden shop to buy seeds and tools')
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('Browse the shop catalog'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('buy')
        .setDescription('Purchase an item from the shop')
        .addStringOption(option =>
          option
            .setName('item')
            .setDescription('The item to purchase')
            .setRequired(true)
            .setAutocomplete(true))
        .addIntegerOption(option => 
          option
            .setName('quantity')
            .setDescription('Quantity to purchase (default: 1)')
            .setRequired(false)
            .setMinValue(1))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    try {
      switch (subcommand) {
        case 'view':
          await handleViewCommand(interaction);
          break;
        case 'buy':
          await handleBuyCommand(interaction);
          break;
        default:
          await interaction.reply('Unknown subcommand');
      }
    } catch (error) {
      console.error('Error in shop command:', error);
      await interaction.reply({ 
        content: `An error occurred: ${error.message}`, 
        ephemeral: true 
      });
    }
  },

  // Autocomplete handler for item selection
  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    
    if (focusedOption.name === 'item') {
      try {
        // Get shop catalog
        const catalog = economySystem.getShopCatalog();
        
        const choices = Object.entries(catalog)
          .map(([itemId, item]) => {
            return {
              name: `${item.emoji} ${item.name} (${item.price} ${config.DUBLOOM_EMOJI})`,
              value: itemId
            };
          });
        
        await interaction.respond(choices);
      } catch (error) {
        console.error('Error in shop autocomplete:', error);
        await interaction.respond([
          { name: "Error fetching shop items", value: "error" }
        ]);
      }
    }
  }
};

// Command handlers
async function handleViewCommand(interaction) {
  try {
    // Get user's economy data
    const economy = await economySystem.getUserEconomy(interaction.user.id);
    
    // Get shop catalog
    const catalog = economySystem.getShopCatalog();
    
    // Create embed
    const embed = new EmbedBuilder()
      .setColor(config.COLORS.SHOP)
      .setTitle('🏪 Garden Shop')
      .setDescription(`Welcome to the Garden Shop! You have ${economy.dublooms} ${config.DUBLOOM_EMOJI}`)
      .setFooter({ text: 'Use /shop buy to purchase items!' });
    
    // Organize items by category
    const categories = {};
    
    for (const [itemId, item] of Object.entries(catalog)) {
      if (!categories[item.category]) {
        categories[item.category] = [];
      }
      
      categories[item.category].push({
        id: itemId,
        ...item
      });
    }
    
    // Add fields for each category
    if (categories.seed) {
      embed.addFields({
        name: '🌱 Seeds',
        value: categories.seed.map(item => 
          `${item.emoji} **${item.name}**: ${item.price} ${config.DUBLOOM_EMOJI}`
        ).join('\n')
      });
    }
    
    if (categories.tool) {
      embed.addFields({
        name: '🧰 Tools',
        value: categories.tool.map(item => 
          `${item.emoji} **${item.name}**: ${item.price} ${config.DUBLOOM_EMOJI}`
        ).join('\n')
      });
    }
    
    if (categories.decoration) {
      embed.addFields({
        name: '🪴 Decorations',
        value: categories.decoration.map(item => 
          `${item.emoji} **${item.name}**: ${item.price} ${config.DUBLOOM_EMOJI}`
        ).join('\n')
      });
    }
    
    if (categories.upgrade) {
      embed.addFields({
        name: '⬆️ Upgrades',
        value: categories.upgrade.map(item => 
          `${item.emoji} **${item.name}**: ${item.price} ${config.DUBLOOM_EMOJI}`
        ).join('\n')
      });
    }
    
    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Error displaying shop:', error);
    await interaction.reply(`Error displaying shop: ${error.message}`);
  }
}

async function handleBuyCommand(interaction) {
  const userId = interaction.user.id;
  const itemId = interaction.options.getString('item');
  const quantity = interaction.options.getInteger('quantity') || 1; // Default to 1 if not specified
  
  // Check for "error" value from autocomplete
  if (itemId === "error") {
    await interaction.reply({
      content: "There was an error loading shop items. Please try again.",
      ephemeral: true
    });
    return;
  }
  
  try {
    // Attempt to buy the item
    const result = await economySystem.buyItem(userId, itemId, quantity);
    
    if (result.success) {
      const embed = new EmbedBuilder()
        .setColor(config.COLORS.SUCCESS)
        .setTitle('Purchase Successful')
        .setDescription(result.message)
        .addFields(
          { name: 'Item', value: `${result.item.emoji} ${result.item.name}`, inline: true },
          { name: 'Quantity', value: `${quantity}`, inline: true },
          { name: 'Cost', value: `${result.totalCost} ${config.DUBLOOM_EMOJI}`, inline: true }
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
      content: `Error purchasing item: ${error.message}`,
      ephemeral: true
    });
  }
}