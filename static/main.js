document.addEventListener("DOMContentLoaded", () => {
  const socket = io();

  socket.on("weather_update", (data) => updateWeather(data));
  socket.on("time_update", (data) => updateTime(data));
  socket.on("network_update", (data) => updateNetwork(data));
  socket.on("lighting_update", (data) => updateLighting(data));
  socket.on("sun_update", (data) => updateSunTheme(data));
  socket.on("icloud_update", (data) => updateIcloud(data));

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
    .then((r) => updateIcloud(r.data));

  addTouchHandlers();
});

function updateWeather(data) {
  const w = document.getElementById("weather");
  w.innerHTML = `
    <img src="https://openweathermap.org/img/wn/${
      data.icon
    }@2x.png" alt="Weather icon">
    <div class="description">${data.description}</div>
    <div>${data.temp.toFixed(1)}°F</div>
    <div>L:${data.low.toFixed(1)}° H:${data.high.toFixed(1)}°</div>
  `;
}

function updateTime(data) {
  const c = document.getElementById("clock");
  // c.innerHTML = `<div class="date">${data.date}</div><div class="time">${data.time}</div>`;
  c.innerHTML = `<div class="time">${data.time}</div>`;
}

function updateNetwork(data) {
  const n = document.getElementById("network-status");
  n.textContent = data.network;
  const offline = document.getElementById("offline-indicator");
  if (data.network === "offline") {
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

function updateIcloud(data) {
  if (!data || typeof data !== "object") {
    document.getElementById("calendar").innerHTML =
      "<em>iCloud data unavailable.</em>";
    return;
  }
  const cal = document.getElementById("calendar");
  const user = data.user || "<em>Unknown user</em>";
  const calendars =
    Array.isArray(data.calendars) && data.calendars.length > 0
      ? data.calendars.join(", ")
      : "<em>No calendars found</em>";
  cal.innerHTML =
    `<h4>Signed in as ${user}</h4>` +
    `<h5>Calendars: ${calendars}</h5>` +
    "<h3>Events</h3>" +
    "<ul>" +
    (Array.isArray(data.events)
      ? data.events
          .slice(0, 5)
          .map(
            (e) =>
              `\n      <li><strong>${new Date(e.start).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}</strong> ${e.title}</li>`
          )
          .join("")
      : "") +
    "</ul>";
  const rem = document.getElementById("reminders");
  rem.innerHTML =
    "<h3>Reminders</h3>" +
    "<ul>" +
    (Array.isArray(data.reminders)
      ? data.reminders
          .slice(0, 5)
          .map(
            (r) =>
              `\n      <li>${r.title}${
                r.due ? " (" + new Date(r.due).toLocaleDateString() + ")" : ""
              }</li>`
          )
          .join("")
      : "") +
    "</ul>";
  const img = document.getElementById("shared-photo");
  if (data.photo) img.src = data.photo;
}

function addTouchHandlers() {
  console.log("Touch handlers stub");
}
