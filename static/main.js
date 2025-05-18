document.addEventListener("DOMContentLoaded", () => {
  const socket = io();

  // Wrap main content in a .main-content div for flex layout
  let mainContent = document.querySelector(".main-content");
  if (!mainContent) {
    mainContent = document.createElement("div");
    mainContent.className = "main-content";
    // Move all children except .footer into .main-content
    const body = document.body;
    const footer = document.querySelector(".footer");
    const nodes = Array.from(body.childNodes).filter((n) => n !== footer);
    nodes.forEach((n) => mainContent.appendChild(n));
    body.insertBefore(mainContent, footer || null);
  }

  socket.on("weather_update", (data) => updateWeather(data));
  socket.on("time_update", (data) => updateTime(data));
  socket.on("network_update", (data) => updateNetwork(data));
  socket.on("lighting_update", (data) => updateLighting(data));
  socket.on("sun_update", (data) => updateSunTheme(data));
  socket.on("icloud_update", (data) => {
    updateIcloudWeekView(data);
    updateIcloudMonthView(data);
  });

  // Initial fetch in case events arrived before socket connected
  fetch("/api/weather/data")
    .then((r) => r.json())
    .then((r) => updateWeather(r.data));
  fetch("/api/time/data")
    .then((r) => r.json())
    .then((r) => updateTime(r.data));
  fetch("/api/network/data")
    .then((r) => r.json())
    .then((r) => updateNetwork(r.data));
  fetch("/api/lighting/data")
    .then((r) => r.json())
    .then((r) => updateLighting(r.data));
  fetch("/api/sun/data")
    .then((r) => r.json())
    .then((r) => updateSunTheme(r.data));
  fetch("/api/icloud/data")
    .then((r) => r.json())
    .then((r) => {
      updateIcloudWeekView(r.data);
      updateIcloudMonthView(r.data);
    });

  addTouchHandlers();
  setupCalendarTabs();
  createDayModal();

  // Move widgets to footer after DOM is loaded
  moveWidgetsToFooter();

  // Sort pending reminders by due date (soonest first)
  const pendingList = document.querySelector(
    ".reminders-list.pending-reminders"
  );
  if (pendingList) {
    const items = Array.from(pendingList.querySelectorAll(".reminder-item"));
    items.sort((a, b) => {
      // Extract date string in MM/DD/YYYY format
      const dateStrA = a
        .querySelector(".reminder-due-date")
        .textContent.match(/\d{1,2}\/\d{1,2}\/\d{4}/)[0];
      const dateStrB = b
        .querySelector(".reminder-due-date")
        .textContent.match(/\d{1,2}\/\d{1,2}\/\d{4}/)[0];
      // Parse as MM/DD/YYYY (US format)
      const [monthA, dayA, yearA] = dateStrA.split("/").map(Number);
      const [monthB, dayB, yearB] = dateStrB.split("/").map(Number);
      const dateA = new Date(yearA, monthA - 1, dayA);
      const dateB = new Date(yearB, monthB - 1, dayB);
      return dateA - dateB;
    });
    items.forEach((item) => pendingList.appendChild(item));
  }
});

function setupCalendarTabs() {
  const weekTab = document.getElementById("week-tab");
  const monthTab = document.getElementById("month-tab");
  const eventsSubtab = document.getElementById("events-subtab");
  const mealsSubtab = document.getElementById("meals-subtab");
  const weekViewContainer = document.getElementById("week-view-container");
  const monthViewContainer = document.getElementById("month-view-container");
  const mealsViewContainer = document.getElementById("meals-view-container");
  const monthSubtabs = document.getElementById("month-subtabs");

  function setActiveTab(tab) {
    [weekTab, monthTab].forEach((btn) => btn.classList.remove("active"));
    tab.classList.add("active");
  }
  function setActiveSubtab(subtab) {
    [eventsSubtab, mealsSubtab].forEach((btn) => btn.classList.remove("active"));
    subtab.classList.add("active");
  }
  function showMonthView() {
    weekViewContainer.classList.add("hidden");
    monthViewContainer.classList.remove("hidden");
    mealsViewContainer.classList.remove("hidden");
    if (eventsSubtab.classList.contains("active")) {
      monthViewContainer.style.display = "flex";
      mealsViewContainer.style.display = "none";
    } else {
      monthViewContainer.style.display = "none";
      mealsViewContainer.style.display = "flex";
      renderMealsMonthView();
    }
  }

  weekTab.addEventListener("click", () => {
    setActiveTab(weekTab);
    weekViewContainer.classList.remove("hidden");
    monthViewContainer.classList.add("hidden");
    mealsViewContainer.classList.add("hidden");
    if (monthSubtabs) monthSubtabs.style.display = "none";
  });
  monthTab.addEventListener("click", () => {
    setActiveTab(monthTab);
    if (monthSubtabs) monthSubtabs.style.display = "flex";
    setActiveSubtab(eventsSubtab);
    showMonthView();
  });
  eventsSubtab.addEventListener("click", () => {
    setActiveSubtab(eventsSubtab);
    showMonthView();
  });
  mealsSubtab.addEventListener("click", () => {
    setActiveSubtab(mealsSubtab);
    showMonthView();
  });
}

function createDayModal() {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "day-modal-overlay";
  modalOverlay.id = "day-details-modal-overlay";
  modalOverlay.innerHTML = `
    <div class="day-modal-content">
      <button class="day-modal-close-button">&times;</button>
      <h3 id="day-modal-title"></h3>
      <div id="day-modal-events"></div>
    </div>
  `;
  document.body.appendChild(modalOverlay);

  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.classList.remove("open");
    }
  });
  modalOverlay
    .querySelector(".day-modal-close-button")
    .addEventListener("click", () => {
      modalOverlay.classList.remove("open");
    });
}

