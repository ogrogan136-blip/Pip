'use strict';
/*
 * weather.js — seasons and weather.
 * A year has four seasons of 5 days each. The weather changes every few
 * minutes depending on the season, and changes how warm it is, how crops
 * grow, and what Pip needs to do to get by.
 */

const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const SEASON_INFO = {
  spring: { icon: '🌸', label: 'Spring', temp: 0 },
  summer: { icon: '🌞', label: 'Summer', temp: 10 },
  autumn: { icon: '🍂', label: 'Autumn', temp: -5 },
  winter: { icon: '❄️', label: 'Winter', temp: -20 },
};
const WEATHER_INFO = {
  sunny:    { icon: '☀️', label: 'Sunny', temp: 2 },
  cloudy:   { icon: '☁️', label: 'Cloudy', temp: -2 },
  rain:     { icon: '🌧️', label: 'Rain', temp: -4 },
  thunder:  { icon: '⛈️', label: 'Thunderstorm', temp: -4 },
  snow:     { icon: '🌨️', label: 'Snow', temp: -8 },
  heatwave: { icon: '🥵', label: 'Heatwave', temp: 18 },
};
// how likely each weather is in each season
const WEATHER_CHANCE = {
  spring: { sunny: 4, cloudy: 3, rain: 4, thunder: 1 },
  summer: { sunny: 5, cloudy: 1, rain: 1, thunder: 2, heatwave: 3 },
  autumn: { sunny: 2, cloudy: 4, rain: 4, thunder: 2 },
  winter: { cloudy: 3, snow: 5, sunny: 2 },
};
// how well each crop grows in each season (0 = not at all)
const CROP_SEASONS = {
  lettuce: { spring: 1.2, summer: 0.5, autumn: 1.1, winter: 0 },
  berry:   { spring: 1, summer: 1.3, autumn: 0.5, winter: 0 },
  cotton:  { spring: 0.6, summer: 1.4, autumn: 0.6, winter: 0 },
  flower:  { spring: 1.3, summer: 1, autumn: 0.4, winter: 0 },
  default: { spring: 1, summer: 1, autumn: 0.7, winter: 0 },
};
const DAYS_PER_SEASON = 5;

// Mixed into World
const Weather = {
  get seasonLength() { return this.dayLength * DAYS_PER_SEASON; },
  get season() { return SEASONS[Math.floor(this.time / this.seasonLength) % 4]; },
  get year() { return Math.floor(this.time / (this.seasonLength * 4)) + 1; },
  // 0..1 through the current season
  get seasonProgress() { return (this.time % this.seasonLength) / this.seasonLength; },

  temperature() {
    return SEASON_INFO[this.season].temp + (WEATHER_INFO[this.weather || 'sunny'] || WEATHER_INFO.sunny).temp;
  },

  cropGrowth(type) {
    const t = CROP_SEASONS[type] || CROP_SEASONS.default;
    let g = t[this.season];
    if (this.weather === 'heatwave' && type === 'lettuce') g *= 0.4;
    if (this.weather === 'snow') g = 0;
    return g;
  },

  updateWeather(dt) {
    if (!this.weather) { this.weather = 'sunny'; this.weatherTimer = 120; }
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      const table = WEATHER_CHANCE[this.season];
      let r = Math.random() * Object.values(table).reduce((a, b) => a + b, 0);
      let next = 'sunny';
      for (const [w, n] of Object.entries(table)) { r -= n; if (r <= 0) { next = w; break; } }
      if (next !== this.weather) this.events.push({ kind: 'weather', weather: next, from: this.weather });
      this.weather = next;
      this.weatherTimer = 150 + Math.random() * 200;
    }
    // snow settles in snowy weather and melts otherwise
    const target = this.weather === 'snow' ? 1 : this.season === 'winter' ? 0.35 : 0;
    this.snowCover = (this.snowCover || 0) + clamp(target - (this.snowCover || 0), -dt / 120, dt / 90);
    // rain waters seedlings for Pip
    if (this.weather === 'rain' || this.weather === 'thunder') for (const o of this.objects) if (o.type === 'seedling') o.water = Math.max(o.water || 0, 90);
    // a new season?
    const s = this.season;
    if (this.lastSeason && s !== this.lastSeason) this.events.push({ kind: 'season', season: s, from: this.lastSeason });
    this.lastSeason = s;
    // lightning flashes during storms
    if (this.weather === 'thunder' && Math.random() < dt / 9) { this.flash = 0.35; this.events.push({ kind: 'thunderclap' }); }
    if (this.flash > 0) this.flash -= dt;
  },
};
Object.defineProperties(World.prototype, Object.getOwnPropertyDescriptors(Weather));
