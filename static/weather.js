// Global variable to store daily weather data for submodal access
let cachedDailyWeatherData = null;

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
  }, 0);  // Cache daily data for submodal access
  cachedDailyWeatherData = data.daily;
  
  // Daily forecast (next 16d)
  overlay.querySelector(".weather-modal-daily").innerHTML = `
    <div class="weather-modal-section-title">16-Day Forecast</div>
    <div class="weather-modal-daily-row">
      ${data.daily
        .map(
          (d, index) => `
        <div class="weather-modal-day" data-day-index="${index}">
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
  // --- Enable horizontal scroll for daily row ---
  setTimeout(() => {
    const dailyRow = overlay.querySelector('.weather-modal-daily-row');
    if (!dailyRow) return;
    
    // Add click listeners to day elements for submodal
    const dayElements = dailyRow.querySelectorAll('.weather-modal-day');
    dayElements.forEach(dayElement => {
      dayElement.style.cursor = 'pointer';
      dayElement.addEventListener('click', (e) => {
        e.stopPropagation();
        const dayIndex = parseInt(dayElement.getAttribute('data-day-index'));
        if (cachedDailyWeatherData && cachedDailyWeatherData[dayIndex]) {
          showWeatherForecastDaySubmodal(cachedDailyWeatherData[dayIndex]);
        }
      });
    });
    
    // Mouse wheel: vertical wheel scrolls horizontally
    dailyRow.addEventListener('wheel', function(e) {
      if (e.deltaY !== 0) {
        e.preventDefault();
        dailyRow.scrollLeft += e.deltaY;
      }
    }, { passive: false });
    // Touch swipe: horizontal swipe scrolls
    let startX = 0, scrollLeft = 0, isDown = false;
    dailyRow.addEventListener('touchstart', function(e) {
      if (e.touches.length !== 1) return;
      isDown = true;
      startX = e.touches[0].pageX - dailyRow.offsetLeft;
      scrollLeft = dailyRow.scrollLeft;
    });
    dailyRow.addEventListener('touchmove', function(e) {
      if (!isDown || e.touches.length !== 1) return;
      const x = e.touches[0].pageX - dailyRow.offsetLeft;
      const walk = (startX - x); // drag left/right
      dailyRow.scrollLeft = scrollLeft + walk;
    });
    dailyRow.addEventListener('touchend', function() {
      isDown = false;
    });
    dailyRow.addEventListener('touchcancel', function() {
      isDown = false;
    });
  }, 0);
}

