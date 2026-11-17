/**
 * ==========================================================================
 * SKYCAST - Live Weather Dashboard
 * Automatic Location Weather & Popular Cities Upgrade
 * ==========================================================================
 * InternCircle Virtual Internship - Full Stack Web Development (Project 04)
 * 
 * Tech Stack:
 * - Vanilla JavaScript (ES6+)
 * - Fetch API with async/await
 * - Open-Meteo Geocoding API
 * - Open-Meteo Weather Forecast API
 * - Browser Geolocation API
 * - localStorage Persistence
 * ==========================================================================
 */

// Strict Mode prevents accidental globals and promotes cleaner execution
'use strict';

/* --------------------------------------------------------------------------
   1. API & LocalStorage Configuration
   -------------------------------------------------------------------------- */
const API_CONFIG = {
  // Geocoding endpoint converts city names into geographic coordinates
  GEOCODING_BASE_URL: 'https://geocoding-api.open-meteo.com/v1/search',

  // Weather Forecast API endpoint returns atmospheric measurements
  WEATHER_BASE_URL: 'https://api.open-meteo.com/v1/forecast',

  // Query defaults
  DEFAULT_COUNT: 1,
  DEFAULT_LANGUAGE: 'en',
  DEFAULT_FORMAT: 'json',

  // Explicit Unit Declarations (guarantees deterministic metric units)
  TEMPERATURE_UNIT: 'celsius',
  WIND_SPEED_UNIT: 'kmh',
  PRECIPITATION_UNIT: 'mm',

  // Current weather measurement fields including is_day for day/night scenes
  CURRENT_WEATHER_PARAMS: [
    'temperature_2m',
    'relative_humidity_2m',
    'apparent_temperature',
    'precipitation',
    'weather_code',
    'wind_speed_10m',
    'is_day'
  ].join(','),

  // Hourly forecast fields for 24-hour Google Weather-style graph
  HOURLY_WEATHER_PARAMS: [
    'temperature_2m',
    'weather_code',
    'precipitation_probability',
    'wind_speed_10m'
  ].join(','),

  // Daily forecast fields for 5-day daily forecast cards
  DAILY_WEATHER_PARAMS: [
    'weather_code',
    'temperature_2m_max',
    'temperature_2m_min'
  ].join(','),

  // Storage keys for localStorage persistence
  STORAGE_KEY_LAST_CITY: 'skycast_last_city',
  STORAGE_KEY_RECENT_SEARCHES: 'skycast_recent_searches',
  MAX_RECENT_SEARCHES: 6,
};

/* --------------------------------------------------------------------------
   2. DOM Element Selectors
   -------------------------------------------------------------------------- */
const DOM = {
  // Search Form Elements
  searchForm: document.getElementById('search-form'),
  cityInput: document.getElementById('city-input'),
  searchBtn: document.getElementById('search-btn'),
  geoBtn: document.getElementById('geo-btn'),
  searchSuggestions: document.getElementById('search-suggestions'),

  // Popular Cities Shortcuts
  popularCitiesList: document.getElementById('popular-cities-list'),

  // Recent Searches (Stage 4)
  recentSearchesContainer: document.getElementById('recent-searches-container'),
  recentTagsList: document.getElementById('recent-tags-list'),
  clearHistoryBtn: document.getElementById('clear-history-btn'),

  // Feedback & Status Elements
  statusMessage: document.getElementById('status-message'),
  loadingSpinner: document.getElementById('loading-spinner'),

  // Content Sections
  initialState: document.getElementById('initial-state'),
  welcomeGeoBtn: document.getElementById('welcome-geo-btn'),
  dashboardContent: document.getElementById('dashboard-content'),
  currentWeatherSection: document.getElementById('current-weather-section'),
  forecastSection: document.getElementById('forecast-section'),

  // Current Weather Display Elements
  currentCity: document.getElementById('current-city'),
  cardGeoAction: document.getElementById('card-geo-action'),
  currentDatetime: document.getElementById('current-datetime'),
  currentWeatherIcon: document.getElementById('current-weather-icon'),
  currentTemperature: document.getElementById('current-temperature'),
  currentConditionText: document.getElementById('current-condition-text'),

  // Detailed Meteorological Metrics
  metricFeelsLike: document.getElementById('metric-feels-like'),
  metricHumidity: document.getElementById('metric-humidity'),
  metricWindSpeed: document.getElementById('metric-wind-speed'),
  metricPrecipitation: document.getElementById('metric-precipitation'),

  // Hourly Weather Graph & Scroller
  hourlySection: document.getElementById('hourly-section'),
  hourlyGraphContainer: document.getElementById('hourly-graph-container'),

  // 5-Day Forecast Grid
  forecastHeading: document.getElementById('forecast-heading'),
  forecastCardsContainer: document.getElementById('forecast-cards-container'),
};

/* --------------------------------------------------------------------------
   3. Application State & Request Tracker
   -------------------------------------------------------------------------- */
const AppState = {
  activeCity: null,         // Holds { name, latitude, longitude, country, admin1, isGeolocation }
  weatherData: null,        // Holds current weather metrics
  forecastData: [],         // Holds 5-day daily forecast
  activeHourlyTab: 'temperature', // 'temperature' | 'precipitation' | 'wind'
  recentSearches: [],       // Reserved for Stage 4
  isLoading: false,         // Tracks active request state
};

// Counter used to discard out-of-order/stale asynchronous responses
let activeRequestId = 0;

/* --------------------------------------------------------------------------
   4. UI Status & Feedback Helpers
   -------------------------------------------------------------------------- */

/**
 * Display a feedback status banner (error or info) to the user.
 * @param {string} message - Text message to display
 * @param {'error'|'info'} [type='info'] - Style variant
 */
function showStatus(message, type = 'info', options = {}) {
  if (!DOM.statusMessage) return;

  DOM.statusMessage.innerHTML = '';
  const msgSpan = document.createElement('span');
  msgSpan.className = 'status-text';
  msgSpan.textContent = message;
  DOM.statusMessage.appendChild(msgSpan);

  if (type === 'error' && options.retryAction) {
    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'status-retry-btn';
    retryBtn.textContent = 'Try Again';
    retryBtn.addEventListener('click', () => {
      clearStatus();
      options.retryAction();
    });
    DOM.statusMessage.appendChild(retryBtn);
  }

  DOM.statusMessage.className = `status-message ${type}`;
  DOM.statusMessage.classList.remove('hidden');
}

/**
 * Hide and clear the feedback status banner.
 */
function clearStatus() {
  if (!DOM.statusMessage) return;

  DOM.statusMessage.textContent = '';
  DOM.statusMessage.className = 'status-message hidden';
}

/**
 * Toggle the loading spinner visibility and disable search/geo buttons to prevent spam.
 * Keeps the city input field editable for better user experience.
 * 
 * @param {boolean} isLoading - True to show, false to hide
 * @param {string} [loadingText='Fetching weather data...'] - Accessible status text
 */
function setLoading(isLoading, loadingText = 'Fetching weather data...') {
  AppState.isLoading = isLoading;

  if (DOM.searchBtn) {
    DOM.searchBtn.disabled = isLoading;
  }
  if (DOM.geoBtn) {
    DOM.geoBtn.disabled = isLoading;
  }
  if (DOM.cardGeoAction) {
    DOM.cardGeoAction.disabled = isLoading;
  }
  if (DOM.welcomeGeoBtn) {
    DOM.welcomeGeoBtn.disabled = isLoading;
  }

  if (!DOM.loadingSpinner) return;

  if (isLoading) {
    const textElement = DOM.loadingSpinner.querySelector ? DOM.loadingSpinner.querySelector('.loading-text') : null;
    if (textElement) textElement.textContent = loadingText;
    DOM.loadingSpinner.classList.remove('hidden');
  } else {
    DOM.loadingSpinner.classList.add('hidden');
  }
}

/* --------------------------------------------------------------------------
   5. Null-Safe Metric Formatters
   -------------------------------------------------------------------------- */

/**
 * Safely format a temperature measurement.
 * @param {number|null|undefined} val - Temperature value in Celsius
 * @returns {string} Formatted temperature (e.g., '18°C' or '--')
 */
function formatTemperature(val) {
  return (typeof val === 'number' && !isNaN(val)) ? `${Math.round(val)}°C` : '--';
}

/**
 * Safely format a percentage measurement.
 * @param {number|null|undefined} val - Percentage (0-100)
 * @returns {string} Formatted percentage (e.g., '65%' or '--')
 */
function formatPercentage(val) {
  return (typeof val === 'number' && !isNaN(val)) ? `${Math.round(val)}%` : '--';
}

/**
 * Safely format a speed measurement.
 * @param {number|null|undefined} val - Speed value in km/h
 * @returns {string} Formatted speed (e.g., '14 km/h' or '--')
 */
function formatSpeed(val) {
  return (typeof val === 'number' && !isNaN(val)) ? `${Math.round(val)} km/h` : '--';
}

/**
 * Safely format a precipitation measurement.
 * @param {number|null|undefined} val - Precipitation depth in mm
 * @returns {string} Formatted precipitation (e.g., '0.5 mm' or '--')
 */
function formatPrecipitation(val) {
  return (typeof val === 'number' && !isNaN(val)) ? `${val.toFixed(1)} mm` : '--';
}

