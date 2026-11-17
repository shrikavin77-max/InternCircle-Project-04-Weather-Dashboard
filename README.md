# SKYCAST — Live Atmospheric Weather Dashboard

**InternCircle Virtual Internship | Full Stack Web Development (Project 04)**  
*Live Weather Dashboard with Asynchronous Fetch API & Responsive Design*

---

## 📌 Project Overview & Objective

**SKYCAST** is a commercial-grade, responsive meteorological dashboard built from scratch using pure **semantic HTML5**, **modern CSS3**, and **Vanilla JavaScript (ES6+)**. The project integrates the **Open-Meteo Geocoding API** and **Open-Meteo Weather Forecast API** to deliver hyper-local, real-time weather observations, a 24-hour continuous horizon progression curve, and a 5-day temperature spectrum.

The primary objective of this project is to demonstrate mastery of core front-end engineering fundamentals:
- Native asynchronous programming using `fetch` with `async/await`.
- Dynamic Document Object Model (DOM) rendering without external frameworks or UI libraries.
- Google Search-style live city suggestions with input debouncing and keyboard accessibility.
- Defensive error handling (network disconnects, invalid input, permission denials, and out-of-order asynchronous responses).
- Client-side persistence using `localStorage`.
- High-contrast, mobile-first responsive design compliant with accessibility standards (`prefers-reduced-motion`, ARIA roles).

---

## 🚀 Implemented Features

### 1. Google Search-Style Live City Suggestions & Autocomplete
- **Live Autocomplete:** As the user types (minimum 2 characters), SKYCAST queries the Open-Meteo Geocoding API with a **220ms debounce**.
- **Regional State & Capital Aliases:** Built-in alias resolver for states and regions (e.g., typing *"Karnataka"* instantly suggests *Karnataka (Bengaluru)*; typing *"Tamil Nadu"* suggests *Tamil Nadu (Chennai)*).
- **Match Highlighting:** The matching substring is highlighted in bold sky-blue (`.suggestion-match`).
- **Keyboard Navigation:** Full arrow key support (<kbd>↓</kbd> / <kbd>↑</kbd>), <kbd>Enter</kbd> to select, and <kbd>Escape</kbd> to dismiss.
- **Instant Weather Dispatch:** Selecting an item passes pre-resolved coordinates directly to the forecast fetch pipeline, eliminating redundant geocoding requests.

### 2. Live Weather Observation (Current Weather)
- **Meteorological Indicators:** Real-time display of current temperature (°C), apparent temperature ("feels like"), relative humidity (%), surface wind speed (km/h), and precipitation depth (mm).
- **Timezone-Safe Local Time:** Converts the location's ISO 8601 wall-clock timestamp into a human-readable local date and time without device timezone skew.
- **Natural Language Summary:** Contextual, human-readable atmospheric observations based on official WMO weather codes.

### 3. Living Animated Weather Art Engine
- **Vector SVG Stages:** 7 lightweight, battery-friendly animated vector scenes responding to live WMO codes and day/night API flags:
  - *Sunny & Clear Day* (rotating solar rays, corona halo pulse)
  - *Partly Cloudy Day* (solar glow with drifting cloud layer)
  - *Overcast Cloudy* (dual-layer drifting cloud formations)
  - *Rainy Atmosphere* (falling raindrops with cloud cover)
  - *Snowstorm* (descending crystalline snowflakes)
  - *Thunderstorm* (flashing lightning bolts with storm clouds)
  - *Clear / Partly Cloudy Night* (twinkling star cluster with glowing crescent moon)

### 4. 24-Hour Horizon Progression Graph
- **Continuous Spline Horizon:** Google Weather-inspired cubic Bezier SVG spline curve ($C(cp1x, cp1y, cp2x, cp2y, x, y)$) calculated dynamically from genuine 24-hour hourly forecast datasets.
- **Interactive Metric Tabs:** Seamless tab switching between **Temperature**, **Precipitation probability**, and **Wind speed**.
- **Time Nodes:** Hourly nodes with localized time markers (`Now`, `6 pm`, `9 pm`, `12 am`, etc.) and mini SVG weather icons.

### 5. 5-Day Meteorological Spectrum Outlook
- **Apple-Style Range Spectrums:** Replaces boxy forecast cards with horizontal proportional range bars:
  $$\text{leftPct} = \frac{T_{\min} - \text{weekMin}}{\text{weekSpan}} \times 100\%$$
  $$\text{widthPct} = \frac{T_{\max} - T_{\min}}{\text{weekSpan}} \times 100\%$$
- **Daily Details:** Displays weekday names, calendar dates, WMO condition text, vector condition icons, and daily low/high temperature brackets.

### 6. Automatic Location Weather (Geolocation API)
- Automatically requests user permission on first visit to detect coordinates via the browser's native `navigator.geolocation` API.
- Dedicated "My Location" buttons in both the search bar and the weather card header.
- Graceful fallbacks for permission denials, position unavailability, and timeouts.

### 7. Search History & Popular City Quick-Access
- **Popular City Chips:** One-tap quick shortcuts for major metropolises: *Coimbatore*, *Chennai*, *Bengaluru*, *Mumbai*, *Delhi*, *London*, *Tokyo*, and *New York*.
- **Recent Searches History:** Remembers the last 6 manual searches in a chip bar with one-click reload and history clearing.
- **Persistent Session State:** Remembers the last searched city across browser reloads via `localStorage`.