// --- Weather Modal Overlay ---
function createWeatherModal() {
  if (document.getElementById("weather-modal-overlay")) return;
  const overlay = document.createElement("div");
  overlay.id = "weather-modal-overlay";
  overlay.className = "weather-modal-overlay";
  overlay.innerHTML = `
    <div class="weather-modal-content">
      <div class="weather-modal-current"></div>
      <div class="weather-modal-hourly"></div>
      <div class="weather-modal-daily"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeWeatherModal();
    }
  });
}

function openWeatherModal() {
  createWeatherModal();
  const overlay = document.getElementById("weather-modal-overlay");
  overlay.classList.add("open");
  overlay.querySelector(".weather-modal-content").classList.add("open");
  // Fetch both current and forecast data
  Promise.all([
    fetch("/api/weather/data").then((r) => r.json()),
    fetch("/api/weather/forecast").then((r) => r.json()),
  ])
    .then(([currentRes, forecastRes]) => {
      updateWeatherModal({
        current: currentRes.data,
        ...forecastRes.data,
      });
    })
    .catch((err) => {
      console.error("[WeatherModal] Error fetching weather data:", err);
      updateWeatherModal(null);
    });
}

function closeWeatherModal() {
  const overlay = document.getElementById("weather-modal-overlay");
  if (!overlay) return;
  overlay.classList.remove("open");
  overlay.querySelector(".weather-modal-content").classList.remove("open");
}

function updateWeatherModal(data) {
  const overlay = document.getElementById("weather-modal-overlay");
  if (!overlay) return;
  const modalCurrent = overlay.querySelector(".weather-modal-current");
  if (!data || !data.hourly || !data.daily || !data.current) {
    modalCurrent.innerHTML = `<div class='weather-modal-fallback'>Weather data unavailable.</div>`;
    overlay.querySelector(".weather-modal-hourly").innerHTML = "";
    overlay.querySelector(".weather-modal-daily").innerHTML = "";
    if (overlay.querySelector(".weather-modal-details"))
      overlay.querySelector(".weather-modal-details").innerHTML = "";
    return;
  }
  const c = data.current;
  // Compose city/date (use location and today's date)
  const city = (data.location || "").replace(/_/g, " ");
  const today = new Date();
  const dateStr = today.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  // Details grid with icons (emoji for now)
  // Helper: moon phase to icon
  function moonPhaseIcon(phase) {
    if (phase == null) return "🌙";
    if (phase === 0 || phase === 1) return "🌑";
    if (phase < 0.25) return "🌒";
    if (phase === 0.25) return "🌓";
    if (phase < 0.5) return "🌔";
    if (phase === 0.5) return "🌕";
    if (phase < 0.75) return "🌖";
    if (phase === 0.75) return "🌗";
    return "🌘";
  }

  const details = [
    {
      icon: "🌅",
      label: "Sunrise",
      value: c.sunrise ? formatTime(c.sunrise) : "--",
    },
    {
      icon: "🌇",
      label: "Sunset",
      value: c.sunset ? formatTime(c.sunset) : "--",
    },
    {
      icon: "💨",
      label: "Wind",
      value:
        c.wind_speed != null
          ? c.wind_speed.toFixed(1) + " mph " + windDir(c.wind_deg)
          : "--",
    },
    { icon: "💧", label: "Humidity", value: c.humidity != null ? c.humidity + " %" : "--" },
    { icon: "🎚️", label: "Pressure", value: c.pressure != null ? c.pressure + " hPa" : "--" },
    { icon: "☁️", label: "Clouds", value: c.clouds != null ? c.clouds + " %" : "--" },
    { icon: "🌡️", label: "Dew Point", value: c.dew_point ? c.dew_point.toFixed(0) + " °F" : "--" },
    { icon: "🔆", label: "UV Index", value: c.uvi != null ? c.uvi : "--" },
    {
      icon: "🫁",
      label: "Air Quality",
      value: c.air_quality != null ? airQualityText(c.air_quality) : "--",
    },
    { icon: "🌾", label: "Allergen", value: c.allergen_index != null ? c.allergen_index : "--" },
    { icon: moonPhaseIcon(c.moon_phase), label: "Moon", value: "" },
  ];
  // Assign CSS class based on data ranges and add moon icon
  details.forEach((d) => {
    const label = d.label;
    const raw = parseFloat(d.value);
    let cls = "";
    if (label === "Humidity") {
      if (raw >= 70) cls = "high";
      else if (raw >= 30) cls = "moderate";
      else cls = "low";
    } else if (label === "UV Index") {
      if (raw >= 6) cls = "high";
      else if (raw >= 3) cls = "moderate";
      else cls = "low";
    } else if (label === "Wind") {
      if (raw >= 15) cls = "high";
      else if (raw >= 7) cls = "moderate";
      else cls = "low";
    } else if (label === "Clouds") {
      if (raw >= 70) cls = "high";
      else if (raw >= 30) cls = "moderate";
      else cls = "low";
    } else if (label === "Pressure") {
      if (raw < 1000 || raw > 1020) cls = "moderate";
      else cls = "low";
    } else if (label === "Dew Point") {
      if (raw >= 60) cls = "high";
      else if (raw >= 50) cls = "moderate";
      else cls = "low";
    } else if (label === "Air Quality") {
      const m = {
        Good: "low",
        Fair: "moderate",
        Moderate: "high",
        Poor: "high",
        "Very Poor": "high",
      };
      cls = m[d.value] || "";
    }
    d.cssClass = cls;
    // if (label === 'Moon') {
    //   const icon = moonPhaseIcon(c.moon_phase);
    //   d.value = icon + ' ' + d.value;
    // }
  });
  modalCurrent.innerHTML = `
  <div class="weather-modal-current">
    <div class="weather-modal-current-left">
      <img src="https://openweathermap.org/img/wn/${c.icon || "01d"}@4x.png" class="weather-modal-icon" alt="Weather icon">
      <div>
        <div class="weather-modal-temp-holder">
          <div class="weather-modal-temp">${c.temp ? c.temp.toFixed(0) : "--"}</div>
          <div class="weather-modal-temp-type">°F</div>
        </div>
        <div class="weather-modal-feelslike">Feels Like ${c.feels_like ? c.feels_like.toFixed(0) + "°" : "--"}</div>
      </div>
    </div>
    <div class="weather-modal-current-right">
      <div class="weather-modal-city">${city}</div>
      <div class="weather-modal-date">${dateStr}</div>
      <div class="weather-modal-details-inline">
        ${details
          .map((d) => {
            let mainVal = "",
              unitVal = "";
            if (typeof d.value === "string") {
              const parts = d.value.split(" ");
              mainVal = parts.shift();
              unitVal = parts.join(" ");
            } else if (typeof d.value === "number") {
              mainVal = d.value;
              unitVal = "";
            } else {
              mainVal = d.value || "";
              unitVal = "";
            }
            return `
            <div class="weather-modal-details-row">
              <span class="weather-modal-details-icon">${d.icon}</span>
              <span class="weather-modal-details-value ${d.cssClass}">
                <span class="weather-modal-details-label">${d.label}</span>
                <div>
                  <span class="weather-modal-details-main">${mainVal}</span>
                  <span class="weather-modal-details-unit">${unitVal}</span>
                </div>
              </span>
            </div>
          `;
          })
          .join("")}
      </div>
    </div>
  </div>
  `;
  // Hourly forecast graph (24h)
  overlay.querySelector(".weather-modal-hourly").innerHTML = `
    <div class="weather-modal-section-title">Next 24 Hours</div>
    <div class="weather-modal-forecast-graph-container">
      <canvas id="weather-modal-forecast-graph" width="600" height="180" aria-label="24-hour forecast graph"></canvas>
    </div>
  `;
  // Chart.js: destroy previous modal chart if exists, then create new
  setTimeout(() => {
    const modalCanvas = document.getElementById("weather-modal-forecast-graph");
    if (window.modalForecastChart) {
      window.modalForecastChart.destroy();
      window.modalForecastChart = null;
    }
    if (modalCanvas && data.hourly) {
      const hourlyDataForModal = data.hourly.slice(0, 24);
      const modalTemps = hourlyDataForModal.map((h) => h.temp);
      const modalPops = hourlyDataForModal.map((h) => (h.pop != null ? h.pop * 100 : 0));
      const modalLabels = hourlyDataForModal.map((h) => new Date(h.dt * 1000).toLocaleTimeString([], { hour: "numeric" }));

      // Calculate Y-axis min/max for modal chart based on its first 24 hours of temperature data
      const first24ModalTemps = modalTemps.slice(0, 24).filter((t) => typeof t === "number" && isFinite(t));
      let modalYAxisMin = null;
      let modalYAxisMax = null;

      if (first24ModalTemps.length > 0) {
        const minTempIn24ForModal = Math.min(...first24ModalTemps);
        const maxTempIn24ForModal = Math.max(...first24ModalTemps);
        modalYAxisMin = Math.floor(minTempIn24ForModal - 5);
        modalYAxisMax = Math.ceil(maxTempIn24ForModal + 5);
      }

      const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { top: 20, right: 20, bottom: 20, left: 20 },
        },
        plugins: {
          legend: {
            display: false, // Hide the legend
          },
        },
        scales: {
          x: { display: true, ticks: { autoSkip: true, maxTicksLimit: 8 } },
          y1: {
            type: "linear",
            position: "left",
            title: { display: true, text: "°F" },
            ticks: { font: { size: 12 } },
          },
          y2: {
            type: "linear",
            position: "right",
            title: { display: true, text: "%" },
            ticks: { font: { size: 12 } },
            grid: { drawOnChartArea: false },
          },
        },
      };

      if (modalYAxisMin !== null && modalYAxisMax !== null && isFinite(modalYAxisMin) && isFinite(modalYAxisMax)) {
        chartOptions.scales.y1.min = modalYAxisMin;
        chartOptions.scales.y1.max = modalYAxisMax;
      }

      const ctx2 = modalCanvas.getContext("2d");
      window.modalForecastChart = new Chart(ctx2, {
        type: "bar",
        data: {
          labels: modalLabels,
          datasets: [
            {
              type: "line",
              label: "Temp (°F)",
              data: modalTemps,
              borderColor: "#ffd740",
              backgroundColor: "rgba(255,215,0,0.2)",
              yAxisID: "y1",
              tension: 0.4,
              fill: true,
            },
            {
              type: "bar",
              label: "Precip (%)",
              data: modalPops,
              backgroundColor: "rgba(64,196,255,0.6)",
              yAxisID: "y2",
            },
          ],
        },
        options: chartOptions,
      });
    }
  }, 0);
  // Daily forecast (next 5d)
  overlay.querySelector(".weather-modal-daily").innerHTML = `
    <div class="weather-modal-section-title">5-Day Forecast</div>
    <div class="weather-modal-daily-row">
      ${data.daily
        .map(
          (d) => `
        <div class="weather-modal-day">
          <div class="weather-modal-day-date">${new Date(d.dt * 1000).toLocaleDateString([], { weekday: "short" })}</div>
          <img src="https://openweathermap.org/img/wn/${d.icon}@2x.png" class="weather-modal-day-icon" alt="">
          <div class="weather-modal-day-temps">
            <span class="weather-modal-day-high">${d.temp_high.toFixed(0)}°</span>
            <span class="weather-modal-day-low">${d.temp_low.toFixed(0)}°</span>
          </div>
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

// Helper: wind direction as compass
function windDir(deg) {
  if (deg == null) return "";
  const dirs = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  return dirs[Math.round((deg / 22.5) % 16)];
}
// Helper: air quality index to text
function airQualityText(aqi) {
  if (aqi == null) return "--";
  const levels = ["--", "Good", "Fair", "Moderate", "Poor", "Very Poor"];
  return levels[aqi] || aqi;
}
// Helper: moon phase to text
function moonPhaseText(phase) {
  if (phase == null) return "--";
  if (phase === 0 || phase === 1) return "New Moon";
  if (phase < 0.25) return "Waxing Crescent";
  if (phase === 0.25) return "First Quarter";
  if (phase < 0.5) return "Waxing Gibbous";
  if (phase === 0.5) return "Full Moon";
  if (phase < 0.75) return "Waning Gibbous";
  if (phase === 0.75) return "Last Quarter";
  return "Waning Crescent";
}
// Helper: format unix timestamp to local time
function formatTime(ts) {
  if (!ts) return "--";
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Attach click handler to weather widget after DOM loaded
window.addEventListener("DOMContentLoaded", () => {
  const weather = document.getElementById("weather");
  if (weather) {
    weather.style.cursor = "pointer";
    weather.addEventListener("click", openWeatherModal);
  }
});

function showDayDetailsModal(date, events) {
  const modalOverlay = document.getElementById("day-details-modal-overlay");
  const modalTitle = document.getElementById("day-modal-title");
  const modalEventsContainer = document.getElementById("day-modal-events");

  modalTitle.textContent = date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  modalEventsContainer.innerHTML = "";

  if (events.length === 0) {
    modalEventsContainer.innerHTML =
      '<p class="day-modal-no-events">No events scheduled for this day.</p>';
  } else {
    // Sort events: all-day first, then by start time
    events.sort((a, b) => {
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;
      if (a.isAllDay && b.isAllDay) return a.title.localeCompare(b.title); // Sort all-day by title
      return new Date(a.startDate) - new Date(b.startDate);
    });

    events.forEach((event) => {
      const eventDiv = document.createElement("div");
      eventDiv.className =
        "day-modal-event" + (event.isAllDay ? " all-day" : "");

      const titleSpan = document.createElement("span");
      titleSpan.className = "day-modal-event-title";
      titleSpan.textContent = event.title;
      if (event.calendarColor) {
        titleSpan.style.color = event.calendarColor;
      }
      eventDiv.appendChild(titleSpan);

      const timeSpan = document.createElement("span");
      timeSpan.className = "day-modal-event-time";
      if (event.isAllDay) {
        timeSpan.textContent = "All-day";
      } else {
        const startTime = new Date(event.startDate).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        });
        const endTime = event.endDate
          ? new Date(event.endDate).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })
          : "";
        timeSpan.textContent = endTime ? `${startTime} - ${endTime}` : startTime;
      }
      eventDiv.appendChild(timeSpan);
      modalEventsContainer.appendChild(eventDiv);
    });
  }
  modalOverlay.classList.add("open");
}

function moveWidgetsToFooter() {
  let footer = document.querySelector(".footer");
  if (!footer) {
    footer = document.createElement("div");
    footer.className = "footer";
    // Insert footer as a section at the end of the main content, before </body>
    document.body.appendChild(footer);
  }
  const weather = document.getElementById("weather");
  const clock = document.getElementById("clock");
  const network = document.getElementById("network-status");
  // Update weather inner HTML for horizontal layout if not already
  if (weather && !weather.classList.contains("footer-layout")) {
    weather.classList.add("footer-layout");
    const icon = weather.querySelector("img");
    if (icon) {
      const details = document.createElement("div");
      details.style.display = "flex";
      details.style.flexDirection = "column";
      details.style.alignItems = "flex-start";
      // Move all weather text nodes into details
      let node = icon.nextSibling;
      while (node) {
        const next = node.nextSibling;
        if (node.nodeType === 1) details.appendChild(node);
        node = next;
      }
      weather.appendChild(details);
    }
  }
  if (weather) footer.appendChild(weather);
  if (clock) footer.appendChild(clock);
  if (network) footer.appendChild(network);
}

function updateWeather(data) {
  const w = document.getElementById("weather");
  w.innerHTML = `
    <div class="weather-flex">
      <div class="weather-icon-desc">
        <img src="https://openweathermap.org/img/wn/${
          data.icon
        }@2x.png" alt="Weather icon" class="weather-icon-large">
        <div class="description">${data.description}</div>
      </div>
      <div class="weather-temp-block">
        <div class="current-temp">${data.temp.toFixed(0)}°</div>
        <div class="high-low-col">
          <div class="high-temp">${data.high.toFixed(0)}°</div>
          <div class="low-temp">${data.low.toFixed(0)}°</div>
        </div>
      </div>
    </div>
  `;

  // Remove/hide old hourly forecast cards in the weather widget area if present
  function removeOldHourlyCards() {
    const weather = document.getElementById("weather");
    if (!weather) return;
    // Remove any .weather-hourly-cards or similar elements
    const oldCards = weather.querySelectorAll('.weather-hourly-cards, .weather-hourly-row, .weather-hourly');
    oldCards.forEach(el => el.remove());
  }
  // Call this after updating weather widget
  removeOldHourlyCards();
}

function updateTime(data) {
  const c = document.getElementById("clock");
  // Build the AM/PM label (vertical, only show the correct one)
  let ampmHtml = `<div class="ampm-label"><span class="ampm${
    data.ampm === "AM" ? "" : " hidden"
  }">AM</span><span class="ampm${
    data.ampm === "PM" ? "" : " hidden"
  }">PM</span></div>`;
  // Main time (HH:MM)
  let timeHtml = `<span class="main-time">${data.time}</span>`;
  // Seconds (smaller, greyed out)
  let secondsHtml = `<span class="seconds">${String(data.second).padStart(
    2,
    "0"
  )}</span>`;
  c.innerHTML = `<div class="clock-flex">${ampmHtml}${timeHtml}${secondsHtml}</div>`;
}

