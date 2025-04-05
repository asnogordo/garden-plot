// src/mechanics/weather.js
const { db } = require('../database');
const config = require('../config');

// Define weather types and their effects
const weatherTypes = {
  "☀️": {
    name: "Sunny",
    description: "Clear skies and warm sunshine.",
    effects: {
      waterLoss: 2.0, // Plants lose water faster
      growthRate: 1.2, // Plants grow 20% faster
      specialPlants: ["sunflower", "tomato"] // Plants that grow especially well in sun
    }
  },
  "🌧️": {
    name: "Rainy",
    description: "Gentle rain showers.",
    effects: {
      waterGain: 1.5, // Plants gain water from rain
      growthRate: 1.1, // Plants grow 10% faster
      specialPlants: ["mushroom", "fern", "carrot"] // Plants that grow well in rain
    }
  },
  "🌪️": {
    name: "Windy",
    description: "Strong gusts of wind.",
    effects: {
      waterLoss: 1.5, // Plants lose water faster
      healthRisk: 0.1, // 10% chance of plant damage
      specialPlants: ["dandelion"] // Plants that benefit from wind
    }
  },
  "⛈️": {
    name: "Stormy",
    description: "Thunder and lightning storms.",
    effects: {
      waterGain: 2.0, // Plants gain lots of water
      healthRisk: 0.2, // 20% chance of plant damage
      specialEvent: "lightning" // Can trigger special events
    }
  },
  "🌫️": {
    name: "Foggy",
    description: "Misty and mysterious.",
    effects: {
      growthRate: 0.9, // Plants grow slower
      reduceWaterLoss: true, // Plants lose water more slowly
      specialEvent: "mystery" // Chance of finding rare seeds
    }
  },
  "🌈": {
    name: "Rainbow",
    description: "A beautiful rainbow appears.",
    effects: {
      growthRate: 1.5, // Plants grow much faster
      qualityBoost: 1.2, // Harvests have 20% higher quality
      specialEvent: "blessing" // Special rewards
    },
    rarity: "rare" // This is a rare weather pattern
  },
  "❄️": {
    name: "Frost",
    description: "Cold and frosty conditions.",
    effects: {
      growthRate: 0.7, // Plants grow much slower
      healthRisk: 0.15, // 15% chance of plant damage
      specialPlants: ["winter_berry", "pine"] // Plants that thrive in cold
    },
    seasonal: "winter" // Only appears in winter
  }
};

// Define seasons and their properties
const seasons = {
  "spring": {
    name: "Spring",
    weatherProbabilities: {
      "☀️": 0.3, "🌧️": 0.4, "🌪️": 0.15, "⛈️": 0.1, "🌫️": 0.03, "🌈": 0.02
    },
    specialPlants: ["tulip", "daisy", "strawberry"],
    growthMultiplier: 1.2 // Plants grow 20% faster in spring
  },
  "summer": {
    name: "Summer",
    weatherProbabilities: {
      "☀️": 0.5, "🌧️": 0.2, "🌪️": 0.1, "⛈️": 0.15, "🌫️": 0.03, "🌈": 0.02
    },
    specialPlants: ["sunflower", "tomato", "watermelon"],
    growthMultiplier: 1.1 // Plants grow 10% faster in summer
  },
  "fall": {
    name: "Fall",
    weatherProbabilities: {
      "☀️": 0.25, "🌧️": 0.3, "🌪️": 0.25, "⛈️": 0.1, "🌫️": 0.08, "🌈": 0.02
    },
    specialPlants: ["pumpkin", "corn", "mushroom"],
    growthMultiplier: 1.0 // Normal growth in fall
  },
  "winter": {
    name: "Winter",
    weatherProbabilities: {
      "☀️": 0.2, "🌧️": 0.15, "🌪️": 0.15, "⛈️": 0.05, "🌫️": 0.15, "❄️": 0.28, "🌈": 0.02
    },
    specialPlants: ["holly", "pine", "winter_berry"],
    growthMultiplier: 0.8 // Plants grow 20% slower in winter
  }
};

class WeatherSystem {
  constructor() {
    this.initDatabase();
    this.weatherTypes = weatherTypes;
    this.seasons = seasons;
  }

  initDatabase() {
    db.serialize(() => {
      // Create weather table
      db.run(`CREATE TABLE IF NOT EXISTS weather (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        current_weather TEXT,
        current_season TEXT,
        last_updated INTEGER,
        forecast TEXT
      )`);
    });
  }

