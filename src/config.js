// src/config.js
require('dotenv').config();

module.exports = {
  // Discord Bot Configuration
  BOT_TOKEN: process.env.BOT_TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  GUILD_ID: process.env.GUILD_ID, // Optional: for guild-specific commands

  // Database Configuration
  DB_PATH: process.env.DB_PATH || './plot.db',
  
  // Game Configuration
  MAX_PLOT_SIZE: 10, // Maximum plot size a user can expand to
  DEFAULT_PLOT_SIZE: 5, // Starting plot size
  DEFAULT_DUBLOOMS: 100, // Starting dublooms for new users
  DUBLOOM_EMOJI: "🌸💰", // Custom emoji for currency (flower + money bag)
  
  // Plant Growth Configuration
  WATER_DECAY_RATE: 5, // How fast water level decreases (% per day)
  GROWTH_CHECK_INTERVAL: 15 * 60 * 1000, // Check plant growth every 15 minutes
  
  // Weather Configuration
  WEATHER_CHANGE_INTERVAL: 3 * 60 * 60 * 1000, // Weather changes every 3 hours
  
  // Economy Configuration
  DAILY_REWARD_AMOUNT: 25, // Base daily reward amount
  MAX_STREAK_BONUS: 50, // Maximum bonus from daily reward streak
  MARKETPLACE_LISTING_FEE: 0.05, // 5% fee on marketplace sales
  
  // Social Features
  VISIT_REWARD: 5, // Dublooms for visiting another user's garden
  WATER_FRIEND_REWARD: 2, // Dublooms for watering another user's plants
  
  // Achievement System
  ACHIEVEMENTS: [
    {
      id: 'first_plant',
      name: 'First Sprout',
      description: 'Plant your first seed',
      reward: 25, // Dublooms
    },
    {
      id: 'master_gardener',
      name: 'Master Gardener',
      description: 'Reach gardener level 10',
      reward: 500, // Dublooms
    },
    {
      id: 'seed_collector',
      name: 'Seed Collector',
      description: 'Discover 10 different types of seeds',
      reward: 100, // Dublooms
    },
    {
      id: 'harvest_king',
      name: 'Harvest King',
      description: 'Harvest 100 plants',
      reward: 250, // Dublooms
    },
    {
      id: 'weather_watcher',
      name: 'Weather Watcher',
      description: 'Experience all types of weather',
      reward: 150, // Dublooms
    }
  ],
  
  // Embed Colors
  COLORS: {
    PRIMARY: '#33A03B', // Green
    SUCCESS: '#00FF00', // Bright green
    ERROR: '#FF0000', // Red
    INFO: '#0099FF', // Blue
    WARNING: '#FFA500', // Orange
    SHOP: '#9B59B6', // Purple
    WEATHER: '#87CEEB', // Sky Blue
    SOCIAL: '#FF69B4', // Pink
  },
  
  // Development Configuration
  DEBUG_MODE: process.env.DEBUG_MODE === 'true',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
};