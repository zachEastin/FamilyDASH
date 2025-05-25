const defaultPrefs = {
  theme: "auto",
  screensaver: "off",
  screensaverDelay: 10,
  startWeekOn: "sunday",
  showHolidays: false,
  palette: "Classic",
  calendarColors: {}
};

let prefs = loadPrefs();
let lastSunData = null;
let lastIcloudData = null;
const calendarsData = [
  { name: "Home" },
  { name: "Work" },
  { name: "School" },
  { name: "Family" },
  { name: "Events" },
  { name: "Birthdays" }
];
let calendars = calendarsData.map(c => {
  const color = prefs.calendarColors[c.name] || null;
  return { name: c.name, color, manual: !!prefs.calendarColors[c.name] };
});
window.calendars = calendars;
window.prefs = prefs;

const colorPalettes = {
  "Classic": ["#3B82F6", "#10B981", "#8B5CF6", "#F97316", "#EF4444", "#FACC15"],
  "Modern Pastels": ["#6EE7B7", "#C4B5FD", "#FDBA74", "#7DD3FC", "#FCA5A5", "#FDE68A"],
  "Muted Earth": ["#A3A380", "#D97B66", "#F2E2C6", "#64748B", "#7C3AED", "#D1D5DB"],
  "Serene Ocean": ["#1E6091", "#37A0A3", "#F08A5D", "#EAD2AC", "#907F9F", "#CCD6DD"],
  "Jewel Tones": ["#2D5D7B", "#3E8E7E", "#C44900", "#9D4EDD", "#FFB703", "#465362"],
  "Soft Neutrals": ["#8D99AE", "#A3B18A", "#D4A5A5", "#BFC0C0", "#C9ADA7", "#344A53"]
};

let checklistData = { today: [], tasks: [], shopping: [], chores: [] };

document.addEventListener("DOMContentLoaded", () => {
  const socket = io();

  // Initialize sidebar navigation
  initializeSidebarNavigation();

  // Wrap main content in a .main-content div for flex layout
  let mainContent = document.querySelector(".main-content");
  if (!mainContent) {
    mainContent = document.createElement("div");
    mainContent.className = "main-content";
    // Move grid and footer into .main-content
    const mainContainer = document.querySelector(".main-container");
    if (mainContainer) {
      const grid = document.querySelector("#dashboard");
      const footer = document.querySelector(".footer");
      if (grid) mainContent.appendChild(grid);
      if (footer) mainContent.appendChild(footer);
      mainContainer.appendChild(mainContent);
    }
  }

  socket.on("weather_update", (data) => updateWeather(data));
  socket.on("time_update", (data) => updateTime(data));
  socket.on("network_update", (data) => updateNetwork(data));
  socket.on("lighting_update", (data) => updateLighting(data));
  socket.on("sun_update", (data) => updateSunTheme(data));
  socket.on("icloud_update", (data) => {
    lastIcloudData = data;
    updateIcloudWeekView(data);
    updateIcloudMonthView(data);
    updateChecklists(data);
    // updateIcloudPhotos(data);
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
      lastIcloudData = r.data;
      updateIcloudWeekView(r.data);
      updateIcloudMonthView(r.data);
      updateChecklists(r.data);
      // updateIcloudPhotos(r.data);
    });
    fetchAndRenderMealsMonthView();

  addTouchHandlers();
  // setupCalendarTabs();
  createDayModal();
  setupSettingsModal();
  // renderMealsMonthView();

  // Move widgets to footer after DOM is loaded
  moveWidgetsToFooter();

});

// Helper: format unix timestamp to local time
function formatTime(ts) {
  if (!ts) return "--";
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}