function updateNetwork(data) {
  const n = document.getElementById("network-status");
  const isOnline = data.network === "online";
  const iconClass = isOnline
    ? "network-icon network-online"
    : "network-icon network-offline";
  const label = isOnline ? "Online" : "Offline";
  n.innerHTML =
    `<span class="${iconClass}">` +
    (isOnline ? "&#9679;" : "&#10006;") +
    `</span><span class="network-label">${label}</span>`;
  const offline = document.getElementById("offline-indicator");
  if (!isOnline) {
    offline.classList.remove("hidden");
  } else {
    offline.classList.add("hidden");
  }
}

function updateLighting(data) {
  console.log("Ambient light:", data.ambient_light);
}

function updateSunTheme(data) {
  const now = new Date();
  const sunrise = new Date(data.sunrise);
  const sunset = new Date(data.sunset);
  if (now >= sunrise && now < sunset) {
    document.body.classList.add("light-mode");
    document.body.classList.remove("dark-mode");
  } else {
    document.body.classList.add("dark-mode");
    document.body.classList.remove("light-mode");
  }
}

// --- DEV STUB: Generate a week of fake events if no real data ---
function generateStubWeekEvents() {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const stubEvents = [];
  const eventTemplates = [
    { title: "Morning Meeting", startHour: 9, endHour: 10 },
    { title: "Lunch Break", startHour: 12, endHour: 13 },
    { title: "Afternoon Focus", startHour: 14, endHour: 16 },
    { title: "Evening Family", startHour: 18, endHour: 19 },
  ];
  for (let d = 0; d < 7; d++) {
    for (let e = 0; e < eventTemplates.length; e++) {
      // Stagger events for variety
      if ((d + e) % 2 === 0) {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + d);
        const start = new Date(day);
        start.setHours(eventTemplates[e].startHour, 0, 0, 0);
        const end = new Date(day);
        end.setHours(eventTemplates[e].endHour, 0, 0, 0);
        stubEvents.push({
          title: eventTemplates[e].title,
          start: start.toISOString(),
          end: end.toISOString(),
        });
      }
    }
  }
  return stubEvents;
}