---

## 🛠️ Tech Stack & Architecture

- **Semantic HTML5:** Structured sections, ARIA landmarks, `role="listbox"`, `role="tablist"`, `aria-live` polite status regions.
- **Modern CSS3:** CSS Custom Properties (Design Tokens), Flexbox, CSS Grid, frosted glass backdrops (`backdrop-filter: blur(28px)`), CSS keyframe animations, `@media (prefers-reduced-motion: reduce)`.
- **Vanilla JavaScript (ES6+):** Pure native JavaScript with zero external frameworks, libraries, or compilers.
- **APIs:**
  - [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api) (`geocoding-api.open-meteo.com/v1/search`)
  - [Open-Meteo Weather Forecast API](https://open-meteo.com/en/docs) (`api.open-meteo.com/v1/forecast`)

---

## 📂 Project Repository Structure

```text
InternCircle-Project-04-Weather-Dashboard/
│
├── index.html       # Semantic HTML5 markup, autocomplete container, and 25 preserved IDs
├── style.css        # Daylight sky design tokens, responsive layout, animations, and typography
├── script.js        # Asynchronous API orchestration, autocomplete engine, DOM rendering, state
├── run.bat          # 1-click Windows launcher to start local server and launch browser
├── README.md        # Comprehensive project documentation and internship report
└── .gitignore       # Git exclusion rules for clean repository hygiene
```

---

## 🛡️ Robust Error Handling Architecture

SKYCAST implements defensive programming across all user interactions and asynchronous boundaries:

1. **Empty or Invalid Input:**
   - Trims user queries and blocks whitespace-only submissions with an immediate, friendly error alert: *"Please enter a city name to search."*
2. **City Not Found (404/Empty Results):**
   - When the Geocoding API returns an empty `results` array, a clear error banner explains: *"City '[name]' was not found. Please check spelling."* accompanied by an interactive **Try Again** button.
3. **Network & Offline Failures:**
   - All `fetch()` invocations are wrapped in `try/catch` blocks. Network dropouts and DNS failures surface a descriptive alert: *"Network error: Unable to connect to weather service. Please check your internet connection."*
4. **Geolocation Errors:**
   - Distinguishes between error codes:
     - `PERMISSION_DENIED (1)`: *"Location access was denied. You can search for any city above."*
     - `POSITION_UNAVAILABLE (2)`: *"Location information is currently unavailable. Please search for a city above."*
     - `TIMEOUT (3)`: *"Location request timed out. Please try again or search for a city above."*
5. **Race Condition & Stale-Request Guard:**
   - Rapid city searches and keystrokes are tracked with monotonic `activeRequestId` and `activeSuggestionRequestId` counters. Any asynchronous response that resolves out-of-order is discarded immediately.
6. **Null-Safe Rendering:**
   - Dedicated formatting helpers (`formatTemperature`, `formatPercentage`, `formatSpeed`, `formatPrecipitation`) validate that numbers are finite and non-NaN before rendering. Missing data safely renders `--` rather than broken `NaN°C`.

---

## 💻 How to Run Locally

### Option 1: 1-Click Launcher (Windows)
Double-click `run.bat` in the project root:
- Starts a local HTTP server on port 5500.
- Automatically launches `http://localhost:5500` in your default browser.

### Option 2: Python HTTP Server (Mac / Linux / Windows)
Open a terminal in the project directory and run:
```bash
python -m http.server 5500
```
Open [http://localhost:5500](http://localhost:5500) in your web browser.

### Option 3: VS Code Live Server
1. Open the project folder in **Visual Studio Code**.
2. Right-click `index.html` and select **"Open with Live Server"**.

---

## 🌐 Deployment & Live Access

- **GitHub Repository:** [https://github.com/shrikavin77-max/InternCircle-Project-04-Weather-Dashboard](https://github.com/shrikavin77-max/InternCircle-Project-04-Weather-Dashboard)
- **GitHub Pages Live App:** [https://shrikavin77-max.github.io/InternCircle-Project-04-Weather-Dashboard/](https://shrikavin77-max.github.io/InternCircle-Project-04-Weather-Dashboard/)

### Steps to Activate GitHub Pages (1-Minute Setup):
1. Navigate to the repository [Settings > Pages](https://github.com/shrikavin77-max/InternCircle-Project-04-Weather-Dashboard/settings/pages).
2. Under **Build and deployment > Source**, select **Deploy from a branch**.
3. Under **Branch**, select `main` and root `/ (root)`.
4. Click **Save**. The live site will publish within 60 seconds.

---

## 📋 InternCircle Submission Checklist

- [x] City search using the Geocoding API (`findCity`).
- [x] Current weather using the Forecast API (`getWeather`).
- [x] Current temperature and weather conditions (`renderCurrentWeather`).
- [x] Dynamic weather icons (`getWmoInterpretation` and `getMiniWeatherIcon`).
- [x] 5-day daily forecast cards (`renderForecast`).
- [x] Native Fetch API with `async/await`.
- [x] Dynamic DOM rendering without full page reloads.
- [x] Form input validation and debounced autocomplete.
- [x] Deliberate loading, empty/welcome, error, and success states.
- [x] Session persistence via `localStorage` (`saveLastCity`, `saveRecentSearch`).
- [x] Mobile-responsive layout (tested down to 320px).
- [x] GitHub Pages deployment readiness.
- [x] Zero external framework dependencies.