function moveWidgetsToFooter() {
  let footer = document.querySelector(".footer");
  if (!footer) {
    footer = document.createElement("div");
    footer.className = "footer";
    // Insert footer into the main-content
    const mainContent = document.querySelector(".main-content");
    if (mainContent) {
      mainContent.appendChild(footer);
    } else {
      document.body.appendChild(footer);
    }
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
  lastSunData = data;
  const now = new Date();
  const sunrise = new Date(data.sunrise);
  const sunset = new Date(data.sunset);
  let theme = now >= sunrise && now < sunset ? "light" : "dark";
  if (prefs.theme !== "auto") theme = prefs.theme;
  document.body.classList.toggle("light-mode", theme === "light");
  document.body.classList.toggle("dark-mode", theme === "dark");
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

// Sidebar Navigation System
function initializeSidebarNavigation() {
  const navButtons = document.querySelectorAll('.nav-button');
  const sectionContents = document.querySelectorAll('.section-content');
  
  navButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetSection = button.dataset.section;
      
      // Remove active class from all buttons
      navButtons.forEach(btn => btn.classList.remove('active'));
      
      // Add active class to clicked button
      button.classList.add('active');
      
      // Hide all section contents
      sectionContents.forEach(section => {
        section.classList.remove('active');
      });
      
      // Show target section content
      const targetElement = document.querySelector(`[data-section="${targetSection}"]`);
      if (targetElement) {
        targetElement.classList.add('active');
      }
      
      // Handle specific section logic
      handleSectionChange(targetSection);
    });
  });
}

function handleSectionChange(section) {
  // Hide all calendar-related containers first
  const weekContainer = document.getElementById('week-view-container');
  const monthContainer = document.getElementById('month-view-container');
  const mealsWrapper = document.getElementById('meals-panel-wrapper');
  const remindersWrapper = document.getElementById('reminders');
  const photoWrapper = document.getElementById('photo');
  const calendarWrapper = document.getElementById('calendar');
  
  if (weekContainer) weekContainer.parentElement.style.display = 'none';
  if (monthContainer) monthContainer.parentElement.style.display = 'none';
  if (mealsWrapper) mealsWrapper.parentElement.style.display = 'none';

  if (calendarWrapper) calendarWrapper.style.display = 'none';
  if (weekContainer) weekContainer.style.display = 'none';
  if (monthContainer) monthContainer.style.display = 'none';
  if (mealsWrapper) mealsWrapper.style.display = 'none';
  if (remindersWrapper) remindersWrapper.style.display = 'none';
  if (photoWrapper) photoWrapper.style.display = 'none';

  switch(section) {
    case 'week-calendar':
      showWeekView();
      weekContainer.parentElement.style.display = 'flex';
      calendarWrapper.style.display = 'inherit';
      break;
    case 'month-calendar':
      showMonthView();
      monthContainer.parentElement.style.display = 'flex';
      calendarWrapper.style.display = 'inherit';
      break;
      case 'meal-planning':
        showMealPlanning();
        mealsWrapper.parentElement.style.display = 'flex';
        calendarWrapper.style.display = 'inherit';
      break;
    case 'reminders':
      remindersWrapper.style.display = 'flex';
      break;
    case 'photos':
      photoWrapper.style.display = 'flex';
      break;
  }
}

function showWeekView() {
  const weekContainer = document.getElementById('week-view-container');
  if (weekContainer) {
    weekContainer.style.display = 'flex';
  }
}

function showMonthView() {
  const monthContainer = document.getElementById('month-view-container');
  if (monthContainer) {
    monthContainer.style.display = 'flex';
  }
}

function showMealPlanning() {
  const mealsWrapper = document.getElementById('meals-panel-wrapper');
  if (mealsWrapper) {
    mealsWrapper.style.display = 'flex';
  }

  // Also trigger the existing meal planning setup if it exists
  if (typeof setupMealPlanning === 'function') {
    setupMealPlanning();
  }
}

function updateChecklists(data) {
  if (!data) return;
  checklistData.today = data.today || [];
  checklistData.tasks = data.tasks || [];
  checklistData.shopping = data.shopping || [];
  checklistData.chores = data.chores || [];

  renderChecklist('today');
  renderChecklist('tasks');
  renderChecklist('shopping');
  renderChores('chores');
}