/* --------------------------------------------------------------------------
   6. WMO Weather Code Interpreter & Animated Weather Stage
   -------------------------------------------------------------------------- */

/**
 * Get human-readable description and animated vector SVG scene for a weather state.
 * 
 * @param {number} code - WMO weather interpretation code (0-99)
 * @param {number} [isDay=1] - 1 for day, 0 for night (from Open-Meteo API)
 * @returns {{ description: string, iconSvg: string }}
 */
function getWmoInterpretation(code, isDay = 1) {
  const isNight = isDay === 0;

  // 1. NIGHT SCENE (Clear or Partly Cloudy at Night)
  if (isNight && (code === 0 || code === 1 || code === 2)) {
    return {
      description: code === 0 ? 'Clear Night' : 'Partly Cloudy Night',
      iconSvg: `
        <div class="weather-stage weather-stage-night" aria-hidden="true">
          <svg class="weather-art-svg" viewBox="0 0 140 140" fill="none">
            <!-- Twinkling Stars -->
            <circle class="anim-star anim-star-1" cx="30" cy="35" r="2" fill="#c084fc" />
            <circle class="anim-star anim-star-2" cx="110" cy="25" r="2.5" fill="#e0e7ff" />
            <circle class="anim-star anim-star-3" cx="95" cy="55" r="1.5" fill="#a5b4fc" />
            <circle class="anim-star anim-star-1" cx="20" cy="70" r="1.5" fill="#f8fafc" />
            <!-- Glowing Crescent Moon -->
            <path class="anim-moon-glow" d="M78 28C56 28 38 46 38 68C38 90 56 108 78 108C86 108 94 105 100 101C76 97 60 76 66 52C70 38 82 29 96 28C90 28 84 28 78 28Z" fill="url(#moonGrad)" />
            ${code > 0 ? `
            <!-- Drifting Night Cloud -->
            <g class="anim-cloud-drift anim-cloud-night">
              <path d="M45 92C45 84 52 78 60 78C62 74 67 70 73 70C81 70 87 76 88 83C91 83 95 86 95 90C95 94 91 97 87 97H49C47 97 45 95 45 92Z" fill="rgba(199, 210, 254, 0.75)" />
            </g>` : ''}
            <defs>
              <linearGradient id="moonGrad" x1="40" y1="30" x2="100" y2="105" gradientUnits="userSpaceOnUse">
                <stop stop-color="#fef08a" />
                <stop offset="1" stop-color="#f59e0b" />
              </linearGradient>
            </defs>
          </svg>
        </div>`,
    };
  }

  // 2. SUNNY / CLEAR DAY (Code 0)
  if (code === 0) {
    return {
      description: 'Sunny & Clear',
      iconSvg: `
        <div class="weather-stage weather-stage-sunny" aria-hidden="true">
          <svg class="weather-art-svg" viewBox="0 0 140 140" fill="none">
            <!-- Pulsing Solar Corona Halo -->
            <circle class="anim-sun-halo" cx="70" cy="70" r="48" fill="rgba(253, 224, 71, 0.2)" />
            <!-- Rotating Sun Rays -->
            <g class="anim-sun-rays" stroke="url(#sunRayGrad)" stroke-width="3.5" stroke-linecap="round">
              <line x1="70" y1="18" x2="70" y2="28" />
              <line x1="70" y1="112" x2="70" y2="122" />
              <line x1="18" y1="70" x2="28" y2="70" />
              <line x1="112" y1="70" x2="122" y2="70" />
              <line x1="33" y1="33" x2="40" y2="40" />
              <line x1="100" y1="100" x2="107" y2="107" />
              <line x1="33" y1="107" x2="40" y2="100" />
              <line x1="100" y1="40" x2="107" y2="33" />
            </g>
            <!-- Core Glowing Sun Sphere -->
            <circle class="anim-sun-core" cx="70" cy="70" r="28" fill="url(#sunCoreGrad)" />
            <defs>
              <linearGradient id="sunCoreGrad" x1="50" y1="50" x2="90" y2="90" gradientUnits="userSpaceOnUse">
                <stop stop-color="#fef08a" />
                <stop offset="1" stop-color="#f59e0b" />
              </linearGradient>
              <linearGradient id="sunRayGrad" x1="18" y1="18" x2="122" y2="122" gradientUnits="userSpaceOnUse">
                <stop stop-color="#fbbf24" />
                <stop offset="1" stop-color="#f59e0b" />
              </linearGradient>
            </defs>
          </svg>
        </div>`,
    };
  }

  // 3. PARTLY CLOUDY (Codes 1, 2)
  if (code === 1 || code === 2) {
    return {
      description: code === 1 ? 'Mainly Clear' : 'Partly Cloudy',
      iconSvg: `
        <div class="weather-stage weather-stage-partly-cloudy" aria-hidden="true">
          <svg class="weather-art-svg" viewBox="0 0 140 140" fill="none">
            <!-- Sun Peeking Through -->
            <circle class="anim-sun-halo" cx="88" cy="52" r="34" fill="rgba(253, 224, 71, 0.22)" />
            <circle class="anim-sun-core" cx="88" cy="52" r="22" fill="url(#sunCoreGrad)" />
            <!-- Primary Drifting White Cloud -->
            <g class="anim-cloud-drift">
              <path d="M40 98C40 86 50 76 62 76C64 70 70 65 77 65C87 65 95 73 96 83C102 83 107 88 107 94C107 100 102 105 96 105H46C42 105 40 102 40 98Z" fill="url(#cloudGrad1)" />
            </g>
            <defs>
              <linearGradient id="cloudGrad1" x1="40" y1="65" x2="105" y2="105" gradientUnits="userSpaceOnUse">
                <stop stop-color="#ffffff" />
                <stop offset="1" stop-color="#e0f2fe" />
              </linearGradient>
              <linearGradient id="sunCoreGrad" x1="70" y1="35" x2="105" y2="70" gradientUnits="userSpaceOnUse">
                <stop stop-color="#fef08a" />
                <stop offset="1" stop-color="#f59e0b" />
              </linearGradient>
            </defs>
          </svg>
        </div>`,
    };
  }

  // 4. CLOUDY / OVERCAST (Code 3, 45, 48)
  if (code === 3 || code === 45 || code === 48) {
    const isFog = code === 45 || code === 48;
    return {
      description: isFog ? 'Foggy Sky' : 'Overcast',
      iconSvg: `
        <div class="weather-stage weather-stage-cloudy" aria-hidden="true">
          <svg class="weather-art-svg" viewBox="0 0 140 140" fill="none">
            <!-- Background Cloud -->
            <g class="anim-cloud-drift-slow">
              <path d="M48 64C48 54 56 46 66 46C73 46 79 50 82 56C87 54 93 57 95 62C99 63 102 67 102 71C102 76 98 80 93 80H53C50 80 48 78 48 74Z" fill="#bae6fd" opacity="0.65" />
            </g>
            <!-- Foreground Billowing Cloud -->
            <g class="anim-cloud-drift">
              <path d="M34 94C34 81 44 70 57 70C60 63 67 58 75 58C86 58 95 67 96 77C103 78 108 83 108 90C108 97 102 102 95 102H41C37 102 34 98 34 94Z" fill="url(#cloudOvercastGrad)" />
            </g>
            ${isFog ? `
            <!-- Soft Horizontal Mist Bands -->
            <line class="anim-mist-1" x1="26" y1="108" x2="114" y2="108" stroke="#bae6fd" stroke-width="3" stroke-linecap="round" />
            <line class="anim-mist-2" x1="38" y1="116" x2="102" y2="116" stroke="#e0f2fe" stroke-width="2.5" stroke-linecap="round" />` : ''}
            <defs>
              <linearGradient id="cloudOvercastGrad" x1="34" y1="58" x2="108" y2="102" gradientUnits="userSpaceOnUse">
                <stop stop-color="#ffffff" />
                <stop offset="1" stop-color="#cbd5e1" />
              </linearGradient>
            </defs>
          </svg>
        </div>`,
    };
  }

  // 5. RAINY / SHOWERS / DRIZZLE (Codes 51-67, 80-82)
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    let desc = 'Rain';
    if (code >= 51 && code <= 57) desc = 'Gentle Drizzle';
    else if (code === 61 || code === 80) desc = 'Light Rain';
    else if (code === 63 || code === 81) desc = 'Moderate Rain';
    else if (code === 65 || code === 82) desc = 'Heavy Rain';

    return {
      description: desc,
      iconSvg: `
        <div class="weather-stage weather-stage-rain" aria-hidden="true">
          <svg class="weather-art-svg" viewBox="0 0 140 140" fill="none">
            <!-- Atmospheric Rain Cloud -->
            <path d="M36 68C36 56 46 46 58 46C61 40 68 36 76 36C87 36 96 44 97 54C103 55 108 60 108 67C108 74 102 79 95 79H43C39 79 36 75 36 68Z" fill="url(#rainCloudGrad)" />
            <!-- Animated Falling Raindrops -->
            <g class="anim-rain-container" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round">
              <line class="anim-raindrop anim-rain-1" x1="50" y1="88" x2="45" y2="102" />
              <line class="anim-raindrop anim-rain-2" x1="68" y1="86" x2="63" y2="100" />
              <line class="anim-raindrop anim-rain-3" x1="86" y1="88" x2="81" y2="102" />
              <line class="anim-raindrop anim-rain-4" x1="58" y1="102" x2="53" y2="116" />
              <line class="anim-raindrop anim-rain-5" x1="76" y1="100" x2="71" y2="114" />
              <line class="anim-raindrop anim-rain-6" x1="94" y1="98" x2="89" y2="112" />
            </g>
            <defs>
              <linearGradient id="rainCloudGrad" x1="36" y1="36" x2="108" y2="79" gradientUnits="userSpaceOnUse">
                <stop stop-color="#ffffff" />
                <stop offset="1" stop-color="#93c5fd" />
              </linearGradient>
            </defs>
          </svg>
        </div>`,
    };
  }

  // 6. SNOWY / FLURRIES (Codes 71-77, 85-86)
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    return {
      description: code >= 75 ? 'Heavy Snow' : 'Snow Flurries',
      iconSvg: `
        <div class="weather-stage weather-stage-snow" aria-hidden="true">
          <svg class="weather-art-svg" viewBox="0 0 140 140" fill="none">
            <!-- Frosty Cloud -->
            <path d="M36 65C36 54 45 44 57 44C60 38 67 34 75 34C86 34 95 42 96 52C102 53 107 58 107 65C107 72 101 77 94 77H43C39 77 36 73 36 65Z" fill="url(#snowCloudGrad)" />
            <!-- Animated Falling Snowflakes -->
            <g class="anim-snow-container" fill="#e0f2fe">
              <circle class="anim-snowflake anim-snow-1" cx="50" cy="88" r="3" />
              <circle class="anim-snowflake anim-snow-2" cx="72" cy="86" r="2.5" />
              <circle class="anim-snowflake anim-snow-3" cx="92" cy="90" r="3.2" />
              <circle class="anim-snowflake anim-snow-4" cx="60" cy="106" r="2.8" />
              <circle class="anim-snowflake anim-snow-5" cx="82" cy="108" r="2.2" />
            </g>
            <defs>
              <linearGradient id="snowCloudGrad" x1="36" y1="34" x2="107" y2="77" gradientUnits="userSpaceOnUse">
                <stop stop-color="#ffffff" />
                <stop offset="1" stop-color="#bfdbfe" />
              </linearGradient>
            </defs>
          </svg>
        </div>`,
    };
  }

  // 7. THUNDERSTORM (Codes 95-99)
  if (code >= 95 && code <= 99) {
    return {
      description: 'Thunderstorm',
      iconSvg: `
        <div class="weather-stage weather-stage-thunderstorm" aria-hidden="true">
          <svg class="weather-art-svg" viewBox="0 0 140 140" fill="none">
            <!-- Dark Atmospheric Storm Cloud -->
            <path d="M34 68C34 55 44 44 57 44C60 38 67 34 75 34C86 34 96 43 97 54C103 55 108 60 108 67C108 74 102 79 95 79H41C37 79 34 74 34 68Z" fill="url(#stormCloudGrad)" />
            <!-- Flashing Lightning Bolt -->
            <polygon class="anim-lightning" points="74 72 61 94 72 94 65 116 87 90 75 90 82 72" fill="#fbbf24" stroke="#f59e0b" stroke-width="1.5" stroke-linejoin="round" />
            <!-- Rain Streaks Under Cloud -->
            <line class="anim-raindrop anim-rain-1" x1="48" y1="84" x2="44" y2="98" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" />
            <line class="anim-raindrop anim-rain-3" x1="94" y1="84" x2="90" y2="98" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" />
            <defs>
              <linearGradient id="stormCloudGrad" x1="34" y1="34" x2="108" y2="79" gradientUnits="userSpaceOnUse">
                <stop stop-color="#64748b" />
                <stop offset="1" stop-color="#334155" />
              </linearGradient>
            </defs>
          </svg>
        </div>`,
    };
  }

  // 8. DEFAULT FALLBACK
  return {
    description: 'Cloudy',
    iconSvg: `
      <div class="weather-stage weather-stage-cloudy" aria-hidden="true">
        <svg class="weather-art-svg" viewBox="0 0 140 140" fill="none">
          <path d="M36 80C36 68 46 58 58 58C61 52 68 48 76 48C87 48 96 56 97 66C103 67 108 72 108 79C108 86 102 91 95 91H43C39 91 36 87 36 80Z" fill="#93c5fd" />
        </svg>
      </div>`,
  };
}

