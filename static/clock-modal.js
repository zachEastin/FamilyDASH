// Clock Modal functionality
const CLOCK_TYPES = [
  { id: 'analog', options: ['ticks', 'roman', 'arabic', 'schedule'] },
  { id: 'digital', options: ['24h', '12h'] },
  { id: 'world',  options: ['timezone', 'map'] }
];
let clockTypeIndex = 0;
let clockOptionIndex = 0;
let clockInterval = null;

function loadClockPrefs() {
  const t = parseInt(localStorage.getItem('clockTypeIndex')); 
  const o = parseInt(localStorage.getItem('clockOptionIndex')); 
  if (!isNaN(t)) clockTypeIndex = t % CLOCK_TYPES.length;
  if (!isNaN(o)) clockOptionIndex = o;
}

function saveClockPrefs() {
  localStorage.setItem('clockTypeIndex', clockTypeIndex);
  localStorage.setItem('clockOptionIndex', clockOptionIndex);
}

function createClockModal() {
  if (!document.getElementById('clock-modal-overlay')) return;
  const overlay = document.getElementById('clock-modal-overlay');
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeClockModal();
  });
  const content = overlay.querySelector('.clock-modal-content');
  trapFocus(content);
  setupInteractionHandlers(content);
}

function openClockModal() {
  loadClockPrefs();
  createClockModal();
  renderClockModal();
  const overlay = document.getElementById('clock-modal-overlay');
  overlay.classList.add('open');
  overlay.querySelector('.clock-modal-content').focus();
}

function closeClockModal() {
  const overlay = document.getElementById('clock-modal-overlay');
  overlay.classList.remove('open');
  stopAnalogClock();
  const editor = overlay.querySelector('.schedule-editor');
  if (editor) editor.remove();
}

function cycleClockType(dir) {
  clockTypeIndex = (clockTypeIndex + dir + CLOCK_TYPES.length) % CLOCK_TYPES.length;
  clockOptionIndex = 0;
  renderClockModal();
}

function cycleClockOption(dir) {
  const opts = CLOCK_TYPES[clockTypeIndex].options;
  clockOptionIndex = (clockOptionIndex + dir + opts.length) % opts.length;
  renderClockModal();
}

function setupInteractionHandlers(el) {
  el.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      cycleClockType(e.deltaY > 0 ? 1 : -1);
    } else {
      cycleClockOption(e.deltaX > 0 ? 1 : -1);
    }
  });

  // Add keyboard support for arrow keys
  el.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        cycleClockType(-1);
        break;
      case "ArrowDown":
        e.preventDefault();
        cycleClockType(1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        cycleClockOption(-1);
        break;
      case "ArrowRight":
        e.preventDefault();
        cycleClockOption(1);
        break;
      case "Escape":
        e.preventDefault();
        closeClockModal();
        break;
    }
  });

  let startX = 0,
    startY = 0;
  el.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
    },
    { passive: true }
  );
  el.addEventListener("touchend", (e) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 30) cycleClockOption(-1);
      else if (dx < -30) cycleClockOption(1);
    } else {
      if (dy > 30) cycleClockType(-1);
      else if (dy < -30) cycleClockType(1);
    }
  });
}

function renderClockModal() {
  const overlay = document.getElementById("clock-modal-overlay");
  const display = overlay.querySelector(".clock-modal-display");
  const type = CLOCK_TYPES[clockTypeIndex];
  const option = type.options[clockOptionIndex];
  stopAnalogClock();
  if (type.id === "analog") {
    display.innerHTML = getAnalogClockHtml(option);
    startAnalogClock();
    const editBtn = display.querySelector(".edit-schedule-btn");
    if (editBtn) editBtn.addEventListener("click", openScheduleEditor);
  } else {
    display.innerHTML = `<div class="clock-placeholder">${type.id} - ${option}</div>`;
  }
  saveClockPrefs();
}

function startAnalogClock() {
  updateAnalogTime();
  clockInterval = setInterval(updateAnalogTime, 1000);
}

function stopAnalogClock() {
  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
  }
}

