require('dotenv').config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { handleMessage } = require('./messageHandlers');
const { REST, Routes } = require('discord.js');
const gardenSystem = require('./gardenSystem');
const weatherSystem = require('./weather');



const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
  } else {
      console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: client.commands.map(command => command.data.toJSON()) },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  await weatherSystem.checkAndUpdateForecast();
  setInterval(async () => {
    await weatherSystem.checkAndUpdateForecast();
  }, config.WEATHER_CHANGE_INTERVAL);
});

client.on('messageCreate', handleMessage);

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) return;

  try {
      await command.execute(interaction);
  } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
  }
});

client.login(process.env.BOT_TOKEN).catch(err => {
  console.error('Failed to login:', err);
});

function isAboveBaseRole(member) {
  console.log(`Checking permissions for user: ${member.user.tag}`);
  
  const baseRole = member.guild.roles.cache.get(config.BASE_ROLE_ID);
  if (!baseRole) {
    console.log(`Base role with ID ${config.BASE_ROLE_ID} not found in the guild.`);
    return false;
  }
  
  console.log(`Base role: ${baseRole.name} (Position: ${baseRole.position})`);
  console.log(`User's highest role: ${member.roles.highest.name} (Position: ${member.roles.highest.position})`);
  
  const isAbove = member.roles.highest.position > baseRole.position;
  console.log(`Is user's role above base role? ${isAbove}`);
  
  return isAbove;
}