/**
 * Format an ISO wall-clock date-time string without timezone shifting.
 * 
 * @param {string} isoString - Date-time string (e.g., '2026-11-16T15:30')
 * @returns {string} Formatted timestamp (e.g., 'Monday, Nov 16, 3:30 PM')
 */
function formatDateTime(isoString) {
  if (!isoString || typeof isoString !== 'string') return '--';

  try {
    const match = isoString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return isoString;

    const [, year, month, day, hours, minutes] = match.map(Number);
    const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));

    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(utcDate);
  } catch {
    return isoString;
  }
}

/* --------------------------------------------------------------------------
   7. Milestone 3A: Open-Meteo Geocoding API
   -------------------------------------------------------------------------- */

/**
 * Look up geographic coordinates for a given city name via Open-Meteo Geocoding API.
 * 
 * @param {string} cityName - Name of the city to search for
 * @returns {Promise<{name: string, latitude: number, longitude: number, country: string, countryCode: string, admin1: string}>}
 */
async function findCity(cityName) {
  if (!cityName || typeof cityName !== 'string' || cityName.trim() === '') {
    throw new Error('Please enter a valid city name.');
  }

  const trimmedCity = cityName.trim();
  const encodedCity = encodeURIComponent(trimmedCity);
  const requestUrl = `${API_CONFIG.GEOCODING_BASE_URL}?name=${encodedCity}&count=${API_CONFIG.DEFAULT_COUNT}&language=${API_CONFIG.DEFAULT_LANGUAGE}&format=${API_CONFIG.DEFAULT_FORMAT}`;

  let response;
  try {
    response = await fetch(requestUrl);
  } catch (networkError) {
    throw new Error('Network error: Unable to connect to geocoding service. Please check your internet connection.');
  }

  if (!response.ok) {
    throw new Error(`Geocoding service error (${response.status}: ${response.statusText || 'Request failed'})`);
  }

  let data;
  try {
    data = await response.json();
  } catch (parseError) {
    throw new Error('Failed to parse geocoding service response.');
  }

  if (!data.results || !Array.isArray(data.results) || data.results.length === 0) {
    throw new Error(`City "${trimmedCity}" was not found. Please check spelling.`);
  }

  const primaryResult = data.results[0];

  return {
    name: primaryResult.name,
    latitude: primaryResult.latitude,
    longitude: primaryResult.longitude,
    country: primaryResult.country || '',
    countryCode: primaryResult.country_code || '',
    admin1: primaryResult.admin1 || '',
  };
}

/* --------------------------------------------------------------------------
   8. Milestone 3B: Open-Meteo Weather Forecast API (Current Weather)
   -------------------------------------------------------------------------- */

/**
 * Fetch real-time weather metrics for specified geographic coordinates.
 * Includes is_day parameter for day/night animated scenes.
 * 
 * @param {number} latitude - Latitude coordinate (-90 to 90)
 * @param {number} longitude - Longitude coordinate (-180 to 180)
 * @returns {Promise<{time: string, temperature_2m: number, relative_humidity_2m: number, apparent_temperature: number, precipitation: number, weather_code: number, wind_speed_10m: number, is_day: number}>}
 */
async function getWeather(latitude, longitude) {
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    isNaN(latitude) ||
    isNaN(longitude)
  ) {
    throw new Error('Invalid coordinates provided for weather forecast.');
  }

  const requestUrl = `${API_CONFIG.WEATHER_BASE_URL}?latitude=${latitude}&longitude=${longitude}&current=${API_CONFIG.CURRENT_WEATHER_PARAMS}&hourly=${API_CONFIG.HOURLY_WEATHER_PARAMS}&daily=${API_CONFIG.DAILY_WEATHER_PARAMS}&forecast_hours=24&temperature_unit=${API_CONFIG.TEMPERATURE_UNIT}&wind_speed_unit=${API_CONFIG.WIND_SPEED_UNIT}&precipitation_unit=${API_CONFIG.PRECIPITATION_UNIT}&timezone=auto`;

  let response;
  try {
    response = await fetch(requestUrl);
  } catch (networkError) {
    throw new Error('Network error: Unable to connect to weather forecast service. Please check your internet connection.');
  }

  if (!response.ok) {
    throw new Error(`Weather service error (${response.status}: ${response.statusText || 'Request failed'})`);
  }

  let data;
  try {
    data = await response.json();
  } catch (parseError) {
    throw new Error('Failed to parse weather forecast service response.');
  }

  if (!data || !data.current) {
    throw new Error('Weather metrics are currently unavailable for this location.');
  }

  return {
    ...data.current,
    current: data.current,
    hourly: data.hourly || null,
    daily: data.daily || null
  };
}

/**
 * Render compact SVG weather icons for hourly graph and daily forecast cards.
 * @param {number} code - WMO weather interpretation code
 * @param {number} [isDay=1] - Day (1) or Night (0)
 * @returns {string} Clean SVG vector markup string
 */
