# SKYCAST – Live Weather Dashboard

**InternCircle Virtual Internship | Full Stack Web Development**  
*Project 04 – Live Weather Dashboard with Fetch API*

---

## 📌 Project Overview
**SKYCAST** is a modern, responsive, and lightweight web dashboard built with semantic HTML5, modern CSS3, and Vanilla JavaScript. It delivers real-time weather analytics and 5-day forecasts for global locations using the Open-Meteo Geocoding and Weather Forecast APIs.

This project is built from scratch without external frameworks (no React, Angular, Vue, Node.js, Bootstrap, or Tailwind CSS) to master fundamental DOM manipulation, asynchronous programming with `fetch` / `async/await`, responsive layout design, and client-side persistence via `localStorage`.

---

## 🚀 Key Planned Features
- **Automatic Local Weather:** Browser Geolocation API detects current location on first visit or via the "My Location" button.
- **Global City Search:** Converts city names to geo-coordinates via Open-Meteo Geocoding API with debouncing and duplicate guards.
- **Popular City Shortcuts:** Quick-access one-tap buttons for major hubs (Coimbatore, Chennai, Bengaluru, Mumbai, Delhi, London, Tokyo, New York).
- **Bright Animated Weather Scenes:** 7 high-contrast animated vector weather scenes (Sunny, Partly Cloudy, Cloudy, Rain, Snow, Thunderstorm, Night with moon & stars) reflecting live WMO codes and `is_day`.
- **Real-Time Weather Metrics:** Displays temperature, apparent temperature ("feels like"), humidity, wind speed, and precipitation with null-safe formatting.
- **Hourly Weather Trend Graph:** Smooth SVG cubic Bezier spline with shaded area gradient, interactive metric tabs (Temperature, Precipitation, Wind), and time intervals inspired by Google Weather.
- **5-Day Weather Forecast:** Daily cards with day name, date, vector weather icons, condition text, and maximum/minimum temperatures powered by Open-Meteo Daily API.
- **Persistent Storage:** Stores and restores the last selected city across browser sessions using `localStorage`.
- **Accessible & Responsive UI:** High-contrast text (#0f172a), translucent frosted cloud cards, full keyboard navigation, ARIA live regions, and `prefers-reduced-motion` compliance.
- **Defensive Error Handling:** Informative feedback for network issues, geolocation permissions, timeouts, and stale-request protection.

---

## 🛠️ Tech Stack
- **HTML5:** Semantic markup, accessibility features (`aria-live`, `aria-label`, `role`).
- **CSS3:** Custom properties (CSS variables), Flexbox, CSS Grid, smooth transitions, mobile-responsive media queries.
- **Vanilla JavaScript (ES6+):** Asynchronous `fetch` calls, `async/await`, DOM event listeners, and `localStorage` API.
- **APIs:**
  - [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api)
  - [Open-Meteo Weather Forecast API](https://open-meteo.com/en/docs)

---

## 📂 Project Structure
```text
InternCircle-Project-04-Weather-Dashboard/
│
├── index.html       # Semantic HTML5 markup and layout architecture
├── style.css        # Design tokens, custom variables, and responsive styling
├── script.js        # DOM selectors, state management, API integration, and events
├── run.bat          # 1-click Windows launcher to start local server and browser
├── README.md        # Comprehensive documentation and setup instructions
└── .gitignore       # Git exclusion rules for clean repository management
```

---

## 💻 How to Run the Project Locally

No build tools, bundlers, or package installations are required.

### Option 1: 1-Click Launcher (Windows `run.bat`)
Simply double-click [run.bat](file:///d:/InternCircle/task%204/run.bat) inside the project folder:
- It automatically launches `http://localhost:5500` in your default browser.
- It starts Python's local HTTP server on port 5500.
- If Python is not installed, it automatically falls back to opening `index.html` directly.

### Option 2: Live Server (Recommended in VS Code)
1. Open the project folder in **Visual Studio Code**.
2. Install the **Live Server** extension (by Ritwick Dey) if not already installed.
3. Right-click `index.html` and click **"Open with Live Server"** (or click *Go Live* in the bottom status bar).
4. The dashboard will launch in your default browser at `http://127.0.0.1:5500`.

### Option 3: Terminal / Command Prompt
Navigate to `D:\InternCircle\task 4` and run:
```bash
python -m http.server 5500
```
Then visit `http://localhost:5500` in your web browser.

### Option 4: Direct File Opening
Double-click `index.html` directly from Windows File Explorer to open it in Chrome, Edge, or Firefox.

---

## 📈 Development Roadmap
- [x] **Stage 1: Project Setup & Semantic HTML5 Architecture**
  - Project directory inspection and creation of core architecture files.
  - Semantic HTML5 structure (Header, Search Form, Status Area, Current Weather, 5-Day Forecast, Footer).
  - Clean 25 DOM ID mapping for strict JavaScript binding.
- [x] **Stage 2: CSS Styling & Bright Animated UI Architecture**
  - Bright sky-blue, white, and soft lavender palette with frosted glass cards.
  - 7 CSS keyframe animation sets (sun ray pulse, cloud drift, raindrops, snowflakes, lightning, star twinkle, moon pulse).
  - Mobile-first responsive layout with accessible focus rings and `prefers-reduced-motion` support.
- [x] **Stage 3A: Open-Meteo Geocoding Integration**
  - City search resolution, latitude/longitude mapping, duplicate query protection, and friendly error states.
- [x] **Stage 3B: Open-Meteo Current Weather & Automatic Location**
  - Explicit metric units (`temperature_unit=celsius`, `wind_speed_unit=kmh`, `precipitation_unit=mm`).
  - Browser Geolocation API with graceful permission-denied / timeout fallbacks and `#geo-btn`.
  - Popular city shortcuts bar for rapid weather retrieval.
  - Timezone-safe local wall-clock date/time parsing.
  - Null-safe metric formatting and stale-request protection (`activeRequestId`).
  - Day/Night detection via `is_day` and WMO weather condition mapping.
  - `localStorage` persistence for returning users.
- [x] **Stage 3C: Five-Day Weather Forecast & Google Weather-Inspired Hourly Trend**
  - Daily weather code, maximum/minimum temperature fetch via Open-Meteo Daily API.
  - Dynamically generated 5 daily forecast cards with Today pill highlight.
  - 24-hour hourly forecast with cubic Bezier SVG spline graph and interactive metric tabs (Temperature, Precipitation, Wind).
- [x] **Stage 4: Search History Chips & Live Autocomplete Suggestions**
  - Interactive chip bar in `#recent-tags-list`, one-click reload, and clear history.
  - Google Search-style live city suggestions with 220ms debounce, regional state aliases, matching character highlights, and arrow-key navigation.
- [x] **Stage 5: Final Internship Audit & GitHub Deployment**
  - 100% compliant with all official InternCircle Project 04 criteria.
  - Ready for GitHub Pages deployment.

