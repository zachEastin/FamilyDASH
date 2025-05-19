
// --- Favorite toggle logic in modal ---
let isFavorite = false;
const favoriteStar = document.getElementById("favorite-star");
if (favoriteStar) {
  favoriteStar.addEventListener("click", () => {
    isFavorite = !isFavorite;
    updateFavoriteStar();
  });
  favoriteStar.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      isFavorite = !isFavorite;
      updateFavoriteStar();
      e.preventDefault();
    }
  });
  // Show/hide favorite star based on modal context
  function showFavoriteStar(show) {
    favoriteStar.parentElement.style.display = show ? '' : 'none';
  }
  // Always show favorite toggle in modal
  showFavoriteStar(true);
}
// --- Fix: Define updateFavoriteStar globally for favorite star in main modal ---
function updateFavoriteStar() {
  if (!favoriteStar) return;
  if (isFavorite) {
    favoriteStar.classList.add("favorited", "fa-solid");
    favoriteStar.classList.remove("fa-regular");
  } else {
    favoriteStar.classList.remove("favorited", "fa-solid");
    favoriteStar.classList.add("fa-regular");
  }
}

// --- Spoonacular Recipe Search & Import ---
(function setupSpoonacularSearch() {
  const searchInput = document.getElementById("spoonacular-search-input");
  const searchBtn = document.getElementById("spoonacular-search-button");
  const resultsContainer = document.getElementById("spoonacular-results");
  if (!searchInput || !searchBtn || !resultsContainer) return;

  function renderResults(results) {
    resultsContainer.innerHTML = '';
    if (!results || !results.length) {
      resultsContainer.innerHTML = '<div style="color:#888;">No results found.</div>';
      return;
    }results.forEach(r => {
      const card = document.createElement('div');
      card.className = 'spoonacular-result-card';
      card.style = 'display:flex;align-items:center;gap:0.5em;padding:0.3em 0;border-bottom:1px solid #eee;';
      card.innerHTML = `
        <img src="${r.image || ''}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:4px;">
        <span style="flex:1;">${r.title}</span>
        <button type="button" class="spoonacular-import-btn" data-id="${r.id}">Import</button>
      `;
      resultsContainer.appendChild(card);
    });
  }

  searchBtn.addEventListener('click', function() {
    const q = searchInput.value.trim();
    if (!q) return;
    resultsContainer.innerHTML = '<div>Searching...</div>';
    fetch(`/api/meals/search?query=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(data => renderResults(data.results || []))
      .catch(() => { resultsContainer.innerHTML = '<div style="color:red;">Error searching recipes.</div>'; });
  });

  resultsContainer.addEventListener('click', function(e) {
    const btn = e.target.closest('.spoonacular-import-btn');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    if (!id) return;
    btn.disabled = true;
    btn.textContent = 'Importing...';
    fetch(`/api/meals/recipe?id=${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then(obj => {
        // Fill modal fields
        document.getElementById('recipe-title').value = obj.title || '';
        document.getElementById('recipe-ingredients').value = (obj.ingredients || []).join('\n');
        // Uncheck all tags first
        document.querySelectorAll('#recipe-form input[name="tags"]').forEach(cb => { cb.checked = false; });
        (obj.tags || []).forEach(tag => {
          const cb = document.querySelector(`#recipe-form input[name="tags"][value="${tag}"]`);
          if (cb) cb.checked = true;
        });
        // Optionally set a hidden field for source if needed
        // document.getElementById('recipe-source').value = obj.source || '';
        // Optionally update favorite star
        if (window.updateFavoriteStar) window.updateFavoriteStar(false);
        // Scroll to top of modal
        document.querySelector('#recipe-modal .modal-content').scrollTop = 0;
      })
      .finally(() => {
        btn.disabled = false;
        btn.textContent = 'Import';
      });
  });
})();

// --- Shuffle Meals Logic ---
function shuffleMealPlan() {
  // Fetch meal plan and favorites in parallel
  Promise.all([
    fetch('/api/meals/data').then(r => r.json()),
    fetch('/api/meals/favorites').then(r => r.json())
  ]).then(([mealsData, favorites]) => {
    if (!Array.isArray(favorites) || favorites.length === 0) return;
    // Build a map of week (Sun-Sat) to assigned titles
    const assignedTitlesByWeek = {};
    // Helper: get week key (YYYY-WW) for a date
    function getWeekKey(dateStr) {
      const d = new Date(dateStr);
      const year = d.getFullYear();
      // Week number (ISO, but Sun-Sat window)
      const jan1 = new Date(year, 0, 1);
      const days = Math.floor((d - jan1) / 86400000);
      const week = Math.floor((days + jan1.getDay()) / 7);
      return `${year}-W${week}`;
    }
    // Collect all slots to fill
    const slotsToFill = [];
    Object.keys(mealsData).forEach(month => {
      Object.keys(mealsData[month]).forEach(date => {
        ["breakfast", "lunch", "dinner"].forEach(mealType => {
          const meal = mealsData[month][date][mealType];
          const key = `${date}|${mealType}`;
          const locked = window.mealSlotLocks && window.mealSlotLocks[key];
          if (!locked && (!meal || !meal.title)) {
            slotsToFill.push({ month, date, mealType });
          } else if (meal && meal.title) {
            // Track assigned titles for week
            const weekKey = getWeekKey(date);
            if (!assignedTitlesByWeek[weekKey]) assignedTitlesByWeek[weekKey] = new Set();
            assignedTitlesByWeek[weekKey].add(meal.title);
          }
        });
      });
    });
    // Shuffle favorites
    const shuffled = favorites.slice().sort(() => Math.random() - 0.5);
    // Assign recipes to slots, avoiding repeats in week
    const updates = [];
    slotsToFill.forEach(slot => {
      const weekKey = getWeekKey(slot.date);
      if (!assignedTitlesByWeek[weekKey]) assignedTitlesByWeek[weekKey] = new Set();
      // Find a favorite not used in this week
      const pick = shuffled.find(fav => !assignedTitlesByWeek[weekKey].has(fav.title));
      if (pick) {
        assignedTitlesByWeek[weekKey].add(pick.title);
        updates.push({ ...slot, recipe: pick });
      }
    });
    // POST updates sequentially
    (async function postUpdates() {
      for (const upd of updates) {
        await fetch('/api/meals/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(upd)
        });
      }
      fetchAndRenderMealsMonthView();
    })();
  });
}

// --- Meals Side Panel Logic (Tabbed) ---
(function setupMealsSidePanel() {
  const mealsPanelWrapper = document.querySelector('.meals-panel-wrapper');
  const mealsViewContainer = document.getElementById('meals-view-container');
  const sidePanel = document.getElementById('meals-side-panel');
  const favoritesTab = document.getElementById('favorites-tab');
  const historyTab = document.getElementById('history-tab');
  const favoritesList = document.getElementById('favorites-list');
  const historyList = document.getElementById('history-list');
  const panelToggle = sidePanel.querySelector('.side-panel-toggle');

  // Show/hide wrapper when Meals tab is active
  function showMealsPanelWrapper() {
    if (mealsPanelWrapper) {
      mealsPanelWrapper.classList.add('active');
      mealsPanelWrapper.style.display = 'flex';
      mealsViewContainer.classList.remove('hidden');
      fetchFavorites();
    }
  }
  function hideMealsPanelWrapper() {
    if (mealsPanelWrapper) {
      mealsPanelWrapper.classList.remove('active');
      mealsPanelWrapper.style.display = 'none';
      mealsViewContainer.classList.add('hidden');
    }
  }
  // Patch calendar tab logic to show/hide panel
  const monthTab = document.getElementById('month-tab');
  const mealsSubtab = document.getElementById('meals-subtab');
  const eventsSubtab = document.getElementById('events-subtab');
  if (mealsSubtab) {
    mealsSubtab.addEventListener('click', showMealsPanelWrapper);
  }
  if (eventsSubtab) {
    eventsSubtab.addEventListener('click', hideMealsPanelWrapper);
  }
  if (monthTab) {
    monthTab.addEventListener('click', function() {
      if (mealsSubtab.classList.contains('active')) showMealsPanelWrapper();
      else hideMealsPanelWrapper();
    });
  }

  // Collapse/expand logic
  panelToggle.addEventListener('click', function(e) {
    e.stopPropagation();
    sidePanel.classList.toggle('collapsed');
  });
  sidePanel.querySelector('.side-panel-header').addEventListener('dblclick', function() {
    sidePanel.classList.toggle('collapsed');
  });

  // Tab switching logic
  favoritesTab.addEventListener('click', function() {
    favoritesTab.classList.add('active');
    historyTab.classList.remove('active');
    favoritesList.style.display = '';
    historyList.style.display = 'none';
  });
  historyTab.addEventListener('click', function() {
    historyTab.classList.add('active');
    favoritesTab.classList.remove('active');
    historyList.style.display = '';
    favoritesList.style.display = 'none';
    fetchHistory(); // Ensure history is refreshed when tab is activated
  });

  // --- Fetch and render Favorites ---
  function renderFavorites(favorites) {
    favoritesList.innerHTML = '';
    favorites.forEach(title => {
      const div = document.createElement('div');
      div.className = 'recipe-item';
      div.setAttribute('draggable', 'true');
      div.setAttribute('data-title', title);
      div.innerHTML = '<i class="fa fa-star"></i>' + title;
      favoritesList.appendChild(div);
    });
    makeRecipeItemsDraggable(); // Call here
  }
  function fetchFavorites() {
    fetch('/api/meals/favorites')
      .then(r => r.json())
      .then(renderFavorites);
  }

  // --- Fetch and render History ---
  let allMealsData = null;
  function renderHistory(historyRecipes) {
    historyList.innerHTML = '';
    historyRecipes.forEach(recipe => {
      const div = document.createElement('div');
      div.className = 'recipe-item';
      div.setAttribute('draggable', 'true');
      div.setAttribute('data-title', recipe.title);
      div.innerHTML = '<i class="fa fa-history"></i>' + recipe.title;
      div.dataset.recipe = JSON.stringify(recipe);
      historyList.appendChild(div);
    });
    makeRecipeItemsDraggable(); // Call here
  }
  function fetchHistory() {
    fetch('/api/meals/data')
      .then(r => r.json())
      .then(data => {
        allMealsData = data;
        const now = new Date();
        const todayStr = now.toISOString().slice(0,10);
        const recipesMap = new Map();
        // Iterate all months and all days
        Object.entries(data).forEach(([month, days]) => {
          Object.entries(days).forEach(([date, meals]) => {
            if (date > todayStr) return; // skip future days
            Object.values(meals).forEach(meal => {
              if (meal && meal.title && !recipesMap.has(meal.title)) {
                recipesMap.set(meal.title, meal);
              }
            });
          });
        });
        // Sort alphabetically by title
        const recipes = Array.from(recipesMap.values()).sort((a,b) => a.title.localeCompare(b.title));
        renderHistory(recipes);
      });
  }

  // --- Drag and Drop Logic ---
  function handleDragStart(e) {
    const title = this.getAttribute('data-title');
    const recipeData = this.dataset.recipe;

    if (title) {
      e.dataTransfer.setData('text/plain', title);
    }

    // Also store full recipe if available
    if (recipeData) {
      e.dataTransfer.setData('application/json', recipeData);
    }
    e.dataTransfer.effectAllowed = 'copy';
  }
  function makeRecipeItemsDraggable() {
    const items = document.querySelectorAll('.recipe-item');
    items.forEach(item => {
      item.removeEventListener('dragstart', handleDragStart); // Avoid duplicate listeners
      item.addEventListener('dragstart', handleDragStart);
    });
  }
  // --- Add drop target logic for meal slots ---
  function handleMealSlotDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
  function handleMealSlotDrop(e) {
    e.preventDefault();
    const date = this.dataset.date;
    const mealType = this.dataset.mealType;
    let recipe = null;
    // Try to get full recipe object from dataTransfer
    let recipeJson = e.dataTransfer.getData('application/json');
    if (recipeJson) {
      try { recipe = JSON.parse(recipeJson); } catch {}
    }
    if (!recipe) {
      // Fallback: look up by title in history or favorites
      const title = e.dataTransfer.getData('text/plain');
      // Search history first
      if (allMealsData && title) {
        let foundRecipe = null;
        // Iterate over all months in allMealsData
        for (const monthData of Object.values(allMealsData)) {
          // Iterate over all days in that month
          for (const dayMeals of Object.values(monthData)) {
            // Iterate over all meal types in that day
            for (const meal of Object.values(dayMeals)) {
              if (meal && meal.title === title) {
                foundRecipe = meal; // Found the recipe with full details
                break;
              }
            }
            if (foundRecipe) break;
          }
          if (foundRecipe) break;
        }
        if (foundRecipe) {
          recipe = foundRecipe; // Use the found recipe with full details
        }
      }
      // If not found after searching all history, fallback to minimal object
      if (!recipe && title) recipe = { title };
    }
    // POST to /api/meals/update
    fetch('/api/meals/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        month: date.slice(0,7),
        date,
        mealType,
        recipe
      })
    })
      .then(r => r.json())
      .then(() => {
        fetchAndRenderMealsMonthView();
        fetchHistory();
        fetchFavorites();
      });
  }
  function makeMealSlotsDroppable() {
    const grid = document.querySelector('.meals-grid');
    if (!grid) return;

    // Remove previous listeners if any
    grid.ondragover = null;
    grid.ondrop = null;

    grid.addEventListener('dragover', function(e) {
      const slot = e.target.closest('.meal-slot');
      if (slot) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        slot.classList.add('dragover-debug');
      }
    });

    grid.addEventListener('dragleave', function(e) {
      const slot = e.target.closest('.meal-slot');
      if (slot) {
        slot.classList.remove('dragover-debug');
      }
    });

    grid.addEventListener('drop', function(e) {
      const slot = e.target.closest('.meal-slot');
      if (!slot) {
        return;
      }
      e.preventDefault();
      slot.classList.remove('dragover-debug');
      handleMealSlotDrop.call(slot, e);
    });
  }
  // Add debug CSS for dragover
  if (!document.getElementById('dragover-debug-style')) {
    const style = document.createElement('style');
    style.id = 'dragover-debug-style';
    style.textContent = `.dragover-debug { outline: 2px dashed red !important; background: #ff000033 !important; }`;
    document.head.appendChild(style);
  }

  // --- Refresh logic after meals view render ---
  const actualRenderMealsMonthViewFunction = window.renderMealsMonthView; // Capture the global renderMealsMonthView

  window.renderMealsMonthView = function(data) { // Explicitly override the global function
    if (typeof actualRenderMealsMonthViewFunction === 'function') {
      actualRenderMealsMonthViewFunction(data); // Call the original global rendering logic
    } else {
      console.error("The main renderMealsMonthView function was not found by the IIFE patch during execution.");
      // This case should ideally not happen if the main function is defined globally.
    }

    // Enhancements from the IIFE:
    patchMealSlotClicksWithModal(data); // This is a global function
    makeMealSlotsDroppable();           // This function is defined within this IIFE
    fetchHistory();                     // This will eventually call renderHistory, which calls makeRecipeItemsDraggable
    fetchFavorites();                   // This will eventually call renderFavorites, which calls makeRecipeItemsDraggable
  };

  // Initial load if panel is visible
  if (mealsPanelWrapper && !mealsPanelWrapper.classList.contains('hidden')) {
    fetchFavorites(); // This will eventually call renderFavorites, which calls makeRecipeItemsDraggable
    fetchHistory();   // This will eventually call renderHistory, which calls makeRecipeItemsDraggable
  }
})();