function renderChecklist(id) {
  const card = document.getElementById(`checklist-${id}`);
  if (!card) return;
  const pending = card.querySelector('.pending-list');
  const done = card.querySelector('.done-list');
  if (pending) pending.innerHTML = '';
  if (done) {
    done.innerHTML = '<h4>Completed</h4>';
  }
  const items = checklistData[id] || [];
  items.forEach((item) => {
    const el = document.createElement('div');
    el.className = 'reminder-item';
    if (item.priority) el.classList.add(`priority-${item.priority}`);
    if (item.done) el.classList.add('done');
    el.tabIndex = 0;
    el.setAttribute('role', 'checkbox');
    el.setAttribute('aria-checked', item.done);

    const check = document.createElement('span');
    check.className = 'checkmark material-symbols-outlined';
    check.textContent = 'check_circle';
    el.appendChild(check);

    const titleSpan = document.createElement('span');
    titleSpan.className = 'reminder-title';
    if (id === 'shopping') {
      titleSpan.textContent = item.item + (item.quantity ? ` - ${item.quantity}` : '');
    } else {
      titleSpan.textContent = item.title;
    }

    el.appendChild(titleSpan);

    if (id === 'today' && item.dueDate) {
      const dueSpan = document.createElement('span');
      dueSpan.className = 'reminder-due-date';
      dueSpan.textContent = ` (Due: ${new Date(item.dueDate).toLocaleDateString()})`;
      el.appendChild(dueSpan);
    }
    if (id === 'tasks' && item.note) {
      const noteSpan = document.createElement('span');
      noteSpan.className = 'reminder-due-date';
      noteSpan.textContent = ` - ${item.note}`;
      el.appendChild(noteSpan);
    }

    const toggle = () => {
      item.done = !item.done;
      renderChecklist(id);
    };
    el.addEventListener('click', toggle);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });

    const container = item.done ? done : pending;
    if (container) container.appendChild(el);
  });

  if (done) {
    done.style.display = done.children.length > 1 ? 'flex' : 'none';
  }
}

function renderChores(id) {
  const card = document.getElementById(`checklist-${id}`);
  if (!card) return;
  const list = card.querySelector('.chores-list');
  if (!list) return;
  list.innerHTML = '';
  checklistData[id].forEach((item) => {
    const el = document.createElement('div');
    el.className = 'reminder-item chore-item';
    if (item.done) el.classList.add('done');
    el.tabIndex = 0;
    el.setAttribute('role', 'checkbox');
    el.setAttribute('aria-checked', item.done);

    const check = document.createElement('span');
    check.className = 'checkmark material-symbols-outlined';
    check.textContent = 'check_circle';
    el.appendChild(check);

    const span = document.createElement('span');
    span.className = 'reminder-title';
    span.textContent = item.title;

    el.appendChild(span);

    const toggle = () => {
      item.done = !item.done;
      renderChores(id);
    };
    el.addEventListener('click', toggle);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });

  list.appendChild(el);
  });
}

// --- Preferences Logic ---
function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem("dashboardPrefs")) || { ...defaultPrefs };
  } catch (e) {
    return { ...defaultPrefs };
  }
}

function savePrefs() {
  localStorage.setItem("dashboardPrefs", JSON.stringify(prefs));
}

function assignAutoColors() {
  const palette = colorPalettes[prefs.palette] || [];
  const used = new Set(calendars.filter(c => c.manual).map(c => c.color));
  let idx = 0;
  calendars.forEach(c => {
    if (!c.manual) {
      while (idx < palette.length && used.has(palette[idx])) idx++;
      c.color = palette[idx % palette.length];
      used.add(c.color);
      idx++;
    }
  });
  prefs.calendarColors = {};
  calendars.forEach(c => { if (c.manual) prefs.calendarColors[c.name] = c.color; });
  savePrefs();
  window.calendars = calendars;
}

function renderPaletteOptions() {
  const container = document.getElementById("palette-container");
  if (!container) return;
  container.innerHTML = "";
  Object.entries(colorPalettes).forEach(([name, colors]) => {
    const opt = document.createElement("div");
    opt.className = "palette-option" + (prefs.palette === name ? " selected" : "");
    opt.tabIndex = 0;
    opt.dataset.name = name;
    opt.innerHTML = `<div class="palette-title">${name}</div><div class="palette-swatches">${colors.map(c => `<span class="color-swatch" style="background:${c}"></span>`).join("")}</div>`;
    const select = () => {
      prefs.palette = name;
      calendars.forEach(c => { if (!c.manual) c.color = null; });
      assignAutoColors();
      renderPaletteOptions();
      renderCalendarColorControls();
    };
    opt.addEventListener("click", select);
    opt.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(); }});
    container.appendChild(opt);
  });
}

