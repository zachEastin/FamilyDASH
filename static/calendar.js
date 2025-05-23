function setupCalendarTabs() {
  const weekTab = document.getElementById("week-tab");
  const monthTab = document.getElementById("month-tab");
  const eventsSubtab = document.getElementById("events-subtab");
  const mealsSubtab = document.getElementById("meals-subtab");
  const weekViewContainer = document.getElementById("week-view-container");
  const monthViewContainer = document.getElementById("month-view-container");
  const mealsViewContainer = document.getElementById("meals-view-container");
  const monthSubtabs = document.getElementById("month-subtabs");
  const shuffleMealsButton = document.getElementById("shuffle-meals-button");
  const shoppingListButton = document.getElementById("open-shopping-list-button");

  function updateButtonVisibility() {
    const isMonthView = monthTab.classList.contains("active");
    const isMealsSubtab = mealsSubtab.classList.contains("active");
    if (isMonthView && isMealsSubtab) {
      shuffleMealsButton.style.display = "block";
      shoppingListButton.style.display = "block";
    } else {
      shuffleMealsButton.style.display = "none";
      shoppingListButton.style.display = "none";
    }
  }

  function setActiveTab(tab) {
    [weekTab, monthTab].forEach((btn) => btn.classList.remove("active"));
    tab.classList.add("active");
    updateButtonVisibility();
  }
  function setActiveSubtab(subtab) {
    [eventsSubtab, mealsSubtab].forEach((btn) => btn.classList.remove("active"));
    subtab.classList.add("active");
    updateButtonVisibility();
  }
  function showMonthView() {
    weekViewContainer.classList.add("hidden");
    monthViewContainer.classList.remove("hidden");
    mealsViewContainer.classList.remove("hidden");
    const isMealsSubtab = mealsSubtab.classList.contains("active");
    if (!isMealsSubtab) {
      hideMealsPanelsWrapper();
    }
    if (eventsSubtab.classList.contains("active")) {
      monthViewContainer.style.display = "flex";
      mealsViewContainer.style.display = "none";
    } else {
      monthViewContainer.style.display = "none";
      mealsViewContainer.style.display = "flex";
      fetchAndRenderMealsMonthView();
    }
  }

  // Show/hide meals panels wrapper when switching tabs
  // Use variables from outer scope
  function showMealsPanelsWrapper() {
    const mealsPanelsWrapper = document.querySelector('.meals-panel-wrapper');
    const mealsViewContainer = document.getElementById('meals-view-container');
    if (mealsPanelsWrapper) {
      mealsPanelsWrapper.classList.add('active');
      mealsPanelsWrapper.style.display = 'flex';
      mealsViewContainer.classList.remove('hidden');
      // fetchFavorites(); // fetchFavorites is called by the patched renderMealsMonthView
      fetchAndRenderMealsMonthView(); // Ensures grid is rendered and slots are made droppable
    }
  }
  function hideMealsPanelsWrapper() {
    const mealsPanelsWrapper = document.querySelector('.meals-panel-wrapper');
    const mealsViewContainer = document.getElementById('meals-view-container');
    if (mealsPanelsWrapper) {
      mealsPanelsWrapper.classList.remove('active'); // Corrected typo: mealsPanelsWrapper -> mealsPanelWrapper
      mealsPanelsWrapper.style.display = 'none';
      mealsViewContainer.classList.add('hidden');
    }
  }
  if (mealsSubtab) {
    mealsSubtab.addEventListener('click', showMealsPanelsWrapper);
  }
  if (eventsSubtab) {
    eventsSubtab.addEventListener('click', hideMealsPanelsWrapper);
  }
  if (monthTab) {
    monthTab.addEventListener('click', function() {
      if (mealsSubtab.classList.contains('active')) showMealsPanelsWrapper();
      else hideMealsPanelsWrapper();
      updateButtonVisibility(); // Add this call
    });
  }

  weekTab.addEventListener("click", () => {
    setActiveTab(weekTab);
    weekViewContainer.classList.remove("hidden");
    monthViewContainer.classList.add("hidden");
    mealsViewContainer.classList.add("hidden");
    monthViewContainer.style.display = "none";
    hideMealsPanelsWrapper();
    if (monthSubtabs) monthSubtabs.style.display = "none";
    updateButtonVisibility();
  });
  monthTab.addEventListener("click", () => {
    setActiveTab(monthTab);
    if (monthSubtabs) monthSubtabs.style.display = "flex";
    setActiveSubtab(eventsSubtab); // Default to events subtab
    showMonthView();
    updateButtonVisibility();
  });
  eventsSubtab.addEventListener("click", () => {
    setActiveSubtab(eventsSubtab);
    showMonthView();
    updateButtonVisibility();
  });
  mealsSubtab.addEventListener("click", () => {
    setActiveSubtab(mealsSubtab);
    showMonthView();
    updateButtonVisibility();
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
    const otherMonth = cellDate.getMonth() !== currentMonth;
    if (
      cellDate.getFullYear() === currentYear &&
      cellDate.getMonth() === currentMonth &&
      cellDate.getDate() === todayDate
    ) {
      cellClasses += " today";
    }

    monthGridHtml += `<div class="${cellClasses}" data-date="${dayKey}">`;
    if (otherMonth) {
      monthGridHtml += `<div class="other-month">`;
    }
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
    if (otherMonth) {
      monthGridHtml += `</div>`;
    }
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