// --- Recipe Modal Logic ---
(function setupRecipeModal() {
  const modal = document.getElementById("recipe-modal");
  const form = document.getElementById("recipe-form");
  const closeBtn = document.getElementById("recipe-modal-close");
  const saveBtn = document.getElementById("recipe-save");
  const cancelBtn = document.getElementById("recipe-cancel");
  const titleInput = document.getElementById("recipe-title");
  const ingredientsInput = document.getElementById("recipe-ingredients");
  const favoriteStar = document.getElementById("favorite-star");
  const tagInputs = form.querySelectorAll("input[name='tags']");
  let currentDate = null, currentMealType = null, currentMonth = null;
  let isFavorite = false;

  function showModal(recipe, date, mealType) {
    modal.style.display = "flex";
    setTimeout(() => { modal.classList.add("open"); }, 10);
    currentDate = date;
    currentMealType = mealType;
    currentMonth = date.slice(0, 7);
    titleInput.value = recipe && recipe.title ? recipe.title : "";
    ingredientsInput.value = recipe && recipe.ingredients ? (Array.isArray(recipe.ingredients) ? recipe.ingredients.join("\n") : recipe.ingredients) : "";
    isFavorite = recipe && recipe.isFavorite ? true : false;
    updateFavoriteStar();
    // Tags
    const tags = recipe && recipe.tags ? recipe.tags : [];
    tagInputs.forEach(input => {
      input.checked = tags.includes(input.value);
    });
  }
  function hideModal() {
    modal.classList.remove("open");
    setTimeout(() => { modal.style.display = "none"; }, 200);
    form.reset();
    isFavorite = false;
    updateFavoriteStar();
  }
  function updateFavoriteStar() {
    if (!favoriteStar) return;
    if (isFavorite) {
      favoriteStar.classList.add("favorited", "fa-solid");
      favoriteStar.classList.remove("fa-regular");
    } else {
      favoriteStar.classList.remove("favorited", "fa-solid");
      favoriteStar.classList.add("fa-regular");
    }
  }
  // --- Favorite toggle logic in modal ---
  favoriteStar.addEventListener("click", () => {
    isFavorite = !isFavorite;
    updateFavoriteStar();
  });
  favoriteStar.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      isFavorite = !isFavorite;
      updateFavoriteStar();
      e.preventDefault();
    }
  });
  // Show/hide favorite star based on modal context
  function showFavoriteStar(show) {
    favoriteStar.parentElement.style.display = show ? '' : 'none';
  }
  // Always show favorite toggle in modal
  showFavoriteStar(true);

  closeBtn.addEventListener("click", hideModal);
  cancelBtn.addEventListener("click", (e) => {
    e.preventDefault();
    hideModal();
  });
  form.addEventListener("submit", function(e) {
    e.preventDefault();
    const title = titleInput.value.trim();
    if (!title) return;
    let ingredients = ingredientsInput.value.split(/\n|,/).map(s => s.trim()).filter(Boolean);
    const tags = Array.from(tagInputs).filter(i => i.checked).map(i => i.value);
    const recipe = { title, ingredients, tags, isFavorite };
    // POST to /api/meals/update
    fetch("/api/meals/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({
        month: currentMonth,
        date: currentDate,
        mealType: currentMealType,
        recipe
      })
    })
      .then(r => r.json())
      .then(() => {
        hideModal();
        fetchAndRenderMealsMonthView();
      });
  });
  // Expose for use in meals view
  window.openRecipeModal = showModal;
})();