  // Get the current weather
  async getCurrentWeather() {
    return new Promise((resolve, reject) => {
      db.get("SELECT * FROM weather WHERE id = 1", (err, row) => {
        if (err) return reject(err);
        
        if (row) {
          // Check if weather needs updating
          const now = Date.now();
          const hoursSinceUpdate = (now - row.last_updated) / (1000 * 60 * 60);
          
          if (hoursSinceUpdate >= 3) { // Weather changes every 3 hours
            this.updateWeather()
              .then(weather => resolve(weather))
              .catch(err => reject(err));
          } else {
            resolve({
              weather: row.current_weather,
              season: row.current_season,
              forecast: row.forecast ? JSON.parse(row.forecast) : []
            });
          }
        } else {
          // No weather record, create initial weather
          this.updateWeather()
            .then(weather => resolve(weather))
            .catch(err => reject(err));
        }
      });
    });
  }

  // Update the weather based on season and randomness
  async updateWeather() {
    const now = Date.now();
    
    // Determine current season based on real date
    const currentSeason = this.getCurrentSeason();
    
    // Select weather based on seasonal probabilities
    const weather = this.selectWeatherByProbability(currentSeason);
    
    // Generate forecast for next 3 days
    const forecast = this.generateForecast(currentSeason, 3);
    
    return new Promise((resolve, reject) => {
      db.run(
        "INSERT OR REPLACE INTO weather (id, current_weather, current_season, last_updated, forecast) VALUES (1, ?, ?, ?, ?)",
        [weather, currentSeason, now, JSON.stringify(forecast)],
        function(err) {
          if (err) return reject(err);
          
          resolve({
            weather,
            season: currentSeason,
            forecast
          });
        }
      );
    });
  }

  // Get current season based on real date
  getCurrentSeason() {
    const date = new Date();
    const month = date.getMonth();
    
    // Northern hemisphere seasons
    if (month >= 2 && month <= 4) return "spring"; // March to May
    if (month >= 5 && month <= 7) return "summer"; // June to August
    if (month >= 8 && month <= 10) return "fall";   // September to November
    return "winter";                               // December to February
  }

  // Select a weather type based on seasonal probabilities
  selectWeatherByProbability(season) {
    const probabilities = this.seasons[season].weatherProbabilities;
    const roll = Math.random();
    
    let cumulativeProbability = 0;
    for (const [weather, probability] of Object.entries(probabilities)) {
      cumulativeProbability += probability;
      if (roll < cumulativeProbability) {
        return weather;
      }
    }
    
    // Default to sunny if something goes wrong
    return "☀️";
  }

  // Generate a weather forecast for the specified number of days
  generateForecast(season, days) {
    const forecast = [];
    const now = Date.now();
    
    for (let i = 0; i < days; i++) {
      forecast.push({
        timestamp: now + (i + 1) * 24 * 60 * 60 * 1000, // Next day
        weather: this.selectWeatherByProbability(season)
      });
    }
    
    return forecast;
  }

  // Get weather effect description
  getWeatherEffectDescription(weatherType) {
    const weather = this.weatherTypes[weatherType];
    if (!weather) return "No special effects";
    
    let effectDescription = "";
    const effects = weather.effects;
    
    if (effects.waterGain) {
      effectDescription += `Plants gain water. `;
    }
    if (effects.waterLoss) {
      effectDescription += `Plants lose water faster. `;
    }
    if (effects.growthRate > 1) {
      effectDescription += `Plants grow ${Math.round((effects.growthRate - 1) * 100)}% faster. `;
    } else if (effects.growthRate < 1) {
      effectDescription += `Plants grow ${Math.round((1 - effects.growthRate) * 100)}% slower. `;
    }
    if (effects.healthRisk) {
      effectDescription += `${Math.round(effects.healthRisk * 100)}% chance of plant damage. `;
    }
    if (effects.qualityBoost) {
      effectDescription += `Harvests have ${Math.round((effects.qualityBoost - 1) * 100)}% higher quality. `;
    }
    if (effects.specialEvent) {
      effectDescription += `Special events may occur. `;
    }
    if (effects.specialPlants && effects.specialPlants.length > 0) {
      effectDescription += `Good for ${effects.specialPlants.join(", ")}. `;
    }
    
    return effectDescription.trim();
  }

  // Apply weather effects to a specific plot
  async applyWeatherEffects(userId) {
    const { weather } = await this.getCurrentWeather();
    const weatherEffects = this.weatherTypes[weather].effects;
    
    // Fetch plot and items from plot system
    // This would be implemented in conjunction with the plot system
    
    return {
      weather,
      effects: weatherEffects,
      description: this.getWeatherEffectDescription(weather)
    };
  }
}

module.exports = new WeatherSystem();