function getMiniWeatherIcon(code, isDay = 1) {
  const isNight = isDay === 0;

  if (isNight && (code === 0 || code === 1 || code === 2)) {
    return `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mini-icon mini-icon-night">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="#c084fc" stroke="#8b5cf6"></path>
    </svg>`;
  }

  if (code === 0) {
    return `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mini-icon mini-icon-sun">
      <circle cx="12" cy="12" r="5" fill="#fde047" stroke="#eab308"></circle>
      <line x1="12" y1="1" x2="12" y2="3" stroke="#eab308"></line>
      <line x1="12" y1="21" x2="12" y2="23" stroke="#eab308"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="#eab308"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="#eab308"></line>
      <line x1="1" y1="12" x2="3" y2="12" stroke="#eab308"></line>
      <line x1="21" y1="12" x2="23" y2="12" stroke="#eab308"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="#eab308"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="#eab308"></line>
    </svg>`;
  }

  if (code === 1 || code === 2) {
    return `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mini-icon mini-icon-partly-cloudy">
      <circle cx="12" cy="8" r="3.5" fill="#fde047" stroke="#eab308"></circle>
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" fill="#e2e8f0" stroke="#94a3b8"></path>
    </svg>`;
  }

  if (code === 3) {
    return `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mini-icon mini-icon-cloud">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" fill="#cbd5e1" stroke="#64748b"></path>
    </svg>`;
  }

  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mini-icon mini-icon-rain">
      <path d="M17.5 17H9a6 6 0 1 1 5.75-7.75A4 4 0 1 1 19 16.5" fill="#e2e8f0" stroke="#94a3b8"></path>
      <line x1="9" y1="19" x2="9" y2="21" stroke="#0ea5e9" stroke-width="2.5"></line>
      <line x1="13" y1="19" x2="13" y2="21" stroke="#0ea5e9" stroke-width="2.5"></line>
      <line x1="17" y1="19" x2="17" y2="21" stroke="#0ea5e9" stroke-width="2.5"></line>
    </svg>`;
  }

  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    return `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mini-icon mini-icon-snow">
      <path d="M17.5 17H9a6 6 0 1 1 5.75-7.75A4 4 0 1 1 19 16.5" fill="#f8fafc" stroke="#94a3b8"></path>
      <circle cx="9" cy="20" r="1.2" fill="#38bdf8"></circle>
      <circle cx="13" cy="20" r="1.2" fill="#38bdf8"></circle>
      <circle cx="17" cy="20" r="1.2" fill="#38bdf8"></circle>
    </svg>`;
  }

  if (code >= 95) {
    return `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mini-icon mini-icon-thunder">
      <path d="M17.5 15H9a6 6 0 1 1 5.75-7.75A4 4 0 1 1 19 14.5" fill="#cbd5e1" stroke="#64748b"></path>
      <polygon points="13 14 10 18 13 18 11 22 16 16 13 16 13 14" fill="#eab308" stroke="#ca8a04"></polygon>
    </svg>`;
  }

  return `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mini-icon mini-icon-default">
    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" fill="#e2e8f0" stroke="#94a3b8"></path>
  </svg>`;
}

/**
 * Render the Google Weather-inspired hourly trend graph using real Open-Meteo hourly data.
 * Generates an SVG cubic Bezier spline with gradient area fill and aligned hourly intervals.
 * 
 * @param {object} hourly - Hourly forecast data from Open-Meteo
 * @param {'temperature'|'precipitation'|'wind'} activeTab - Selected metric tab
 */
function renderHourly(hourly, activeTab = 'temperature') {
  if (!DOM.hourlyGraphContainer || !hourly || !Array.isArray(hourly.time) || hourly.time.length === 0) {
    return;
  }

  // Sample 8 data points spaced every 3 hours (covering ~21-24 hours like Google Weather)
  const sampleIndices = [0, 3, 6, 9, 12, 15, 18, 21].filter(idx => idx < hourly.time.length);
  if (sampleIndices.length < 2) return;

  const pointsData = sampleIndices.map((idx, stepIndex) => {
    const rawTime = hourly.time[idx] || '';
    const hourPart = rawTime.includes('T') ? rawTime.split('T')[1].slice(0, 2) : '12';
    const h = parseInt(hourPart, 10);
    const ampm = h >= 12 ? 'pm' : 'am';
    const displayH = (h % 12) || 12;
    const timeLabel = stepIndex === 0 ? 'Now' : `${displayH} ${ampm}`;

    let val = 0;
    let displayVal = '';

    if (activeTab === 'temperature') {
      val = typeof hourly.temperature_2m[idx] === 'number' ? hourly.temperature_2m[idx] : 0;
      displayVal = `${Math.round(val)}°`;
    } else if (activeTab === 'precipitation') {
      val = hourly.precipitation_probability ? (hourly.precipitation_probability[idx] || 0) : 0;
      displayVal = `${Math.round(val)}%`;
    } else { // wind
      val = hourly.wind_speed_10m ? (hourly.wind_speed_10m[idx] || 0) : 0;
      displayVal = `${Math.round(val)}`;
    }

    const code = hourly.weather_code ? hourly.weather_code[idx] : 0;
    return {
      val,
      displayVal,
      code,
      timeLabel,
      isCurrent: stepIndex === 0
    };
  });

  const width = 680;
  const height = 110;
  const count = pointsData.length;
  const stepX = width / count;

  let minVal = pointsData[0].val;
  let maxVal = pointsData[0].val;
  pointsData.forEach(p => {
    if (p.val < minVal) minVal = p.val;
    if (p.val > maxVal) maxVal = p.val;
  });

  const range = (maxVal - minVal) > 0 ? (maxVal - minVal) : 1;
  const padTop = 28;
  const padBottom = 20;
  const availH = height - padTop - padBottom;

  const svgPoints = pointsData.map((p, i) => {
    const x = i * stepX + (stepX / 2);
    const y = height - padBottom - ((p.val - minVal) / range) * availH;
    return { ...p, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  });

  // Calculate smooth cubic Bezier spline
  let pathD = `M ${svgPoints[0].x},${svgPoints[0].y}`;
  for (let i = 1; i < svgPoints.length; i++) {
    const p0 = svgPoints[i - 1];
    const p1 = svgPoints[i];
    const midX = (p0.x + p1.x) / 2;
    pathD += ` C ${midX},${p0.y} ${midX},${p1.y} ${p1.x},${p1.y}`;
  }
  const areaD = `${pathD} L ${svgPoints[svgPoints.length - 1].x},${height} L ${svgPoints[0].x},${height} Z`;

  let strokeColor = '#f59e0b'; // Google Weather warm amber for temperature
  let gradColor = '#f59e0b';
  if (activeTab === 'precipitation') {
    strokeColor = '#0284c7';
    gradColor = '#0284c7';
  } else if (activeTab === 'wind') {
    strokeColor = '#06b6d4';
    gradColor = '#06b6d4';
  }

  const svgMarkup = `
    <div class="hourly-graph-scroller">
      <svg class="hourly-spline-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="hourlyAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="${gradColor}" stop-opacity="0.32" />
            <stop offset="100%" stop-color="${gradColor}" stop-opacity="0.0" />
          </linearGradient>
        </defs>
        <path d="${areaD}" fill="url(#hourlyAreaGrad)" />
        <path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
        ${svgPoints.map(p => `
          <g class="graph-node ${p.isCurrent ? 'node-current' : ''}">
            <text x="${p.x}" y="${Math.max(16, p.y - 8)}" text-anchor="middle" class="node-val-text">${p.displayVal}</text>
            <circle cx="${p.x}" cy="${p.y}" r="3.5" class="node-dot" fill="#ffffff" stroke="${strokeColor}" stroke-width="2.2" />
          </g>
        `).join('')}
      </svg>
      <div class="hourly-bottom-row">
        ${svgPoints.map(p => `
          <div class="hourly-column ${p.isCurrent ? 'col-current' : ''}">
            <div class="hourly-icon-wrap" aria-hidden="true">
              ${getMiniWeatherIcon(p.code)}
            </div>
            <span class="hourly-time-text">${p.timeLabel}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  DOM.hourlyGraphContainer.innerHTML = svgMarkup;
}

/**
 * Render the Google Weather-inspired 5-day daily forecast cards.
 * Populates each card with real Open-Meteo daily data: day name, date, icon, condition, max/min temp.
 * 
 * @param {object} daily - Daily forecast data from Open-Meteo
 */
function renderForecast(daily) {
  if (!DOM.forecastCardsContainer || !daily || !Array.isArray(daily.time) || daily.time.length === 0) {
    if (DOM.forecastSection) DOM.forecastSection.classList.add('hidden');
    return;
  }

  // Render 5 daily forecast cards (Days 0 to 4: Today and upcoming 4 days)
  const daysCount = Math.min(5, daily.time.length);

  // Compute week temperature span for proportional Apple-style range spectrum
  const weekMins = daily.temperature_2m_min.slice(0, daysCount).filter(v => typeof v === 'number');
  const weekMaxs = daily.temperature_2m_max.slice(0, daysCount).filter(v => typeof v === 'number');
  const weekMin = weekMins.length > 0 ? Math.floor(Math.min(...weekMins)) : 15;
  const weekMax = weekMaxs.length > 0 ? Math.ceil(Math.max(...weekMaxs)) : 35;
  const weekSpan = (weekMax - weekMin) > 0 ? (weekMax - weekMin) : 1;

  const currentTemp = AppState.weatherData && typeof AppState.weatherData.temperature_2m === 'number'
    ? AppState.weatherData.temperature_2m
    : null;

  const cardsHtml = [];

  for (let i = 0; i < daysCount; i++) {
    const rawDate = daily.time[i];
    const parts = rawDate.split('-').map(Number);
    const dateObj = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));

    const dayName = i === 0 ? 'Today' : dateObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

    const code = Array.isArray(daily.weather_code) ? daily.weather_code[i] : 0;
    const condition = getWmoInterpretation(code, 1);
    const iconSvg = getMiniWeatherIcon(code, 1);

    const minRaw = daily.temperature_2m_min ? daily.temperature_2m_min[i] : null;
    const maxRaw = daily.temperature_2m_max ? daily.temperature_2m_max[i] : null;

    const maxTemp = formatTemperature(maxRaw);
    const minTemp = formatTemperature(minRaw);

    // Calculate spectrum bar dimensions
    const validMin = typeof minRaw === 'number' ? minRaw : weekMin;
    const validMax = typeof maxRaw === 'number' ? maxRaw : weekMax;
    const leftPct = Math.max(0, Math.min(100, ((validMin - weekMin) / weekSpan) * 100));
    const widthPct = Math.max(14, Math.min(100 - leftPct, ((validMax - validMin) / weekSpan) * 100));

    // For Today: current temperature dot on the spectrum bar
    let currentDotHtml = '';
    if (i === 0 && currentTemp !== null) {
      const currPct = Math.max(2, Math.min(98, ((currentTemp - weekMin) / weekSpan) * 100));
      currentDotHtml = `<span class="spectrum-curr-dot" style="left: ${currPct.toFixed(1)}%;" title="Current: ${Math.round(currentTemp)}°C"></span>`;
    }

    cardsHtml.push(`
      <article class="forecast-card ${i === 0 ? 'card-active-day' : ''}" tabindex="0" aria-label="${dayName}, ${formattedDate}: ${condition.description}, Low ${minTemp}, High ${maxTemp}">
        <div class="forecast-day-cell">
          <span class="forecast-day-name">${dayName}</span>
          <span class="forecast-date-sub">${formattedDate}</span>
        </div>

        <div class="forecast-visual-cell">
          <div class="forecast-icon-box" aria-hidden="true">${iconSvg}</div>
          <span class="forecast-condition-name">${condition.description}</span>
        </div>

        <div class="forecast-spectrum-cell">
          <span class="spectrum-temp temp-low" title="Minimum Temperature">${minTemp}</span>
          <div class="spectrum-bar-track" aria-hidden="true">
            <div class="spectrum-bar-fill" style="left: ${leftPct.toFixed(1)}%; width: ${widthPct.toFixed(1)}%;"></div>
            ${currentDotHtml}
          </div>
          <span class="spectrum-temp temp-high" title="Maximum Temperature">${maxTemp}</span>
        </div>
      </article>
    `);
  }

  DOM.forecastCardsContainer.innerHTML = cardsHtml.join('');

  if (DOM.forecastSection) {
    DOM.forecastSection.classList.remove('hidden');
  }
}

/**
 * Populate current weather DOM elements with real meteorological data and transition view states.
 * Connects the bright animated weather scene with actual WMO code and is_day.
 * 
 * @param {{name: string, country: string, admin1: string, isGeolocation?: boolean}} city - Location metadata
 * @param {object} weather - Current weather measurements from Open-Meteo
 */
function renderCurrentWeather(city, weather) {
  if (!city || !weather) return;

  // 1. Format Location Metadata (Never displays raw coordinates as main label)
  const locationLabel = city.isGeolocation
    ? 'Your Current Location'
    : [city.name, city.country].filter(Boolean).join(', ');

  if (DOM.currentCity) DOM.currentCity.textContent = locationLabel;

  // 2. Format Timestamp
  if (DOM.currentDatetime) {
    DOM.currentDatetime.textContent = formatDateTime(weather.time);
  }

  // 3. Interpret Weather Condition & Inject Animated Weather Scene
  const isDay = typeof weather.is_day === 'number' ? weather.is_day : 1;
  const condition = getWmoInterpretation(weather.weather_code, isDay);

  if (DOM.currentConditionText) {
    DOM.currentConditionText.textContent = condition.description;
  }
  if (DOM.currentWeatherIcon) {
    DOM.currentWeatherIcon.innerHTML = condition.iconSvg;
  }

  // 4. Primary Temperature Display
  if (DOM.currentTemperature) {
    DOM.currentTemperature.textContent = formatTemperature(weather.temperature_2m);
  }

  // 5. Detailed Meteorological Metrics Grid
  if (DOM.metricFeelsLike) {
    DOM.metricFeelsLike.textContent = formatTemperature(weather.apparent_temperature);
  }
  const heroSubFeels = document.getElementById('hero-subline-feels');
  if (heroSubFeels) {
    heroSubFeels.textContent = formatTemperature(weather.apparent_temperature);
  }
  if (DOM.metricHumidity) {
    DOM.metricHumidity.textContent = formatPercentage(weather.relative_humidity_2m);
  }
  if (DOM.metricWindSpeed) {
    DOM.metricWindSpeed.textContent = formatSpeed(weather.wind_speed_10m);
  }
  if (DOM.metricPrecipitation) {
    DOM.metricPrecipitation.textContent = formatPrecipitation(weather.precipitation);
  }

  // 6. Natural Language Atmospheric Summary
  const summaryElem = document.getElementById('hero-summary-text');
  if (summaryElem) {
    const code = typeof weather.weather_code === 'number' ? weather.weather_code : 0;
    let summaryText = 'Pleasant atmospheric conditions.';
    if (code === 0) {
      summaryText = isDay ? 'Sunny & clear skies with excellent visibility.' : 'Clear starry skies with calm winds.';
    } else if (code === 1 || code === 2) {
      summaryText = 'Gentle atmospheric breeze with scattered clouds.';
    } else if (code === 3) {
      summaryText = 'Overcast cloud cover across the horizon.';
    } else if (code >= 51 && code <= 67 || code >= 80 && code <= 82) {
      summaryText = 'Rainfall observed. Bring an umbrella if heading out.';
    } else if (code >= 71 && code <= 77 || code >= 85 && code <= 86) {
      summaryText = 'Snow accumulation detected with cold winds.';
    } else if (code >= 95) {
      summaryText = 'Thunderstorm activity active in the area. Stay safe.';
    }
    summaryElem.textContent = summaryText;
  }

  // 7. Render Google Weather-Inspired Hourly Weather Section
  if (weather.hourly) {
    renderHourly(weather.hourly, AppState.activeHourlyTab || 'temperature');
  }

  // 8. Render Apple Weather-Style 5-Day Spectrum Section
  if (weather.daily) {
    renderForecast(weather.daily);
  }

  // 9. View State Transitions:
  if (DOM.initialState) {
    DOM.initialState.classList.add('hidden');
  }
  if (DOM.currentWeatherSection) {
    DOM.currentWeatherSection.classList.remove('hidden');
  }
  if (DOM.forecastSection) {
    DOM.forecastSection.classList.remove('hidden');
  }
  if (DOM.dashboardContent) {
    DOM.dashboardContent.classList.remove('hidden');
  }
}

/* --------------------------------------------------------------------------
   9. Centralized Search City Flow (Manual Search, Popular Cities, & Restore)
   -------------------------------------------------------------------------- */

/**
 * Execute weather lookup for a specific city name or pre-resolved city object.
 * Handles geocoding, forecast fetching, UI updates, and localStorage persistence.
 * 
 * @param {string|object} cityTarget - Name of the city or pre-resolved city object
 * @param {{saveToStorage?: boolean, isStartup?: boolean}} [options={}] - Execution options
 */
async function searchCity(cityTarget, options = {}) {
  const { saveToStorage = true, isStartup = false } = options;

  let city = null;
  let queryText = '';

  if (typeof cityTarget === 'object' && cityTarget !== null && typeof cityTarget.latitude === 'number' && typeof cityTarget.longitude === 'number') {
    city = cityTarget;
    queryText = city.name || 'Selected City';
  } else if (typeof cityTarget === 'string') {
    queryText = cityTarget.trim();
    if (!queryText) {
      showStatus('Please enter a city name to search.', 'error');
      if (DOM.cityInput) DOM.cityInput.focus();
      return;
    }
  } else {
    showStatus('Please enter a valid city name.', 'error');
    return;
  }

  // If user searched manually or selected a suggestion, update input display
  if (DOM.cityInput && !isStartup) {
    DOM.cityInput.value = city ? city.name : queryText;
  }

  clearStatus();
  closeSuggestions();

  // Increment request ID to track this specific request lifecycle
  const currentRequestId = ++activeRequestId;

  try {
    // 1. Loading State: Geocoding (skip if pre-resolved from suggestion)
    if (!city) {
      setLoading(true, `Locating "${queryText}"...`);
      city = await findCity(queryText);

      // Guard against stale/superseded asynchronous responses
      if (currentRequestId !== activeRequestId) {
        console.warn('[SKYCAST] Discarding superseded geocoding response.');
        return;
      }
    }

    // 2. Loading State: Weather Retrieval
    setLoading(true, `Fetching live weather for ${city.name}...`);

    // Step B: Fetch real current weather (Milestone 3B with is_day)
    const weather = await getWeather(city.latitude, city.longitude);

    // Guard against stale response
    if (currentRequestId !== activeRequestId) {
      console.warn('[SKYCAST] Discarding superseded weather response.');
      return;
    }

    // 3. Update In-Memory Application State
    AppState.activeCity = city;
    AppState.weatherData = weather;

    // 4. Render Live Current Weather to DOM
    renderCurrentWeather(city, weather);

    // 5. Persist to localStorage if requested
    if (saveToStorage) {
      saveLastCity(city.name);
      saveRecentSearch(city.name);
    }

    if (isStartup) {
      showStatus(`Welcome back! Showing latest weather for ${city.name}.`, 'info');
    }

    console.log('[SKYCAST] Weather loaded for:', city.name, `${weather.temperature_2m}°C`);
  } catch (error) {
    if (currentRequestId === activeRequestId) {
      console.error('[SKYCAST] City search failed:', error.message);
      showStatus(error.message, 'error', {
        retryAction: () => searchCity(cityTarget, options)
      });
      // If no valid weather was previously loaded, keep sections hidden and initial-state visible
      if (!AppState.weatherData) {
        if (DOM.initialState) DOM.initialState.classList.remove('hidden');
        if (DOM.currentWeatherSection) DOM.currentWeatherSection.classList.add('hidden');
        if (DOM.forecastSection) DOM.forecastSection.classList.add('hidden');
      }
    }
  } finally {
    if (currentRequestId === activeRequestId) {
      setLoading(false);
    }
  }
}

/**
 * Handle search form submit event.
 * @param {Event} event - Form submit event
 */
function handleSearchSubmit(event) {
  event.preventDefault();
  closeSuggestions();

  if (AppState.isLoading) {
    return;
  }

  const query = DOM.cityInput ? DOM.cityInput.value : '';
  searchCity(query, { saveToStorage: true });
}

/* --------------------------------------------------------------------------
   9B. Live Search Autocomplete & Smart Suggestions (Google Search Style)
   -------------------------------------------------------------------------- */

// Regional & State aliases to instantly resolve regional queries (e.g. "Karnataka", "Tamil Nadu")
const REGIONAL_ALIASES = [
  { name: 'Bengaluru', displayName: 'Karnataka (Bengaluru)', state: 'Karnataka', country: 'India', countryCode: 'IN', latitude: 12.97194, longitude: 77.59369 },
  { name: 'Chennai', displayName: 'Tamil Nadu (Chennai)', state: 'Tamil Nadu', country: 'India', countryCode: 'IN', latitude: 13.0827, longitude: 80.2707 },
  { name: 'Mumbai', displayName: 'Maharashtra (Mumbai)', state: 'Maharashtra', country: 'India', countryCode: 'IN', latitude: 19.0760, longitude: 72.8777 },
  { name: 'Hyderabad', displayName: 'Telangana (Hyderabad)', state: 'Telangana', country: 'India', countryCode: 'IN', latitude: 17.3850, longitude: 78.4867 },
  { name: 'Kolkata', displayName: 'West Bengal (Kolkata)', state: 'West Bengal', country: 'India', countryCode: 'IN', latitude: 22.5726, longitude: 88.3639 },
  { name: 'Jaipur', displayName: 'Rajasthan (Jaipur)', state: 'Rajasthan', country: 'India', countryCode: 'IN', latitude: 26.9124, longitude: 75.7873 },
  { name: 'Thiruvananthapuram', displayName: 'Kerala (Thiruvananthapuram)', state: 'Kerala', country: 'India', countryCode: 'IN', latitude: 8.5241, longitude: 76.9366 },
  { name: 'Kochi', displayName: 'Kochi, Kerala', state: 'Kerala', country: 'India', countryCode: 'IN', latitude: 9.9312, longitude: 76.2673 },
  { name: 'Lucknow', displayName: 'Uttar Pradesh (Lucknow)', state: 'Uttar Pradesh', country: 'India', countryCode: 'IN', latitude: 26.8467, longitude: 80.9462 },
  { name: 'Ahmedabad', displayName: 'Gujarat (Ahmedabad)', state: 'Gujarat', country: 'India', countryCode: 'IN', latitude: 23.0225, longitude: 72.5714 },
  { name: 'Bhopal', displayName: 'Madhya Pradesh (Bhopal)', state: 'Madhya Pradesh', country: 'India', countryCode: 'IN', latitude: 23.2599, longitude: 77.4126 },
  { name: 'Chandigarh', displayName: 'Punjab & Haryana (Chandigarh)', state: 'Punjab', country: 'India', countryCode: 'IN', latitude: 30.7333, longitude: 76.7794 },
  { name: 'Patna', displayName: 'Bihar (Patna)', state: 'Bihar', country: 'India', countryCode: 'IN', latitude: 25.5941, longitude: 85.1376 },
  { name: 'Madurai', displayName: 'Madurai, Tamil Nadu', state: 'Tamil Nadu', country: 'India', countryCode: 'IN', latitude: 9.9252, longitude: 78.1198 },
  { name: 'Coimbatore', displayName: 'Coimbatore, Tamil Nadu', state: 'Tamil Nadu', country: 'India', countryCode: 'IN', latitude: 11.0168, longitude: 76.9558 },
];

let activeSuggestionRequestId = 0;
let suggestionDebounceTimer = null;
let activeSuggestions = [];
let selectedSuggestionIndex = -1;

/**
 * Safely escape HTML characters.
 * @param {string} str - Raw text
 * @returns {string} Escaped HTML string
 */
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Highlight matching portions of text corresponding to the search query.
 * @param {string} text - The original text to highlight
 * @param {string} query - The search query term
 * @returns {string} HTML string with match wrapped in span
 */
function highlightMatch(text, query) {
  if (!text || !query) return escapeHtml(text || '');
  const cleanQ = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!cleanQ) return escapeHtml(text);
  const regex = new RegExp(`(${cleanQ})`, 'gi');
  const safeText = escapeHtml(text);
  return safeText.replace(regex, '<span class="suggestion-match">$1</span>');
}

/**
 * Fetch autocomplete city suggestions from Open-Meteo Geocoding API with fast regional alias lookup.
 * @param {string} rawQuery - Current text in city input field
 */
async function fetchCitySuggestions(rawQuery) {
  const query = (rawQuery || '').trim();
  if (query.length < 2) {
    closeSuggestions();
    return;
  }

  const requestId = ++activeSuggestionRequestId;
  renderSuggestionsLoading(query);

  try {
    const url = `${API_CONFIG.GEOCODING_BASE_URL}?name=${encodeURIComponent(query)}&count=6&language=${API_CONFIG.DEFAULT_LANGUAGE}&format=${API_CONFIG.DEFAULT_FORMAT}`;
    const response = await fetch(url);

    if (requestId !== activeSuggestionRequestId) return; // Stale discard

    if (!response.ok) {
      throw new Error(`Geocoding HTTP ${response.status}`);
    }

    const data = await response.json();

    if (requestId !== activeSuggestionRequestId) return; // Stale discard

    const results = [];
    const lowerQ = query.toLowerCase();

    // 1. Check regional & state aliases first
    const matchedAliases = REGIONAL_ALIASES.filter(a =>
      a.name.toLowerCase().includes(lowerQ) ||
      a.displayName.toLowerCase().includes(lowerQ) ||
      a.state.toLowerCase().includes(lowerQ)
    );

    matchedAliases.forEach(alias => {
      results.push({
        name: alias.name,
        title: alias.displayName,
        subtitle: `${alias.state}, ${alias.country}`,
        countryCode: alias.countryCode,
        country: alias.country,
        admin1: alias.state,
        latitude: alias.latitude,
        longitude: alias.longitude,
      });
    });

    // 2. Add Open-Meteo live Geocoding API results
    if (data && Array.isArray(data.results)) {
      data.results.forEach(item => {
        const isDuplicate = results.some(r =>
          r.name.toLowerCase() === item.name.toLowerCase() &&
          (r.admin1 || '').toLowerCase() === (item.admin1 || '').toLowerCase()
        );

        if (!isDuplicate) {
          const region = item.admin1 || item.admin2 || '';
          const subtitle = [region, item.country].filter(Boolean).join(', ');
          results.push({
            name: item.name,
            title: item.name,
            subtitle: subtitle || 'City',
            countryCode: (item.country_code || '').toUpperCase(),
            country: item.country || '',
            admin1: region,
            latitude: item.latitude,
            longitude: item.longitude,
          });
        }
      });
    }

    renderSuggestions(results.slice(0, 6), query);
  } catch (err) {
    if (requestId === activeSuggestionRequestId) {
      console.warn('[SKYCAST] Autocomplete suggestion error:', err.message);
      closeSuggestions();
    }
  }
}

/**
 * Render the dropdown items for autocomplete suggestions.
 * @param {Array} suggestions - List of suggestion objects
 * @param {string} query - The query string to highlight
 */
function renderSuggestions(suggestions, query) {
  if (!DOM.searchSuggestions) return;

  activeSuggestions = suggestions || [];
  selectedSuggestionIndex = -1;

  if (activeSuggestions.length === 0) {
    DOM.searchSuggestions.innerHTML = `
      <div class="suggestion-status">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <span>No matching cities found for "<strong>${escapeHtml(query)}</strong>"</span>
      </div>`;
    DOM.searchSuggestions.classList.remove('hidden');
    if (DOM.cityInput) DOM.cityInput.setAttribute('aria-expanded', 'true');
    return;
  }

  DOM.searchSuggestions.innerHTML = '';
  activeSuggestions.forEach((item, index) => {
    const itemBtn = document.createElement('button');
    itemBtn.type = 'button';
    itemBtn.className = 'suggestion-item';
    itemBtn.setAttribute('role', 'option');
    itemBtn.setAttribute('id', `suggestion-item-${index}`);
    itemBtn.dataset.index = index;

    itemBtn.innerHTML = `
      <span class="suggestion-icon" aria-hidden="true">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
      </span>
      <div class="suggestion-content">
        <span class="suggestion-title">${highlightMatch(item.title, query)}</span>
        <span class="suggestion-subtitle">${escapeHtml(item.subtitle)}</span>
      </div>
      ${item.countryCode ? `<span class="suggestion-badge">${item.countryCode}</span>` : ''}
    `;

    itemBtn.addEventListener('click', (e) => {
      e.preventDefault();
      selectSuggestion(index);
    });

    itemBtn.addEventListener('mouseenter', () => {
      updateSelectedSuggestion(index);
    });

    DOM.searchSuggestions.appendChild(itemBtn);
  });

  DOM.searchSuggestions.classList.remove('hidden');
  if (DOM.cityInput) DOM.cityInput.setAttribute('aria-expanded', 'true');
}

/**
 * Display a subtle searching indicator in the suggestions dropdown.
 * @param {string} query - Query being searched
 */
function renderSuggestionsLoading(query) {
  if (!DOM.searchSuggestions) return;
  DOM.searchSuggestions.innerHTML = `
    <div class="suggestion-status">
      <div class="suggestion-mini-spinner" aria-hidden="true"></div>
      <span>Searching cities matching "<strong>${escapeHtml(query)}</strong>"...</span>
    </div>`;
  DOM.searchSuggestions.classList.remove('hidden');
  if (DOM.cityInput) DOM.cityInput.setAttribute('aria-expanded', 'true');
}

/**
 * Hide and clear the suggestions dropdown.
 */
function closeSuggestions() {
  if (!DOM.searchSuggestions) return;
  DOM.searchSuggestions.classList.add('hidden');
  DOM.searchSuggestions.innerHTML = '';
  activeSuggestions = [];
  selectedSuggestionIndex = -1;
  if (DOM.cityInput) {
    DOM.cityInput.setAttribute('aria-expanded', 'false');
    DOM.cityInput.removeAttribute('aria-activedescendant');
  }
}

/**
 * Select a specific suggestion by index, fill input, and execute weather search.
 * @param {number} index - Index in activeSuggestions
 */
function selectSuggestion(index) {
  const item = activeSuggestions[index];
  if (!item) return;

  if (DOM.cityInput) {
    DOM.cityInput.value = item.name;
  }

  closeSuggestions();
  searchCity(item, { saveToStorage: true });
}

/**
 * Update keyboard highlight selection index and scroll into view.
 * @param {number} newIndex - Index to select (-1 to clear)
 */
function updateSelectedSuggestion(newIndex) {
  if (!DOM.searchSuggestions) return;
  const items = DOM.searchSuggestions.querySelectorAll('.suggestion-item');
  if (!items.length) return;

  items.forEach(el => el.classList.remove('is-selected'));

  if (newIndex >= 0 && newIndex < items.length) {
    selectedSuggestionIndex = newIndex;
    const current = items[newIndex];
    current.classList.add('is-selected');
    current.scrollIntoView({ block: 'nearest' });
    if (DOM.cityInput) {
      DOM.cityInput.setAttribute('aria-activedescendant', current.id);
    }
  } else {
    selectedSuggestionIndex = -1;
    if (DOM.cityInput) {
      DOM.cityInput.removeAttribute('aria-activedescendant');
    }
  }
}

/**
 * Input event listener with 220ms debounce.
 * @param {InputEvent} event - Input event on city-input
 */
function handleCityInput(event) {
  const query = event.target.value;
  clearTimeout(suggestionDebounceTimer);

  if (!query || query.trim().length < 2) {
    closeSuggestions();
    return;
  }

  suggestionDebounceTimer = setTimeout(() => {
    fetchCitySuggestions(query);
  }, 220);
}

/**
 * Keyboard navigation listener for ArrowDown, ArrowUp, Enter, and Escape.
 * @param {KeyboardEvent} event - Keydown event
 */
function handleCityKeydown(event) {
  if (!DOM.searchSuggestions || DOM.searchSuggestions.classList.contains('hidden')) {
    return;
  }

  const items = DOM.searchSuggestions.querySelectorAll('.suggestion-item');
  if (!items.length) return;

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    const next = selectedSuggestionIndex < items.length - 1 ? selectedSuggestionIndex + 1 : 0;
    updateSelectedSuggestion(next);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    const prev = selectedSuggestionIndex > 0 ? selectedSuggestionIndex - 1 : items.length - 1;
    updateSelectedSuggestion(prev);
  } else if (event.key === 'Enter') {
    if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < activeSuggestions.length) {
      event.preventDefault();
      selectSuggestion(selectedSuggestionIndex);
    }
  } else if (event.key === 'Escape') {
    closeSuggestions();
  }
}

/* --------------------------------------------------------------------------
   10. Geolocation Weather Feature ("Use My Location" & Auto-Detect)
   -------------------------------------------------------------------------- */

/**
 * Request user's current GPS location and fetch weather directly from coordinates.
 * 
 * @param {{isAuto?: boolean}} [options={}] - True if triggered automatically on startup
 */
function getUserLocationWeather(options = {}) {
  const { isAuto = false } = options;

  if (AppState.isLoading) {
    return;
  }

  if (!navigator.geolocation) {
    if (!isAuto) {
      showStatus('Geolocation is not supported by your web browser. Please search manually.', 'error');
    }
    return;
  }

  const currentRequestId = ++activeRequestId;
  clearStatus();
  setLoading(true, 'Detecting your current location...');

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      // Guard against superseded request if user searched while geolocation prompt was active
      if (currentRequestId !== activeRequestId) {
        console.warn('[SKYCAST] Discarding superseded geolocation response.');
        return;
      }

      const { latitude, longitude } = position.coords;
      const cityMeta = {
        name: 'Your Current Location',
        country: '',
        admin1: '',
        latitude,
        longitude,
        isGeolocation: true,
      };

      try {
        setLoading(true, 'Fetching live weather for your location...');
        const weather = await getWeather(latitude, longitude);

        if (currentRequestId !== activeRequestId) return;

        AppState.activeCity = cityMeta;
        AppState.weatherData = weather;

        renderCurrentWeather(cityMeta, weather);
        showStatus('Displaying live weather for your current location.', 'info');
        console.log('[SKYCAST] Automatic location weather loaded successfully.');
      } catch (err) {
        if (currentRequestId === activeRequestId) {
          showStatus(err.message, 'error');
        }
      } finally {
        if (currentRequestId === activeRequestId) {
          setLoading(false);
        }
      }
    },
    (geoError) => {
      if (currentRequestId !== activeRequestId) return;
      setLoading(false);

      // Distinguish specific Geolocation error codes
      // 1: PERMISSION_DENIED, 2: POSITION_UNAVAILABLE, 3: TIMEOUT
      let friendlyMessage = 'Unable to determine your location.';
      if (geoError.code === 1) {
        friendlyMessage = 'Location access was denied. You can search for any city above.';
      } else if (geoError.code === 2) {
        friendlyMessage = 'Location information is currently unavailable. Please search for a city above.';
      } else if (geoError.code === 3) {
        friendlyMessage = 'Location request timed out. Please try again or search for a city above.';
      }

      if (!isAuto) {
        showStatus(friendlyMessage, 'error', {
          retryAction: () => getUserLocationWeather({ isAuto: false })
        });
      } else {
        console.log('[SKYCAST] First-visit auto-location skipped/denied:', friendlyMessage);
      }

      // If no valid weather was previously loaded, keep sections hidden and initial-state visible
      if (!AppState.weatherData) {
        if (DOM.initialState) DOM.initialState.classList.remove('hidden');
        if (DOM.currentWeatherSection) DOM.currentWeatherSection.classList.add('hidden');
        if (DOM.forecastSection) DOM.forecastSection.classList.add('hidden');
      }
    },
    {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000, // Cache location up to 5 minutes
    }
  );
}

/* --------------------------------------------------------------------------
   11. LocalStorage Management (Remember Last Selected City & Recent Searches)
   -------------------------------------------------------------------------- */

/**
 * Save the last successful manual city name to localStorage safely.
 * @param {string} cityName - Name of the city
 */
function saveLastCity(cityName) {
  if (!cityName || typeof cityName !== 'string' || cityName.trim() === '') return;

  try {
    localStorage.setItem(API_CONFIG.STORAGE_KEY_LAST_CITY, cityName.trim());
  } catch (err) {
    console.warn('[SKYCAST] LocalStorage write failed or blocked by browser settings:', err.message);
  }
}

/**
 * Retrieve the last successfully selected city from localStorage safely.
 * @returns {string|null} Saved city name or null
 */
function getLastCity() {
  try {
    const saved = localStorage.getItem(API_CONFIG.STORAGE_KEY_LAST_CITY);
    return saved && typeof saved === 'string' && saved.trim() !== '' ? saved.trim() : null;
  } catch (err) {
    console.warn('[SKYCAST] LocalStorage read failed or blocked:', err.message);
    return null;
  }
}

/**
 * Retrieve recent search queries from localStorage safely.
 * @returns {string[]} Array of city names
 */
function getRecentSearches() {
  try {
    const raw = localStorage.getItem(API_CONFIG.STORAGE_KEY_RECENT_SEARCHES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[SKYCAST] Failed to read recent searches from localStorage:', err.message);
    return [];
  }
}

/**
 * Save a city name to recent searches list in localStorage safely.
 * @param {string} cityName - Name of the city to save
 */
function saveRecentSearch(cityName) {
  if (!cityName || typeof cityName !== 'string' || cityName.trim() === '') return;
  const cleanName = cityName.trim();

  try {
    let list = getRecentSearches();
    // Case-insensitive deduplication
    list = list.filter(item => item.toLowerCase() !== cleanName.toLowerCase());
    // Insert at front
    list.unshift(cleanName);
    // Limit list length
    const maxItems = API_CONFIG.MAX_RECENT_SEARCHES || 6;
    if (list.length > maxItems) {
      list = list.slice(0, maxItems);
    }
    localStorage.setItem(API_CONFIG.STORAGE_KEY_RECENT_SEARCHES, JSON.stringify(list));
    AppState.recentSearches = list;
    renderRecentSearches();
  } catch (err) {
    console.warn('[SKYCAST] Failed to save recent search to localStorage:', err.message);
  }
}

/**
 * Clear all recent searches from localStorage and UI.
 */
function clearRecentSearches() {
  try {
    localStorage.removeItem(API_CONFIG.STORAGE_KEY_RECENT_SEARCHES);
  } catch (err) {
    console.warn('[SKYCAST] Failed to clear recent searches from localStorage:', err.message);
  }
  AppState.recentSearches = [];
  renderRecentSearches();
}

/**
 * Render recent searches chips into the DOM container.
 */
function renderRecentSearches() {
  if (!DOM.recentSearchesContainer || !DOM.recentTagsList) return;

  const list = getRecentSearches();
  AppState.recentSearches = list;

  if (list.length === 0) {
    DOM.recentSearchesContainer.classList.add('hidden');
    DOM.recentTagsList.innerHTML = '';
    return;
  }

  DOM.recentTagsList.innerHTML = '';
  list.forEach(city => {
    const tagBtn = document.createElement('button');
    tagBtn.type = 'button';
    tagBtn.className = 'recent-city-tag';
    tagBtn.dataset.city = city;
    tagBtn.textContent = city;
    DOM.recentTagsList.appendChild(tagBtn);
  });

  DOM.recentSearchesContainer.classList.remove('hidden');
}

/* --------------------------------------------------------------------------
   12. Application Initialization & Startup Priority Flow
   -------------------------------------------------------------------------- */

/**
 * Resolve startup weather according to user priority:
 * 1. Returning user with previously saved city -> Restore saved city.
 * 2. First-time visitor (no saved city) -> Request automatic browser Geolocation.
 * 3. Fallback (permission denied or no GPS) -> Show clean welcome search state (#initial-state).
 */
function resolveStartupWeather() {
  const savedCity = getLastCity();

  if (savedCity) {
    console.log('[SKYCAST Startup] Restoring saved city from localStorage:', savedCity);
    searchCity(savedCity, { saveToStorage: false, isStartup: true });
  } else {
    console.log('[SKYCAST Startup] First visit. Auto-detecting location or awaiting search...');
    if (navigator.geolocation) {
      getUserLocationWeather({ isAuto: true });
    }
  }
}

function init() {
  console.log('SKYCAST Weather Dashboard initialized (Automatic Location & Popular Cities Active).');

  // 1. Attach search form submit listener
  if (DOM.searchForm) {
    DOM.searchForm.addEventListener('submit', handleSearchSubmit);
  }

  // 1B. Attach Live Search Autocomplete input & keyboard navigation listeners
  if (DOM.cityInput) {
    DOM.cityInput.addEventListener('input', handleCityInput);
    DOM.cityInput.addEventListener('keydown', handleCityKeydown);
    DOM.cityInput.addEventListener('focus', () => {
      const q = (DOM.cityInput.value || '').trim();
      if (q.length >= 2 && DOM.searchSuggestions && DOM.searchSuggestions.classList.contains('hidden')) {
        fetchCitySuggestions(q);
      }
    });
  }

  // Close suggestions dropdown when clicking outside the search form
  document.addEventListener('click', (event) => {
    if (DOM.searchForm && !DOM.searchForm.contains(event.target)) {
      closeSuggestions();
    }
  });

  // 2. Attach "Use My Location" button listeners (search bar, card header, and welcome card)
  if (DOM.geoBtn) {
    DOM.geoBtn.addEventListener('click', () => {
      getUserLocationWeather({ isAuto: false });
    });
  }
  if (DOM.cardGeoAction) {
    DOM.cardGeoAction.addEventListener('click', () => {
      getUserLocationWeather({ isAuto: false });
    });
  }
  if (DOM.welcomeGeoBtn) {
    DOM.welcomeGeoBtn.addEventListener('click', () => {
      getUserLocationWeather({ isAuto: false });
    });
  }

  // 3. Attach click delegation for Popular Cities shortcuts
  if (DOM.popularCitiesList) {
    DOM.popularCitiesList.addEventListener('click', (event) => {
      const cityBtn = event.target.closest('.popular-city-btn');
      if (cityBtn && cityBtn.dataset.city) {
        const selectedCity = cityBtn.dataset.city;
        console.log('[SKYCAST] Popular city clicked:', selectedCity);
        searchCity(selectedCity, { saveToStorage: true });
      }
    });
  }

  // Also delegate on document for any .popular-city-btn outside header (such as in welcome card)
  document.addEventListener('click', (event) => {
    const popularBtn = event.target.closest('.popular-city-btn');
    if (popularBtn && popularBtn.dataset.city) {
      if (DOM.popularCitiesList && DOM.popularCitiesList.contains(popularBtn)) {
        return; // Handled by DOM.popularCitiesList listener
      }
      console.log('[SKYCAST] Welcome chip clicked:', popularBtn.dataset.city);
      searchCity(popularBtn.dataset.city, { saveToStorage: true });
    }
  });

  // 4. Attach Recent Searches click delegation & clear button
  if (DOM.recentTagsList) {
    DOM.recentTagsList.addEventListener('click', (event) => {
      const tagBtn = event.target.closest('.recent-city-tag');
      if (tagBtn && tagBtn.dataset.city) {
        searchCity(tagBtn.dataset.city, { saveToStorage: true });
      }
    });
  }
  if (DOM.clearHistoryBtn) {
    DOM.clearHistoryBtn.addEventListener('click', clearRecentSearches);
  }

  // 5. Attach click listener for Hourly Forecast Tabs
  const hourlyTabs = document.querySelector('.hourly-tabs');
  if (hourlyTabs) {
    hourlyTabs.addEventListener('click', (event) => {
      const tabBtn = event.target.closest('.hourly-tab-btn');
      if (tabBtn && tabBtn.dataset.tab) {
        hourlyTabs.querySelectorAll('.hourly-tab-btn').forEach(btn => {
          btn.classList.remove('active');
          btn.setAttribute('aria-selected', 'false');
        });
        tabBtn.classList.add('active');
        tabBtn.setAttribute('aria-selected', 'true');
        AppState.activeHourlyTab = tabBtn.dataset.tab;

        if (AppState.weatherData && AppState.weatherData.hourly) {
          renderHourly(AppState.weatherData.hourly, AppState.activeHourlyTab);
        }
      }
    });
  }

  // 6. Initial render of Recent Searches from localStorage
  renderRecentSearches();

  // 7. Resolve Startup Weather according to priority rules
  resolveStartupWeather();

  // Expose key functions globally on window for easy testing and debugging
  window.findCity = findCity;
  window.getWeather = getWeather;
  window.searchCity = searchCity;
  window.getUserLocationWeather = getUserLocationWeather;
  window.renderCurrentWeather = renderCurrentWeather;
  window.renderHourly = renderHourly;
  window.renderForecast = renderForecast;
  window.getWmoInterpretation = getWmoInterpretation;
  window.getMiniWeatherIcon = getMiniWeatherIcon;
  window.formatDateTime = formatDateTime;
  window.formatTemperature = formatTemperature;
  window.formatPercentage = formatPercentage;
  window.formatSpeed = formatSpeed;
  window.formatPrecipitation = formatPrecipitation;
  window.saveLastCity = saveLastCity;
  window.getLastCity = getLastCity;
  window.getRecentSearches = getRecentSearches;
  window.saveRecentSearch = saveRecentSearch;
  window.clearRecentSearches = clearRecentSearches;
  window.renderRecentSearches = renderRecentSearches;
  window.fetchCitySuggestions = fetchCitySuggestions;
  window.renderSuggestions = renderSuggestions;
  window.closeSuggestions = closeSuggestions;
  window.selectSuggestion = selectSuggestion;
  window.AppState = AppState;
}

// Run initialization once the DOM is fully constructed
document.addEventListener('DOMContentLoaded', init);