// Patch meal-slot click handler to open modal with data
function patchMealSlotClicksWithModal(mealsData) {
  document.querySelectorAll(".meal-slot").forEach(slot => {
    slot.addEventListener("click", function(e) {
      const date = slot.dataset.date;
      const mealType = slot.dataset.mealType;
      // Find recipe data if available
      let recipe = null;
      if (mealsData) {
        const month = date.slice(0, 7);
        if (mealsData[month] && mealsData[month][date] && mealsData[month][date][mealType]) {
          recipe = mealsData[month][date][mealType];
        }
      }
      window.openRecipeModal(recipe, date, mealType);
    });
  });

}

// --- Fix: Restore renderMealsMonthView to default if not already patched ---
if (!window._origRenderMealsMonthView) {
  window._origRenderMealsMonthView = renderMealsMonthView;
}
renderMealsMonthView = function(data) {
  window._origRenderMealsMonthView(data);
  if (data) patchMealSlotClicksWithModal(data);
}

// --- Ensure all helpers and functions are defined in global scope ---
function renderMealsMonthView(data) {
  const mealsViewContainer = document.getElementById("meals-view-container");
  if (!mealsViewContainer) return;
  // Use current month and year
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

  // Meals data is structured as { [month]: { [date]: { breakfast: {...}, lunch: {...}, dinner: {...} } } }
  // month = YYYY-MM, date = YYYY-MM-DD
  const mealsData = data || {};
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
    const dateStr = cellDate.toISOString().split("T")[0];
    const monthStr = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, "0")}`;
    const dayMeals = (mealsData[monthStr] && mealsData[monthStr][dateStr]) || {};
    mealsGridHtml += `<div class="${cellClasses}" data-date="${dateStr}">`;
    mealsGridHtml += `<div class="day-number">${cellDate.getDate()}</div>`;
    mealsGridHtml += `<div class="meals-zones">`;
    ["breakfast", "lunch", "dinner"].forEach((mealType, idx) => {
      const meal = dayMeals[mealType];
      const slotClass = ["top", "mid", "bottom"][idx];
      let slotContent = meal && meal.title ? meal.title : "+";
      // Add lock icon (FontAwesome), default unlocked
      const locked = meal && meal.locked ? true : false;
      const lockIcon = `<span class="meal-lock-icon fa ${locked ? 'fa-lock' : 'fa-unlock'}" data-locked="${locked}" title="${locked ? 'Unlock' : 'Lock'}"></span>`;
      mealsGridHtml += `<div class="meal-slot ${mealType} ${slotClass}" data-date="${dateStr}" data-meal-type="${mealType}" data-locked="${locked}">${lockIcon}<span class="meal-slot-title">${slotContent}</span></div>`;
    });
    mealsGridHtml += `</div></div>`;
  }
  mealsGridHtml += "</div>";
  mealsViewContainer.innerHTML = monthHeaderHtml + gridHeaderHtml + mealsGridHtml;

  // Add lock/unlock click handlers and manage lock state in memory
  const mealSlotLocks = {};
  document.querySelectorAll('.meal-slot').forEach(slot => {
    const date = slot.dataset.date;
    const mealType = slot.dataset.mealType;
    const lockIcon = slot.querySelector('.meal-lock-icon');
    // Initialize lock state from DOM or memory
    const key = `${date}|${mealType}`;
    let locked = slot.getAttribute('data-locked') === 'true';
    if (mealSlotLocks[key] !== undefined) locked = mealSlotLocks[key];
    slot.setAttribute('data-locked', locked);
    if (lockIcon) {
      lockIcon.classList.toggle('fa-lock', locked);
      lockIcon.classList.toggle('fa-unlock', !locked);
      lockIcon.setAttribute('data-locked', locked);
      lockIcon.title = locked ? 'Unlock' : 'Lock';
      lockIcon.onclick = (e) => {
        e.stopPropagation();
        locked = !locked;
        mealSlotLocks[key] = locked;
        slot.setAttribute('data-locked', locked);
        lockIcon.classList.toggle('fa-lock', locked);
        lockIcon.classList.toggle('fa-unlock', !locked);
        lockIcon.setAttribute('data-locked', locked);
        lockIcon.title = locked ? 'Unlock' : 'Lock';
      };
    }
  });
  window.mealSlotLocks = mealSlotLocks;
  // Ensure meal slots are always droppable after rendering
  if (typeof makeMealSlotsDroppable === 'function') {
    makeMealSlotsDroppable();
  }
}

// Helper for contrast color (used in updateIcloudMonthView)
function getContrastColor(hex) {
  if (!hex) return '#222';
  // Remove # if present
  hex = hex.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(x => x + x).join('');
  }
  const r = parseInt(hex.substr(0,2),16);
  const g = parseInt(hex.substr(2,2),16);
  const b = parseInt(hex.substr(4,2),16);
  // Perceived brightness
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? '#222' : '#fff';
}

// Dummy addTouchHandlers if not defined
if (typeof addTouchHandlers !== 'function') {
  function addTouchHandlers() {}
}

// --- Ensure fetchAndRenderMealsMonthView is defined globally ---
function fetchAndRenderMealsMonthView() {
  fetch("/api/meals/data")
    .then((r) => r.json())
    .then((data) => renderMealsMonthView(data));
}

// --- Shopping List Modal Logic ---
(function setupShoppingListModal() {
  const openBtn = document.getElementById("open-shopping-list-button");
  const modal = document.getElementById("shopping-list-modal");
  const closeBtn = document.getElementById("shopping-list-modal-close");
  const startDateInput = document.getElementById("shopping-start-date");
  const endDateInput = document.getElementById("shopping-end-date");
  const generateBtn = document.getElementById("generate-shopping-list");
  const listEl = document.getElementById("shopping-list-output");

  function openModal() {
    // Set default dates: this week
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const sowYYYY = startOfWeek.getFullYear();
    const sowMM = String(startOfWeek.getMonth() + 1).padStart(2, '0');
    const sowDD = String(startOfWeek.getDate()).padStart(2, '0');
    startDateInput.value = `${sowYYYY}-${sowMM}-${sowDD}`;
    endDateInput.value = `${yyyy}-${mm}-${dd}`;
    listEl.innerHTML = '';
    modal.style.display = "block";
  }
  function closeModal() {
    modal.style.display = "none";
  }
  if (openBtn) openBtn.addEventListener("click", openModal);
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  if (generateBtn) {
    generateBtn.addEventListener("click", () => {
      const start = startDateInput.value;
      const end = endDateInput.value;
      if (!start || !end) {
        listEl.innerHTML = '<li>Please select both start and end dates.</li>';
        return;
      }
      fetch(`/api/meals/shopping-list?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`)
        .then((r) => r.json())
        .then((ingredients) => {
          // De-dupe (case-insensitive), count, and sort
          const counts = {};
          ingredients.forEach((item) => {
            const key = item.trim().toLowerCase();
            if (!key) return;
            counts[key] = (counts[key] || 0) + 1;
          });
          const sorted = Object.keys(counts).sort((a, b) => a.localeCompare(b));
          listEl.innerHTML = sorted.length
            ? sorted
                .map((key) => {
                  const display = ingredients.find(
                    (i) => i.trim().toLowerCase() === key
                  ) || key;
                  const count = counts[key];
                  return `<li>${display}${count > 1 ? ` <span class=\"ingredient-count\">(x${count})</span>` : ""}</li>`;
                })
                .join("")
            : '<li>No ingredients found for this date range.</li>';
        });
    });
  }
})();

// --- Voice Assistant / External App Helper Functions ---

async function getMealPlanForToday() {
  try {
    const response = await fetch("/api/meals/today");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching today's meal plan:", error);
    return null; // Or throw error, or return a default structure
  }
}

async function getTodaysShoppingList() {
  try {
    const response = await fetch("/api/meals/shopping-list/today");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data; // Expected to be an array of ingredients
  } catch (error) {
    console.error("Error fetching today's shopping list:", error);
    return []; // Or throw error
  }
}

async function addRecipeToMeal({ date, mealType, recipe }) {
  try {
    const response = await fetch("/api/meals/add-recipe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ date, mealType, recipe }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error}`);
    }
    const data = await response.json();
    return data; // Should contain {status: "ok", ...}
  } catch (error) {
    console.error("Error adding recipe to meal:", error);
    return { status: "error", message: error.message };
  }
}

async function getFavoriteRecipes() {
  try {
    const response = await fetch("/api/meals/favorites/full");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data; // Expected to be a list of recipe objects
  } catch (error) {
    console.error("Error fetching favorite recipes:", error);
    return []; // Or throw error
  }
}

// Need to add a remove meal button
// Need to ensure the shopping list is visible when its needed to be
// Ensure the shuffle meals button works