function updateAnalogTime() {
  const overlay = document.getElementById("clock-modal-overlay");
  const hourHand = overlay.querySelector(".clock-hand.hour");
  if (!hourHand) return;
  const now = new Date();
  const sec = now.getSeconds();
  const min = now.getMinutes() + sec / 60;

  // Check if we're in schedule mode for 24-hour display
  const type = CLOCK_TYPES[clockTypeIndex];
  const option = type.options[clockOptionIndex];
  const is24Hour = type.id === "analog" && option === "schedule";

  const hr = is24Hour
    ? now.getHours() + min / 60
    : (now.getHours() % 12) + min / 60;

  const hourRotation = is24Hour ? hr * 15 : hr * 30; // 15 degrees per hour for 24h, 30 for 12h
  hourHand.setAttribute("transform", `rotate(${hourRotation} 100 100)`);

  const minHand = overlay.querySelector(".clock-hand.minute");
  const secHand = overlay.querySelector(".clock-hand.second");
  if (minHand) minHand.setAttribute("transform", `rotate(${min * 6} 100 100)`);
  if (secHand) secHand.setAttribute("transform", `rotate(${sec * 6} 100 100)`);
  const dateEl = overlay.querySelector(".clock-date");
  if (dateEl)
    dateEl.textContent = now.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
}

function romanNumeral(n) {
  const romans = [
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
  ];
  return romans[(n - 1) % 12];
}

function arcPath(start, end, radius, thickness, color) {
  // Draw an arc as a stroked path with rounded ends (pill-like)
  const r = radius;
  const sx = 100 + r * Math.sin(start);
  const sy = 100 - r * Math.cos(start);
  const ex = 100 + r * Math.sin(end);
  const ey = 100 - r * Math.cos(end);
  // SVG arc path for stroke
  return `<path d="M ${sx} ${sy} A ${r} ${r} 0 ${end - start > Math.PI ? 1 : 0} 1 ${ex} ${ey}" stroke="${color}" stroke-width="${thickness}" fill="none" stroke-linecap="round" />`;
}

function loadSchedule() {
  try {
    const s = JSON.parse(localStorage.getItem("clockSchedule"));
    if (Array.isArray(s)) return s;
  } catch (e) {}
  return [
    { time: "07:00", label: "Wake Up", color: "#3B82F6" },
    { time: "08:00", label: "Breakfast", color: "#FACC15" },
    { time: "12:00", label: "Lunch", color: "#10B981" },
    { time: "18:00", label: "Dinner", color: "#F97316" },
    { time: "22:00", label: "Bedtime", color: "#8B5CF6" },
  ];
}

function saveSchedule(s) {
  localStorage.setItem("clockSchedule", JSON.stringify(s));
}