// Renamed from updateIcloud to updateIcloudWeekView
function updateIcloudWeekView(data) {
  if (!data || typeof data !== "object") {
    document.getElementById("week-view-container").innerHTML =
      "<em>iCloud data unavailable.</em>";
    return;
  }
  // DEV: If no events, use stub data for development
  if (!Array.isArray(data.events) || data.events.length === 0) {
    console.log("Generating stub events");
    data.events = generateStubWeekEvents();
  }
  const cal = document.getElementById("week-view-container");
  // --- Week view calendar ---
  const events = Array.isArray(data.events) ? data.events : [];
  // Get start of this week (Sunday)
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  // Build days array
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    days.push(d);
  }
  // Group events by day
  const eventsByDay = Array(7)
    .fill(0)
    .map(() => []);
  for (const ev of events) {
    if (!ev.start) continue;
    const evStart = new Date(ev.start);
    // Only show events in this week
    for (let i = 0; i < 7; i++) {
      const day = days[i];
      if (
        evStart >= day &&
        evStart < new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
      ) {
        eventsByDay[i].push(ev);
        break;
      }
    }
  }
  // Render week grid
  let html = '<div class="week-calendar">';
  // Day headers
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  html += '<div class="day-headers">';
  for (let i = 0; i < 7; i++) {
    html += `<div class="day-header">${
      dayNames[i]
    }<br><span style='font-size:0.8em'>${days[i].getMonth() + 1}/${days[
      i
    ].getDate()}</span></div>`;
  }
  html += "</div>";
  // Day cells
  html += '<div class="day-cells">';
  const currentDayIdx = now.getDay();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  for (let i = 0; i < 7; i++) {
    const isToday = i === currentDayIdx;
    html += `<div class="day-cell${isToday ? " today" : ""}">`;
    // Hour grid lines
    for (let h = 6; h <= 22; h++) {
      const hourPct = ((h - 6) / 16) * 100;
      html += `<div class="hour-line" style="top:${hourPct}%;">`;
      if (h % 2 === 0) {
        html += `<span class="hour-label">${h}:00</span>`;
      }
      html += `</div>`;
    }
    // Current time line (only on today)
    if (isToday) {
      const nowPct = ((currentHour - 6) / 16) * 100;
      html += `<div class="current-time-line" style="top:${nowPct}%;"></div>`;
    }
    if (eventsByDay[i].length === 0) {
      html += '<div class="no-events">No Events</div>';
    } else {
      // Sort events by start time
      eventsByDay[i].sort((a, b) => new Date(a.start) - new Date(b.start));
      for (const ev of eventsByDay[i]) {
        const st = new Date(ev.start);
        const et = ev.end ? new Date(ev.end) : null;
        let startHour = st.getHours() + st.getMinutes() / 60;
        let endHour = et ? et.getHours() + et.getMinutes() / 60 : startHour + 1;
        const minHour = 6,
          maxHour = 22;
        startHour = Math.max(startHour, minHour);
        endHour = Math.min(endHour, maxHour);
        const totalHours = maxHour - minHour;
        const topPct = ((startHour - minHour) / totalHours) * 100;
        const heightPct = Math.max(
          8,
          ((endHour - startHour) / totalHours) * 100
        );
        const lineHeightEm = 1.1,
          fontSizeEm = 0.92;
        const pxPerEm = 16;
        const threeLinePx = 3 * lineHeightEm * fontSizeEm * pxPerEm;
        const showOnlyLabel = heightPct < 18;
        // --- Overlapping event layout ---
        // Find overlaps for this day
        const overlaps = eventsByDay[i].filter((e2) => {
          if (e2 === ev) return false;
          const s2 = new Date(e2.start),
            e2end = e2.end ? new Date(e2.end) : null;
          const s2h = Math.max(minHour, s2.getHours() + s2.getMinutes() / 60);
          const e2h = e2end
            ? Math.min(maxHour, e2end.getHours() + e2end.getMinutes() / 60)
            : s2h + 1;
          return startHour < e2h && endHour > s2h;
        });
        // Assign a column index for this event
        let colIdx = 0,
          colCount = 1;
        if (overlaps.length > 0) {
          // Sort by start time, assign columns
          const sorted = [ev, ...overlaps].sort(
            (a, b) => new Date(a.start) - new Date(b.start)
          );
          colIdx = sorted.findIndex((e2) => e2 === ev);
          colCount = sorted.length;
        }
        // Set width and left offset for overlapping events
        const widthPct = 100 / colCount;
        const leftPct = colIdx * widthPct;
        // Use event color if available
        const bgColor = ev.color || "#1976d2";
        const textColor = "#fff";
        if (showOnlyLabel) {
          html += `<div class="event-block event-vertical" title="${
            ev.title
          }" data-event-uid="${ev.uid || ""}"
            style="position:absolute; left:${leftPct}%; width:calc(${widthPct}% - 8px); top:${topPct}%; height:${heightPct}%; background:${bgColor}; color:${textColor}; display:flex; align-items:center; justify-content:center;">
            <span class="event-title">${ev.title}</span>
          </div>`;
        } else {
          const startStr = st.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          const endStr = et
            ? et.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "";
          html += `<div class="event-block event-vertical" title="${
            ev.title
          }" data-event-uid="${ev.uid || ""}"
            style="position:absolute; left:${leftPct}%; calc(${widthPct}% - 8px); top:${topPct}%; height:${heightPct}%; background:${bgColor}; color:${textColor}; display:flex; flex-direction:column; justify-content:space-between;">
            <span class="event-time event-time-start">${startStr}</span>
            <span class="event-title">${ev.title}</span>
            <span class="event-time event-time-end">${endStr}</span>
          </div>`;
        }
      }
    }
    html += "</div>";
  }
  html += "</div></div>";
  cal.innerHTML = html;

  // Add event listeners for event blocks
  document.querySelectorAll("#week-view-container .event-block").forEach((block) => {
    block.addEventListener("click", (e) => {
      const uid = e.currentTarget.dataset.eventUid;
      if (uid) {
        const eventData = events.find((ev) => ev.uid === uid);
        if (eventData) {
          showEventDetailsModal(eventData);
        }
      }
    });
  });

  const rem = document.getElementById("reminders");
  rem.innerHTML = ""; // Clear existing reminders content

  const remindersTitle = document.createElement("h3");
  remindersTitle.textContent = "Reminders";
  rem.appendChild(remindersTitle);

  const pendingReminders = document.createElement("div");
  pendingReminders.className = "reminders-list pending-reminders";
  rem.appendChild(pendingReminders);

  const doneReminders = document.createElement("div");
  doneReminders.className = "reminders-list done-reminders";
  const doneTitle = document.createElement("h4");
  doneTitle.textContent = "Completed!";
  doneReminders.appendChild(doneTitle);
  rem.appendChild(doneReminders);

  if (Array.isArray(data.reminders)) {
    data.reminders.forEach((r) => {
      const reminderItem = document.createElement("div");
      reminderItem.className = `reminder-item priority-${
        r.priority || "medium"
      }`;
      if (r.done) {
        reminderItem.classList.add("done");
      }

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = r.done;
      checkbox.addEventListener("change", () => {
        // Here you would typically send an update to the server
        console.log(
          `Reminder '${r.title}' toggled to ${
            checkbox.checked ? "done" : "pending"
          }`
        );
        r.done = checkbox.checked; // Update local state

        // Determine animation direction
        const isMovingToDone = r.done;
        const outAnimationClass = isMovingToDone
          ? "reminder-item-animating-out-down"
          : "reminder-item-animating-out-up";
        const inAnimationClass = isMovingToDone
          ? "reminder-item-animating-in-down"
          : "reminder-item-animating-in-up";

        // Animate out
        reminderItem.classList.add(outAnimationClass);

        reminderItem.addEventListener(
          "animationend",
          function handleAnimationEnd() {
            reminderItem.removeEventListener(
              "animationend",
              handleAnimationEnd
            );
            reminderItem.classList.remove(outAnimationClass);

            // Move item between lists
            if (r.done) {
              doneReminders.appendChild(reminderItem);
              reminderItem.classList.add("done");
            } else {
              pendingReminders.appendChild(reminderItem);
              reminderItem.classList.remove("done");
            }
            // Animate in
            reminderItem.classList.add(inAnimationClass);
            reminderItem.addEventListener(
              "animationend",
              function handleInAnimationEnd() {
                reminderItem.removeEventListener(
                  "animationend",
                  handleInAnimationEnd
                );
                reminderItem.classList.remove(inAnimationClass);
              },
              { once: true }
            );

            // If doneReminders was empty and now has items, or vice-versa, toggle visibility of title
            doneTitle.style.display =
              doneReminders.children.length > 1 ? "block" : "none";
          },
          { once: true }
        );
      });

      const titleSpan = document.createElement("span");
      titleSpan.className = "reminder-title";
      titleSpan.textContent = r.title;

      reminderItem.appendChild(checkbox);
      reminderItem.appendChild(titleSpan);

      if (r.due) {
        const dueDateSpan = document.createElement("span");
        dueDateSpan.className = "reminder-due-date";
        dueDateSpan.textContent = ` (Due: ${new Date(
          r.due
        ).toLocaleDateString()})`;
        reminderItem.appendChild(dueDateSpan);
      }

      if (r.done) {
        doneReminders.appendChild(reminderItem);
      } else {
        pendingReminders.appendChild(reminderItem);
      }
    });
  }

  // Sort pending reminders by due date (soonest first) after building list
  const postPending = rem.querySelector(".reminders-list.pending-reminders");
  if (postPending) {
    const sortedItems = Array.from(
      postPending.querySelectorAll(".reminder-item")
    );
    sortedItems.sort((a, b) => {
      const matchA = a
        .querySelector(".reminder-due-date")
        .textContent.match(/\d{1,2}\/\d{1,2}\/\d{4}/);
      const matchB = b
        .querySelector(".reminder-due-date")
        .textContent.match(/\d{1,2}\/\d{1,2}\/\d{4}/);
      const [mA, dA, yA] = matchA[0].split("/").map(Number);
      const [mB, dB, yB] = matchB[0].split("/").map(Number);
      return new Date(yA, mA - 1, dA) - new Date(yB, mB - 1, dB);
    });
    sortedItems.forEach((item) => postPending.appendChild(item));
  }

  // Initially hide "Completed!" if no done tasks
  doneTitle.style.display =
    doneReminders.children.length > 1 ? "block" : "none";

  const img = document.getElementById("shared-photo");
  if (data.photo) img.src = data.photo;
}

