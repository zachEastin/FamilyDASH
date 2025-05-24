// Clock Modal functionality
const CLOCK_TYPES = [
  { id: 'analog', options: ['classic', 'modern'] },
  { id: 'digital', options: ['24h', '12h'] },
  { id: 'world',  options: ['timezone', 'map'] }
];
let clockTypeIndex = 0;
let clockOptionIndex = 0;

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
  if (document.getElementById('clock-modal-overlay')) return;
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
  el.addEventListener('wheel', e => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      cycleClockType(e.deltaY > 0 ? 1 : -1);
    } else {
      cycleClockOption(e.deltaX > 0 ? 1 : -1);
    }
  });
  let startX = 0, startY = 0;
  el.addEventListener('touchstart', e => {
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
  }, {passive:true});
  el.addEventListener('touchend', e => {
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 30) cycleClockOption(-1); else if (dx < -30) cycleClockOption(1);
    } else {
      if (dy > 30) cycleClockType(-1); else if (dy < -30) cycleClockType(1);
    }
  });
}

function renderClockModal() {
  const overlay = document.getElementById('clock-modal-overlay');
  const display = overlay.querySelector('.clock-modal-display');
  const type = CLOCK_TYPES[clockTypeIndex];
  const option = type.options[clockOptionIndex];
  display.innerHTML = `<div class="clock-placeholder">${type.id} - ${option}</div>`;
  saveClockPrefs();
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
