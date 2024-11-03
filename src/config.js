require('dotenv').config();

module.exports = {
  // Discord Bot Configuration
  BOT_TOKEN: process.env.BOT_TOKEN,
  DISCORD_CLIENT_ID: process.env.CLIENT_ID,

  // Channel IDs
  GM_CHANNEL_ID: process.env.GM_CHANNEL_ID,
  SUPPORT_CHANNEL_ID: process.env.SUPPORT_TICKET_CHANNEL_ID,
  PLOT_CHANNEL_ID: process.env.PLOT_CHANNEL_ID,
  CHANNEL_ID: process.env.PLOT_NOTIFICATION_CHANNEL_ID,

  // Role IDs
  BASE_ROLE_ID: process.env.BASE_ROLE_ID,

  // Bot Behavior Configuration
  POLL_INTERVAL: 120000, // Poll every 120 seconds

  // Garden System Configuration
  GARDEN_DB_PATH: process.env.GARDEN_DB_PATH || './garden.db',
  MAX_GARDEN_SIZE: 50,
  WEATHER_CHANGE_INTERVAL: 86400000, // 24 hours in milliseconds

  // Weather Types
  WEATHER_TYPES: ['☀️', '🌧️', '🌪️', '⛈️', '🌫️', '🌈'],
};