function updateIcloudMonthView(data) {
  if (!data || typeof data !== "object") {
    console.warn("No data for month view or data is not an object:", data);
    return;
  }
  const monthViewContainer = document.getElementById("month-view-container");
  if (!monthViewContainer) {
    console.error("Month view container not found");
    return;
  }

  // --- Map events to expected structure for month view ---
  const events = Array.isArray(data.events)
    ? data.events.map((ev) => {
        // Map backend/stub event fields to month view fields
        const start = new Date(ev.start);
        const end = ev.end ? new Date(ev.end) : null;
        // All-day: if event starts at 00:00 and ends at 00:00 next day, or has allDay property
        let isAllDay = false;
        if (ev.allDay !== undefined) {
          isAllDay = !!ev.allDay;
        } else if (
          start.getHours() === 0 &&
          start.getMinutes() === 0 &&
          end &&
          end - start === 24 * 60 * 60 * 1000
        ) {
          isAllDay = true;
        }
        // Color: use ev.color or fallback
        let calendarColor =
          ev.color ||
          (ev.calendar &&
          data.calendars &&
          Array.isArray(data.calendars)
            ? (data.calendars.find((c) => c.name === ev.calendar) || {}).color
            : undefined) || "#1976d2";
        return {
          ...ev,
          startDate: ev.start,
          endDate: ev.end,
          isAllDay,
          calendarColor,
        };
      })
    : [];

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const todayDate = now.getDate();

  // Header for the month
  let monthHeaderHtml = `<div class="month-header"><h2>${now.toLocaleDateString(
    undefined,
    { month: "long", year: "numeric" }
  )}</h2></div>`;

  // Day names header for the grid
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let gridHeaderHtml = '<div class="month-grid-header">';
  dayNames.forEach((name) => (gridHeaderHtml += `<div>${name}</div>`));
  gridHeaderHtml += "</div>";

  let monthGridHtml = '<div class="month-grid">';

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

  // Calculate the start of the grid (Sunday of the week the 1st falls in)
  let gridStartDate = new Date(firstDayOfMonth);
  gridStartDate.setDate(gridStartDate.getDate() - gridStartDate.getDay());

  const allEventsForModal = {}; // Store events per day for the modal

  for (let i = 0; i < 42; i++) {
    // 6 weeks * 7 days = 42 cells
    const cellDate = new Date(gridStartDate);
    cellDate.setDate(gridStartDate.getDate() + i);

    const dayKey = cellDate.toISOString().split("T")[0]; // YYYY-MM-DD
    allEventsForModal[dayKey] = [];

    let cellClasses = "month-day-cell";
    if (cellDate.getMonth() !== currentMonth) {
      cellClasses += " other-month";
    }
    if (
      cellDate.getFullYear() === currentYear &&
      cellDate.getMonth() === currentMonth &&
      cellDate.getDate() === todayDate
    ) {
      cellClasses += " today";
    }

    monthGridHtml += `<div class="${cellClasses}" data-date="${dayKey}">`;
    monthGridHtml += `<div class="day-number">${cellDate.getDate()}</div>`;
    monthGridHtml += `<div class="month-day-cell-events">`;

    // Filter and sort events for this specific day
    const dayEvents = events
      .filter((event) => {
        const eventStartDate = new Date(event.startDate);
        const eventEndDate = event.endDate ? new Date(event.endDate) : null;
        // Check if event is on this day
        if (event.isAllDay) {
          // All-day events: show if any overlap with this day
          return eventStartDate <= cellDate && eventEndDate > cellDate;
        } else {
          // Timed events: show if start is on this day
          return eventStartDate.toDateString() === cellDate.toDateString();
        }
      })
      .sort((a, b) => {
        // Sort: all-day first, then by time
        if (a.isAllDay && !b.isAllDay) return -1;
        if (!a.isAllDay && b.isAllDay) return 1;
        if (a.isAllDay && b.isAllDay) return a.title.localeCompare(b.title);
        return new Date(a.startDate) - new Date(b.startDate);
      });

    allEventsForModal[dayKey] = dayEvents; // Store for modal

    dayEvents.forEach((event) => {
      // Add class for all-day or timed event
      const eventTypeClass = event.isAllDay ? "all-day" : "timed";
      monthGridHtml += `<div class="month-event-item ${eventTypeClass}" style="background-color: ${event.calendarColor || "#e0e0e0"}; color: ${getContrastColor(
        event.calendarColor || "#e0e0e0"
      )}" title="${event.title}">${event.title}</div>`;
    });

    monthGridHtml += `</div></div>`; // Close month-day-cell-events and month-day-cell
  }
  monthGridHtml += "</div>"; // Close month-grid

  monthViewContainer.innerHTML = monthHeaderHtml + gridHeaderHtml + monthGridHtml;

  // After rendering, handle event overflow for each day cell
  monthViewContainer.querySelectorAll(".month-day-cell-events").forEach((eventList) => {
    const maxVisible = 5; // Show up to 3 events, rest are hidden
    const eventItems = Array.from(eventList.querySelectorAll(".month-event-item"));
    if (eventItems.length > maxVisible) {
      // Hide extra events
      eventItems.forEach((item, idx) => {
        if (idx >= maxVisible) item.classList.add("hidden-event");
      });
      // Add a '+N more' link
      const moreCount = eventItems.length - maxVisible;
      const showMore = document.createElement("div");
      showMore.className = "show-more";
      showMore.textContent = `+${moreCount} more`;
      showMore.addEventListener("click", (e) => {
        e.stopPropagation();
        // Show all events in modal for this day
        const parentCell = eventList.closest(".month-day-cell");
        if (parentCell) {
          const dateStr = parentCell.dataset.date;
          const cellDate = new Date(dateStr + "T00:00:00");
          showDayDetailsModal(cellDate, allEventsForModal[dateStr] || []);
        }
      });
      eventList.appendChild(showMore);
    }
  });

  // Add click listeners to day cells for the modal
  monthViewContainer.querySelectorAll(".month-day-cell").forEach((cell) => {
    cell.addEventListener("click", function (e) {
      // Prevent day click if clicking on an event (event will handle its own click)
      if (e.target.closest(".month-event-item")) return;
      const dateStr = cell.dataset.date;
      const cellDate = new Date(dateStr + "T00:00:00"); // Ensure correct date object from string
      showDayDetailsModal(cellDate, allEventsForModal[dateStr] || []);
    });
  });

  // Add click listeners to each event in the month view to show event details modal
  monthViewContainer.querySelectorAll(".month-event-item").forEach((eventDiv) => {
    eventDiv.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent triggering the day cell click
      // Find the event data for this event
      const title = eventDiv.getAttribute("title");
      // Find the event in the events array for this day
      const parentCell = eventDiv.closest(".month-day-cell");
      const dateStr = parentCell ? parentCell.dataset.date : null;
      const dayEvents = dateStr ? allEventsForModal[dateStr] || [] : [];
      // Try to match by title and color (could be improved with UID if available)
      const eventData =
        dayEvents.find(
          (ev) =>
            ev.title === title &&
            eventDiv.style.backgroundColor.replace(/\s/g, "") ===
              (ev.calendarColor ? ev.calendarColor.replace(/\s/g, "") : "")
        ) || dayEvents.find((ev) => ev.title === title) || null;
      if (eventData) {
        showEventDetailsModal(eventData);
      }
    });
  });
}

