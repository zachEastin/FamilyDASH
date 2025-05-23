// Attach click handler to weather widget after DOM loaded
window.addEventListener("DOMContentLoaded", () => {
  const weather = document.getElementById("weather");
  if (weather) {
    weather.style.cursor = "pointer";
    weather.addEventListener("click", openWeatherModal);
  }
});

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
        elements: {
          line: {
            borderJoinStyle: 'round' // Smoother line connection
          }
        }
      };

      if (modalYAxisMin !== null && modalYAxisMax !== null && isFinite(modalYAxisMin) && isFinite(modalYAxisMax)) {
        chartOptions.scales.y1.min = modalYAxisMin;
        chartOptions.scales.y1.max = modalYAxisMax;
      }

      const ctx2 = modalCanvas.getContext("2d");
      window.modalForecastChart = new Chart(ctx2, {
        type: "line",
        data: {
          labels: modalLabels,
          datasets: [
            {
              type: "line",
              label: "Temp (°F)",
              data: modalTemps,
              borderColor: "rgba(255,215,64,0.9)",
              borderWidth: 2,
              pointRadius: 0,
              backgroundColor: "rgba(255,215,0,0.2)",
              yAxisID: "y1",
              tension: 0.5,
              fill: true,
            },
            {
              type: "bar",
              label: "Precip (%)",
              data: modalPops,
              borderColor: "rgba(64,196,255,1)",
              // backgroundColor: "rgba(64,196,255,0.2)",
              borderWidth: {
                top: 2,
                right: 0,
                bottom: 0,
                left: 0
              },
              yAxisID: "y2",
              barPercentage: 1.0,
              categoryPercentage: 1.0,
              fill: true,
            },
          ],
        },
        options: chartOptions,
      });
      window.modalForecastChart.update();

      // Now, after the chart is created, we can access the scales
      const gradientStart = window.modalForecastChart.scales['y1'].getPixelForValue(modalYAxisMax); // Max temperature
      const gradientEnd = window.modalForecastChart.scales['y1'].getPixelForValue(modalYAxisMin);   // Min temperature

      // Create gradient based on y-axis values
      const tempGradient = ctx2.createLinearGradient(0, gradientStart, 0, gradientEnd - 10);
      for(var t = 0; t <= 1; t += 0.02) {    // convert linear t to "easing" t:
        // Interpolate alpha between 0.95 (t=0) and 0.01 (t=1)
        const alpha = 0.95 + (0.01 - 0.95) * t;
        tempGradient.addColorStop(t, `rgba(252,204,5, ${alpha})`);
      }
      // tempGradient.addColorStop(0, 'rgba(252,204,5, 0.95)'); // Top of the gradient (max temperature)
      // tempGradient.addColorStop(1, 'rgba(252,204,5, 0.01)'); // Bottom of the gradient (min temperature)

      // Update the chart to apply the gradient
      window.modalForecastChart.data.datasets[0].backgroundColor = tempGradient;

      // Create gradient based on y-axis values
      const precipitationGradient = ctx2.createLinearGradient(0, gradientStart, 0, gradientEnd - 80);
      const r1 = 26;
      const g1 = 111;
      const b1 = 176;
      const r2 = 194;
      const g2 = 223;
      const b2 = 246;
      for(var t = 0; t <= 1; t += 0.02) {    // convert linear t to "easing" t:
        // Interpolate the color between rgba(26, 111, 176, 0.8) (t=0) and rgba(194, 223, 246, 0) (t=1)
        const alpha = 0.8 + (0 - 0.8) * t;
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);
        const color = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        // Add color stop to the gradient
        precipitationGradient.addColorStop(t, color);
      }
      // precipitationGradient.addColorStop(0, 'rgba(26, 111, 176, 0.8)'); // Top of the gradient (max temperature)
      // precipitationGradient.addColorStop(1, 'rgba(194, 223, 246, 0)'); // Bottom of the gradient (min temperature)

      window.modalForecastChart.data.datasets[1].backgroundColor = precipitationGradient;

      window.modalForecastChart.update();
    }
  }, 0);
  // Daily forecast (next 16d)
  overlay.querySelector(".weather-modal-daily").innerHTML = `
    <div class="weather-modal-section-title">16-Day Forecast</div>
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