function getAnalogClockHtml(style) {
  const dateStr = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const showNumbers =
    style === "roman" || style === "arabic" || style === "schedule";
  const is24Hour = style === "schedule";
  let nums = "";
  if (showNumbers) {
    const maxNum = is24Hour ? 24 : 12;
    const step = is24Hour ? 2 : 1; // Show every 2 hours for 24h mode to avoid clutter

    for (let i = step; i <= maxNum; i += step) {
      const displayHour = is24Hour ? i : i;
      const ang = is24Hour ? (i / 24) * Math.PI * 2 : (i / 12) * Math.PI * 2;
      const radius = is24Hour ? 85 : 80; // Slightly closer for 24h to fit more numbers
      const x = 100 + radius * Math.sin(ang);
      const y = 100 - radius * Math.cos(ang);

      let label;
      if (style === "roman" && !is24Hour) {
        label = romanNumeral(displayHour);
      } else {
        label = displayHour;
      }

      nums += `<text class="clock-num" x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle">${label}</text>`;
    }
  }
  let ticks = "";
  if (style !== "schedule") {
    for (let i = 0; i < 60; i++) {
      const ang = (i / 60) * Math.PI * 2;
      const inner = i % 5 === 0 ? 88 : 92;
      const outer = 96;
      const x1 = 100 + inner * Math.sin(ang);
      const y1 = 100 - inner * Math.cos(ang);
      const x2 = 100 + outer * Math.sin(ang);
      const y2 = 100 - outer * Math.cos(ang);
      ticks += `<line class="clock-tick${
        i % 5 === 0 ? " major" : ""
      }" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
    }
  }
  let arcs = "";
  let arcLabels = "";
  let arcPaths = "";
  if (style === "schedule") {
    const schedule = loadSchedule();
    // Use CSS variables for margin and thickness
    const arcMargin = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--clock-arc-margin')) || 8;
    const arcThickness = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--clock-arc-thickness')) || 14;
    const baseRadius = 98 + arcMargin + arcThickness / 2; // Place arc just outside clock face
    const seg = Math.PI / 12;
    schedule.forEach((item, index) => {
      const [h, m] = item.time.split(":").map(Number);
      const mins = h * 60 + m;
      const ang = (mins / 1440) * Math.PI * 2;
      arcs += arcPath(ang - seg / 2, ang + seg / 2, baseRadius, arcThickness, item.color);
      // Create a path for the text to follow along the arc
      const labelRadius = baseRadius; // Place label at arc center
      const pathId = `schedule-arc-path-${index}`;
      const startAng = ang - seg / 2;
      const endAng = ang + seg / 2;
      const startX = 100 + labelRadius * Math.sin(startAng);
      const startY = 100 - labelRadius * Math.cos(startAng);
      const endX = 100 + labelRadius * Math.sin(endAng);
      const endY = 100 - labelRadius * Math.cos(endAng);
      const large = endAng - startAng > Math.PI ? 1 : 0;
      arcPaths += `<path id="${pathId}" d="M ${startX} ${startY} A ${labelRadius} ${labelRadius} 0 ${large} 1 ${endX} ${endY}" fill="none" stroke="none" />`;
      arcLabels += `<text class="schedule-label"><textPath href="#${pathId}" startOffset="50%">${item.label}</textPath></text>`;
    });
  }
  return `
  <div class="analog-clock-wrapper">
    <svg class="analog-clock" viewBox="0 0 200 200">
      <defs>
        ${arcPaths}
      </defs>
      <g class="schedule-arcs">${arcs}</g>
      <circle class="clock-face" cx="100" cy="100" r="98" />
      <g class="clock-ticks">${ticks}</g>
      <g class="clock-numbers">${nums}</g>
      <g class="schedule-labels">${arcLabels}</g>
      <line class="clock-hand hour" x1="100" y1="100" x2="100" y2="60" />
      <line class="clock-hand minute" x1="100" y1="100" x2="100" y2="40" />
      <line class="clock-hand second" x1="100" y1="100" x2="100" y2="30" />
    </svg>
    <div class="clock-date">${dateStr}</div>
    ${
      style === "schedule"
        ? '<button class="edit-schedule-btn">Edit Schedule</button>'
        : ""
    }
  </div>`;
}

function openScheduleEditor() {
  const overlay = document.getElementById('clock-modal-overlay');
  if (overlay.querySelector('.schedule-editor')) return;
  const container = document.createElement('div');
  container.className = 'schedule-editor';
  const schedule = loadSchedule();
  container.innerHTML = `<div class="schedule-items"></div>
    <button type="button" class="add-item">Add</button>
    <div class="schedule-actions">
      <button type="button" class="save-schedule">Save</button>
      <button type="button" class="cancel-schedule">Cancel</button>
    </div>`;
  overlay.querySelector('.clock-modal-content').appendChild(container);
  const list = container.querySelector('.schedule-items');

  function renderItems() {
    list.innerHTML = '';
    schedule.forEach((it,idx)=>{
      const div=document.createElement('div');
      div.className='schedule-item';
      div.innerHTML=`<input type="time" value="${it.time}">
        <input type="text" value="${it.label}" placeholder="Label">
        <input type="color" value="${it.color}">
        <button type="button" class="remove-item" data-idx="${idx}">&times;</button>`;
      list.appendChild(div);
    });
  }

  renderItems();

  container.addEventListener('click',e=>{
    if(e.target.classList.contains('remove-item')){
      const i=parseInt(e.target.getAttribute('data-idx'));
      schedule.splice(i,1);
      renderItems();
    }
  });

  container.querySelector('.add-item').addEventListener('click',()=>{
    schedule.push({time:'12:00',label:'',color:'#3B82F6'});
    renderItems();
  });

  container.querySelector('.cancel-schedule').addEventListener('click',()=>{
    container.remove();
  });

  container.querySelector('.save-schedule').addEventListener('click',()=>{
    const items = Array.from(list.querySelectorAll('.schedule-item')).map(div=>{
      const inputs = div.querySelectorAll('input');
      return {time:inputs[0].value,label:inputs[1].value,color:inputs[2].value};
    });
    saveSchedule(items);
    container.remove();
    renderClockModal();
  });
}

function trapFocus(container) {
  const focusable = container.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  container.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  const clock = document.getElementById('clock');
  if (clock) {
    clock.style.cursor = 'pointer';
    clock.addEventListener('click', openClockModal);
  }
});
