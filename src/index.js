// src/index.js
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { db, close } = require('./database');
const plantSystem = require('./mechanics/plants');
const weatherSystem = require('./mechanics/weather');
const economySystem = require('./mechanics/economy');
const plotSystem = require('./mechanics/plot');

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

// Collection to store commands
client.commands = new Collection();

// Load command files
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Register commands
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    console.log(`Loaded command: ${command.data.name}`);
  } else {
    console.warn(`Command at ${filePath} is missing required properties`);
  }
}

// Register slash commands with Discord API
async function registerCommands() {
  const commands = client.commands.map(command => command.data.toJSON());
  
  const rest = new REST({ version: '10' }).setToken(config.BOT_TOKEN);
  
  try {
    console.log(`Started registering ${commands.length} application commands.`);
    
    let data;
    if (config.GUILD_ID) {
      // Register guild-specific commands (faster for development)
      data = await rest.put(
        Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID),
        { body: commands }
      );
    } else {
      // Register global commands (takes up to an hour to update)
      data = await rest.put(
        Routes.applicationCommands(config.CLIENT_ID),
        { body: commands }
      );
    }
    
    console.log(`Successfully registered ${data.length} application commands.`);
  } catch (error) {
    console.error('Error registering application commands:', error);
  }
}

// Event Handlers
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  console.log(`Bot is ready and serving ${client.guilds.cache.size} servers.`);
  
  // Set bot status
  client.user.setPresence({
    status: 'online',
    activities: [{
      name: '🌱 PLOT | /help',
      type: 'PLAYING'
    }]
  });
  
  // Register commands
  await registerCommands();
  
  // Start game systems
  startGameSystems();
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isCommand()) {
      await handleCommandInteraction(interaction);
    } else if (interaction.isAutocomplete()) {
      await handleAutocompleteInteraction(interaction);
    } else if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
    
    // Attempt to respond to the interaction if it hasn't been responded to yet
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'An error occurred while processing your request.',
        ephemeral: true
      });
    }
  }
});

// Handle slash command interactions
async function handleCommandInteraction(interaction) {
  const command = client.commands.get(interaction.commandName);
  
  if (!command) {
    console.error(`Command ${interaction.commandName} not found`);
    return;
  }
  
  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing command ${interaction.commandName}:`, error);
    
    const errorMessage = config.DEBUG_MODE
      ? `Error: ${error.message}`
      : 'An error occurred while executing this command.';
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: errorMessage,
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: errorMessage,
        ephemeral: true
      });
    }
  }
}

// Handle autocomplete interactions
async function handleAutocompleteInteraction(interaction) {
  const command = client.commands.get(interaction.commandName);
  
  if (!command || !command.autocomplete) return;
  
  try {
    await command.autocomplete(interaction);
  } catch (error) {
    console.error(`Error handling autocomplete for ${interaction.commandName}:`, error);
  }
}

// Handle button interactions
async function handleButtonInteraction(interaction) {
  // Extract the command name and any data from the button customId
  // Format: commandName:data
  const [commandName, ...dataParts] = interaction.customId.split(':');
  const data = dataParts.join(':');
  
  const command = client.commands.get(commandName);
  
  if (!command || !command.handleButton) {
    console.error(`Button handler for ${commandName} not found`);
    return;
  }
  
  try {
    await command.handleButton(interaction, data);
  } catch (error) {
    console.error(`Error handling button for ${commandName}:`, error);
    
    if (!interaction.replied) {
      await interaction.reply({
        content: 'An error occurred while processing your request.',
        ephemeral: true
      });
    }
  }
}

// Start game systems and scheduled tasks
function startGameSystems() {
  console.log('Starting game systems...');
  
  // Check plant growth periodically
  setInterval(async () => {
    try {
      // This would need to be optimized for a real bot with many users
      // Ideally, you'd only update plants that need updating
      console.log('Checking plant growth...');
      
      // Get all active users (with plants)
      const activePlots = await db.query(
        "SELECT DISTINCT plot_id FROM plot_items WHERE item_type = 'plant'"
      );
      
      for (const plot of activePlots) {
        await plantSystem.updateAllPlants(plot.plot_id);
      }
    } catch (error) {
      console.error('Error in plant growth check:', error);
    }
  }, config.GROWTH_CHECK_INTERVAL);
  
  // Check and update weather
  setInterval(async () => {
    try {
      console.log('Checking weather...');
      await weatherSystem.updateWeather();
    } catch (error) {
      console.error('Error in weather update:', error);
    }
  }, config.WEATHER_CHANGE_INTERVAL);
}

// Error handling
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
  
  // In a production environment, you might want to attempt a graceful shutdown
  if (config.NODE_ENV === 'production') {
    console.error('Uncaught exception detected. Attempting graceful shutdown...');
    
    // Close database connections
    close();
    
    // Logout of Discord
    client.destroy();
    
    // Exit process
    process.exit(1);
  }
});

// Login to Discord
client.login(config.BOT_TOKEN).catch(error => {
  console.error('Error logging in to Discord:', error);
  process.exit(1);
});