function showEventDetailsModal(eventData) {
  // Remove existing modal if any
  const existingModal = document.getElementById("event-details-modal");
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement("div");
  modal.id = "event-details-modal";
  modal.className = "event-details-modal-overlay"; // Initial state for animation is in CSS

  const modalContent = document.createElement("div");
  modalContent.className = "event-details-modal-content";

  // Darken the event color for the modal background
  const eventColor = eventData.color || "#1976d2";
  modalContent.style.backgroundColor = darkenColor(eventColor, 20); // Darken by 20%
  // Ensure text color contrasts with the new background
  modalContent.style.color = getContrastColor(
    modalContent.style.backgroundColor
  );

  let contentHtml = `<h2>${eventData.title}</h2>`;
  const startDate = new Date(eventData.start);
  const endDate = eventData.end ? new Date(eventData.end) : null;

  // Calculate duration
  let durationStr = "All day";
  if (endDate) {
    const diffMs = endDate - startDate;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (diffHours > 0 && diffMins > 0) {
      durationStr = `${diffHours}h ${diffMins}m`;
    } else if (diffHours > 0) {
      durationStr = `${diffHours} hour${diffHours > 1 ? "s" : ""}`;
    } else if (diffMins > 0) {
      durationStr = `${diffMins} minute${diffMins > 1 ? "s" : ""}`;
    } else if (diffMs > 0) {
      // Less than a minute, show as 1 minute
      durationStr = "1 minute";
    }
    // If it's exactly 24 hours and starts at midnight, could also be considered "All day"
    if (
      diffMs === 24 * 60 * 60 * 1000 &&
      startDate.getHours() === 0 &&
      startDate.getMinutes() === 0
    ) {
      durationStr = "All day";
    }
  }

  contentHtml += `<p><strong>Duration:</strong> ${durationStr}</p>`;

  const startTimeFormatted = startDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  let endTimeFormatted = "";
  let fullDateTimeInfo = `From: ${startDate.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  })} at ${startTimeFormatted}`;

  if (endDate) {
    endTimeFormatted = endDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    if (startDate.toDateString() === endDate.toDateString()) {
      fullDateTimeInfo += ` to ${endTimeFormatted}`;
    } else {
      fullDateTimeInfo += ` to ${endDate.toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
      })} at ${endTimeFormatted}`;
    }
  }
  contentHtml += `<p class="event-time-details">${fullDateTimeInfo}</p>`;

  contentHtml += `<p><strong>Calendar:</strong> ${
    eventData.calendar || "N/A"
  }</p>`;

  if (eventData.attendees && eventData.attendees.length > 0) {
    contentHtml += `<p><strong>Attendees:</strong></p><ul>`;
    eventData.attendees.forEach((att) => {
      const statusClass = att.status
        ? att.status.toLowerCase().replace("-", "")
        : "noreply";
      contentHtml += `<li><span class="attendee-status-icon status-${statusClass}"></span>${att.name} (${att.email})</li>`;
    });
    contentHtml += `</ul>`;
  }

  modalContent.innerHTML = contentHtml;

  const closeButton = document.createElement("button");
  closeButton.textContent = "Close";
  closeButton.className = "event-modal-close-button";
  closeButton.onclick = () => {
    modal.classList.remove("open"); // Trigger close animation
    modal.addEventListener("transitionend", () => modal.remove(), {
      once: true,
    });
  };
  modalContent.appendChild(closeButton);

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Trigger open animation
  requestAnimationFrame(() => {
    modal.classList.add("open");
  });

  // Close modal if clicking outside of modal-content
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.remove("open");
      modal.addEventListener("transitionend", () => modal.remove(), {
        once: true,
      });
    }
  });
}