function renderCalendarColorControls() {
  const list = document.getElementById("calendar-color-list");
  if (!list) return;
  const palette = colorPalettes[prefs.palette] || [];
  list.innerHTML = "";
  const used = new Set(calendars.map(c => c.color));
  calendars.forEach(cal => {
    if (!cal.color) cal.color = palette[0];
    const row = document.createElement("div");
    row.className = "calendar-color-row";
    const label = document.createElement("div");
    label.textContent = cal.name;
    row.appendChild(label);
    const swatchRow = document.createElement("div");
    swatchRow.className = "calendar-color-swatches";
    palette.forEach(color => {
      const sw = document.createElement("div");
      sw.className = "color-swatch" + (cal.color === color ? " selected" : "");
      if (used.has(color) && cal.color !== color) sw.classList.add("used");
      sw.style.background = color;
      sw.tabIndex = 0;
      sw.setAttribute("role", "button");
      sw.setAttribute("aria-label", `${color} for ${cal.name}`);
      const select = () => {
        used.delete(cal.color);
        cal.color = color;
        cal.manual = true;
        used.add(color);
        prefs.calendarColors[cal.name] = color;
        savePrefs();
        renderCalendarColorControls();
      };
      sw.addEventListener("click", select);
      sw.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(); }});
      swatchRow.appendChild(sw);
    });
    row.appendChild(swatchRow);
    if (!cal.manual) {
      const badge = document.createElement("span");
      badge.className = "auto-badge";
      badge.textContent = "auto";
      row.appendChild(badge);
    }
    list.appendChild(row);
  });
}

function setupSettingsModal() {
  const modal = document.getElementById("settings-modal");
  const openBtn = document.getElementById("open-settings-button");
  const closeBtn = document.getElementById("settings-close");
  if (!modal || !openBtn) return;

  const themeSelect = modal.querySelector("#pref-theme");
  const screenSelect = modal.querySelector("#pref-screensaver");
  const delayInput = modal.querySelector("#pref-screensaver-delay");
  const delayLabel = modal.querySelector("#delay-label");
  const startWeek = modal.querySelector("#pref-start-week");
  const showHolidays = modal.querySelector("#pref-show-holidays");
  const reassign = modal.querySelector("#reassign-colors");

  const applyValues = () => {
    themeSelect.value = prefs.theme;
    screenSelect.value = prefs.screensaver;
    delayInput.value = prefs.screensaverDelay;
    delayLabel.textContent = prefs.screensaverDelay;
    startWeek.value = prefs.startWeekOn;
    showHolidays.checked = prefs.showHolidays;
  };

  applyValues();

  const show = () => {
    applyValues();
    renderPaletteOptions();
    renderCalendarColorControls();
    modal.style.display = "flex";
    requestAnimationFrame(() => modal.classList.add("open"));
  };
  const hide = () => {
    modal.classList.remove("open");
    setTimeout(() => { modal.style.display = "none"; }, 200);
  };

  openBtn.addEventListener("click", show);
  closeBtn.addEventListener("click", hide);
  modal.addEventListener("click", e => { if (e.target === modal) hide(); });

  const tabs = modal.querySelectorAll(".settings-tab");
  const sections = modal.querySelectorAll(".settings-section");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      sections.forEach(s => s.classList.remove("active"));
      tab.classList.add("active");
      modal.querySelector(`.settings-section[data-section="${tab.dataset.section}"]`).classList.add("active");
    });
  });

  themeSelect.addEventListener("change", e => { prefs.theme = e.target.value; savePrefs(); applyTheme(); });
  screenSelect.addEventListener("change", e => { prefs.screensaver = e.target.value; savePrefs(); });
  delayInput.addEventListener("input", e => { delayLabel.textContent = e.target.value; });
  delayInput.addEventListener("change", e => { prefs.screensaverDelay = parseInt(e.target.value,10); savePrefs(); });
  startWeek.addEventListener("change", e => { prefs.startWeekOn = e.target.value; savePrefs(); });
  showHolidays.addEventListener("change", e => { prefs.showHolidays = e.target.checked; savePrefs(); updateIcloudMonthView(lastIcloudData || {}); });
  if (reassign) {
    reassign.addEventListener("click", () => {
      calendars.forEach(c => { if (!c.manual) c.color = null; });
      assignAutoColors();
      renderCalendarColorControls();
    });
  }
}

function applyTheme() {
  if (!lastSunData) return;
  updateSunTheme(lastSunData);
}

assignAutoColors();


