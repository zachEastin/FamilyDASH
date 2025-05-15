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

function updateIcloud(data) {
  if (!data || typeof data !== "object") {
    document.getElementById("calendar").innerHTML =
      "<em>iCloud data unavailable.</em>";
    return;
  }
  // DEV: If no events, use stub data for development
  if (!Array.isArray(data.events) || data.events.length === 0) {
    console.log("Generating stub events");
    data.events = generateStubWeekEvents();
  }
  const cal = document.getElementById("calendar");
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
            style="position:absolute; left:${leftPct}%; width:${widthPct}%; top:${topPct}%; height:${heightPct}%; background:${bgColor}; color:${textColor}; display:flex; align-items:center; justify-content:center;">
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
            style="position:absolute; left:${leftPct}%; width:${widthPct}%; top:${topPct}%; height:${heightPct}%; background:${bgColor}; color:${textColor}; display:flex; flex-direction:column; justify-content:space-between;">
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
  document.querySelectorAll(".event-block").forEach((block) => {
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

function addTouchHandlers() {
  console.log("Touch handlers stub");
}