// Helper function to darken a hex color
function darkenColor(hex, percent) {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);

  r = Math.floor(r * (1 - percent / 100));
  g = Math.floor(g * (1 - percent / 100));
  b = Math.floor(b * (1 - percent / 100));

  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));

  return `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// Helper function to get contrasting text color (black or white)
function getContrastColor(hexColor) {
  if (hexColor.startsWith("#")) {
    hexColor = hexColor.slice(1);
  }
  const r = parseInt(hexColor.slice(0, 2), 16);
  const g = parseInt(hexColor.slice(2, 4), 16);
  const b = parseInt(hexColor.slice(4, 6), 16);
  // Standard luminance calculation
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#FFFFFF";
}

// --- Chart.js Forecast Charts ---
let mainForecastChart;
let modalForecastChart;

function initForecastCharts() {
  const mainCanvas = document.getElementById("weather-forecast-graph");
  if (mainCanvas) {
    const ctx = mainCanvas.getContext("2d");
    mainForecastChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: [],
        datasets: [
          {
            type: "line",
            label: "Temp (°F)",
            data: [],
            borderColor: "#ffd740",
            backgroundColor: "rgba(255,215,0,0.2)",
            yAxisID: "y1",
            tension: 0.4,
            fill: true,
          },
          {
            type: "bar",
            label: "Precip (%)",
            data: [],
            backgroundColor: "rgba(64,196,255,0.6)",
            yAxisID: "y2",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { top: 30, right: 30, bottom: 30, left: 30 },
        },
        plugins: {
          legend: {
            labels: {
              font: { size: 16 },
              padding: 30,
            },
          },
        },
        scales: {
          x: {
            display: true,
            ticks: {
              autoSkip: true,
              maxTicksLimit: 8,
              font: { size: 14 },
              padding: 10,
            },
          },
          y1: {
            type: "linear",
            position: "left",
            title: { display: true, text: "°F", font: { size: 16 } },
            ticks: { font: { size: 14 }, padding: 10 },
          },
          y2: {
            type: "linear",
            position: "right",
            title: { display: true, text: "%", font: { size: 16 } },
            ticks: { font: { size: 14 }, padding: 10 },
            grid: { drawOnChartArea: false },
          },
        },
      },
    });
  }
  const modalCanvas = document.getElementById("weather-modal-forecast-graph");
  if (modalCanvas) {
    const ctx2 = modalCanvas.getContext("2d");
    modalForecastChart = new Chart(ctx2, JSON.parse(JSON.stringify(mainForecastChart.config)));
  }
}

function updateForecastCharts(hourly) {
  const labels = hourly.slice(0, 24).map((h) => new Date(h.dt * 1000).toLocaleTimeString([], { hour: "numeric" }));
  const tempsData = hourly.slice(0, 24).map((h) => h.temp);
  const pops = hourly.slice(0, 24).map((h) => (h.pop != null ? h.pop * 100 : 0));

  // Calculate Y-axis min/max based on the first 24 hours of temperature data
  const first24Temps = tempsData.slice(0, 24).filter((t) => typeof t === "number" && isFinite(t));
  let yAxisMin = null;
  let yAxisMax = null;

  if (first24Temps.length > 0) {
    const minTempIn24Hours = Math.min(...first24Temps);
    const maxTempIn24Hours = Math.max(...first24Temps);
    yAxisMin = Math.floor(minTempIn24Hours - 5);
    yAxisMax = Math.ceil(maxTempIn24Hours + 5);
  }

  const chartsToUpdate = [mainForecastChart, modalForecastChart];

  chartsToUpdate.forEach((chart) => {
    if (chart) {
      if (yAxisMin !== null && yAxisMax !== null && isFinite(yAxisMin) && isFinite(yAxisMax)) {
        chart.options.scales.y1.min = yAxisMin;
        chart.options.scales.y1.suggestedMin = yAxisMin;
        chart.options.scales.y1.max = yAxisMax;
        chart.options.scales.y1.suggestedMax = yAxisMax;
      } else {
        // Revert to auto-scaling if no valid data or calculated min/max are not finite
        delete chart.options.scales.y1.min;
        delete chart.options.scales.y1.suggestedMin;
        delete chart.options.scales.y1.max;
        delete chart.options.scales.y1.suggestedMax;
      }
      chart.data.labels = labels;
      chart.data.datasets[0].data = tempsData; // Full 24h data for the line
      chart.data.datasets[1].data = pops;     // Full 24h data for precip
      chart.update();
    }
  });
}

// Replace custom fetchAndUpdateForecast with Chart.js update
function fetchAndUpdateForecast() {
  fetch("/api/weather/forecast")
    .then((r) => r.json())
    .then((r) => {
      if (r.data && Array.isArray(r.data.hourly)) {
        updateForecastCharts(r.data.hourly);
      }
    });
}

// Initialize charts and fetch data on DOM load
window.addEventListener("DOMContentLoaded", () => {
  initForecastCharts();
  fetchAndUpdateForecast();
  if (window.io) {
    const socket = io();
    socket.on("weather_update", () => fetchAndUpdateForecast());
  }
});

function addTouchHandlers() {
  // Touch interactions (stubbed)
}

function renderMealsMonthView() {
  const mealsViewContainer = document.getElementById("meals-view-container");
  if (!mealsViewContainer) return;
  // For now, use current month and year
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const todayDate = now.getDate();

  // Header
  let monthHeaderHtml = `<div class="month-header"><h2>${now.toLocaleDateString(
    undefined,
    { month: "long", year: "numeric" }
  )}</h2></div>`;
  // Day names header
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let gridHeaderHtml = '<div class="meals-grid-header">';
  dayNames.forEach((name) => (gridHeaderHtml += `<div>${name}</div>`));
  gridHeaderHtml += "</div>";
  let mealsGridHtml = '<div class="meals-grid">';
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  let gridStartDate = new Date(firstDayOfMonth);
  gridStartDate.setDate(gridStartDate.getDate() - gridStartDate.getDay());
  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(gridStartDate);
    cellDate.setDate(gridStartDate.getDate() + i);
    let cellClasses = "meals-day-cell";
    if (cellDate.getMonth() !== currentMonth) cellClasses += " other-month";
    if (
      cellDate.getFullYear() === currentYear &&
      cellDate.getMonth() === currentMonth &&
      cellDate.getDate() === todayDate
    )
      cellClasses += " today";
    mealsGridHtml += `<div class="${cellClasses}" data-date="${cellDate.toISOString().split("T")[0]}">`;
    mealsGridHtml += `<div class="day-number">${cellDate.getDate()}</div>`;
    mealsGridHtml += `<div class="meals-zones">`;
    ["Breakfast", "Lunch", "Dinner"].forEach((zone) => {
      mealsGridHtml += `<div class="meal-zone"><span class="meal-zone-label">${zone}</span><div class="recipe-slot"></div><button class="add-recipe-btn" title="Add recipe">+</button></div>`;
    });
    mealsGridHtml += `</div></div>`;
  }
  mealsGridHtml += "</div>";
  mealsViewContainer.innerHTML = monthHeaderHtml + gridHeaderHtml + mealsGridHtml;
}