// --- Weather Forecast Day Submodal Functions ---
function createWeatherForecastDaySubmodal() {
  if (document.getElementById("weather-forecast-day-submodal-overlay")) return;
  
  const overlay = document.createElement("div");
  overlay.id = "weather-forecast-day-submodal-overlay";
  overlay.className = "weather-forecast-day-submodal-overlay";
  overlay.innerHTML = `
    <div class="weather-forecast-day-submodal-content">
      <button class="weather-forecast-day-close">&times;</button>
      <div class="weather-forecast-day-header">
        <h3 class="weather-forecast-day-title"></h3>
        <p class="weather-forecast-day-date"></p>
      </div>
      <div class="weather-forecast-day-main">
        <img class="weather-forecast-day-icon" alt="Weather icon">
        <div class="weather-forecast-day-temps">
          <div class="weather-forecast-day-high-low">
            <span class="weather-forecast-day-high"></span>
            <span class="weather-forecast-day-low"></span>
          </div>
          <p class="weather-forecast-day-description"></p>
        </div>
      </div>
      <div class="weather-forecast-day-summary">
      </div>
      <div class="weather-forecast-day-temp-breakdown">
        <h4 class="weather-forecast-day-section-title">Temperature Details</h4>
        <div class="weather-forecast-day-temp-grid">
          <div class="weather-forecast-day-temp-item">
            <span class="weather-forecast-day-temp-label">Morning</span>
            <span class="weather-forecast-day-temp-value" data-temp="morn"></span>
          </div>
          <div class="weather-forecast-day-temp-item">
            <span class="weather-forecast-day-temp-label">Day</span>
            <span class="weather-forecast-day-temp-value" data-temp="day"></span>
          </div>
          <div class="weather-forecast-day-temp-item">
            <span class="weather-forecast-day-temp-label">Evening</span>
            <span class="weather-forecast-day-temp-value" data-temp="eve"></span>
          </div>
          <div class="weather-forecast-day-temp-item">
            <span class="weather-forecast-day-temp-label">Night</span>
            <span class="weather-forecast-day-temp-value" data-temp="night"></span>
          </div>
        </div>
      </div>
      <div class="weather-forecast-day-details"></div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Close on overlay click
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeWeatherForecastDaySubmodal();
    }
  });
  
  // Close on close button click
  overlay.querySelector(".weather-forecast-day-close").addEventListener("click", closeWeatherForecastDaySubmodal);
}

function showWeatherForecastDaySubmodal(dayData) {
  createWeatherForecastDaySubmodal();
  
  const overlay = document.getElementById("weather-forecast-day-submodal-overlay");
  const content = overlay.querySelector(".weather-forecast-day-submodal-content");
  
  // Populate the submodal with day data
  populateWeatherForecastDaySubmodal(dayData);
  
  // Show the submodal
  overlay.classList.add("open");
  setTimeout(() => {
    content.classList.add("open");
  }, 10);
}

function closeWeatherForecastDaySubmodal() {
  const overlay = document.getElementById("weather-forecast-day-submodal-overlay");
  if (!overlay) return;
  
  const content = overlay.querySelector(".weather-forecast-day-submodal-content");
  content.classList.remove("open");
  
  setTimeout(() => {
    overlay.classList.remove("open");
  }, 300);
}

function populateWeatherForecastDaySubmodal(data) {
  const dayData = data.full_data;
  const overlay = document.getElementById("weather-forecast-day-submodal-overlay");
  if (!overlay) return;
  
  // Date and title
  const date = new Date(dayData.dt * 1000);
  const dayName = date.toLocaleDateString(undefined, { weekday: "long" });
  const dateStr = date.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  
  overlay.querySelector(".weather-forecast-day-title").textContent = dayName;
  overlay.querySelector(".weather-forecast-day-date").textContent = dateStr;
  overlay.querySelector(".weather-forecast-day-summary").textContent = dayData.summary || "";
  
  // Weather icon and description
  const weather = dayData.weather && dayData.weather[0];
  if (weather) {
    overlay.querySelector(".weather-forecast-day-icon").src = `https://openweathermap.org/img/wn/${weather.icon}@4x.png`;
    overlay.querySelector(".weather-forecast-day-description").textContent = weather.description || dayData.summary || "";
  }
  
  // Temperatures
  overlay.querySelector(".weather-forecast-day-high").textContent = `${dayData.temp_high ? dayData.temp_high.toFixed(0) : (dayData.temp && dayData.temp.max ? dayData.temp.max.toFixed(0) : "--")}°`;
  overlay.querySelector(".weather-forecast-day-low").textContent = `${dayData.temp_low ? dayData.temp_low.toFixed(0) : (dayData.temp && dayData.temp.min ? dayData.temp.min.toFixed(0) : "--")}°`;
  
  // Temperature breakdown
  const tempElements = overlay.querySelectorAll("[data-temp]");
  tempElements.forEach(el => {
    const tempType = el.getAttribute("data-temp");
    let temp = "--";
    
    if (dayData.temp && dayData.temp[tempType] != null) {
      temp = `${dayData.temp[tempType].toFixed(0)}°`;
    }
    
    el.textContent = temp;
  });
  
  // Helper function for moon phase icon
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
  
  // Details
  const details = [
    {
      icon: "🌅",
      label: "Sunrise",
      value: dayData.sunrise ? formatTime(dayData.sunrise) : "--",
    },
    {
      icon: "🌇",
      label: "Sunset",
      value: dayData.sunset ? formatTime(dayData.sunset) : "--",
    },
    {
      icon: "🌧️",
      label: "Precipitation",
      value: dayData.pop != null ? `${(dayData.pop * 100).toFixed(0)}%` : "--",
    },
    {
      icon: "☁️",
      label: "Clouds",
      value: dayData.clouds != null ? `${dayData.clouds}%` : "--",
    },
    {
      icon: "💨",
      label: "Wind",
      value: dayData.wind_speed != null ? `${dayData.wind_speed.toFixed(1)} mph ${windDir(dayData.wind_deg)}` : "--",
    },
    {
      icon: "💧",
      label: "Humidity",
      value: dayData.humidity != null ? `${dayData.humidity}%` : "--",
    },
    {
      icon: "🔆",
      label: "UV Index",
      value: dayData.uvi != null ? dayData.uvi.toString() : "--",
    },
    {
      icon: moonPhaseIcon(dayData.moon_phase),
      label: "Moon Phase",
      value: moonPhaseText(dayData.moon_phase),
    },
    {
      icon: "🎚️",
      label: "Pressure",
      value: dayData.pressure != null ? `${dayData.pressure} hPa` : "--",
    },
    {
      icon: "🌡️",
      label: "Dew Point",
      value: dayData.dew_point != null ? `${dayData.dew_point.toFixed(0)}°F` : "--",
    }
  ];
  
  // Apply CSS classes based on values
  details.forEach(d => {
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
    } else if (label === "Precipitation") {
      if (raw >= 70) cls = "high";
      else if (raw >= 30) cls = "moderate";
      else cls = "low";
    }
    
    d.cssClass = cls;
  });
  
  // Render details grid
  const detailsContainer = overlay.querySelector(".weather-forecast-day-details");
  detailsContainer.innerHTML = details.map(d => `
    <div class="weather-forecast-day-detail-item">
      <div class="weather-forecast-day-detail-icon">${d.icon}</div>
      <div class="weather-forecast-day-detail-label">${d.label}</div>
      <div class="weather-forecast-day-detail-value ${d.cssClass || ''}">${d.value}</div>
    </div>
  `).join("");
}

// Helper function for formatting time (if not already present)
function formatTime(timestamp) {
  if (!timestamp) return "--";
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
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