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
  favoriteStar.textContent = isFavorite ? "star" : "star_outline";
  favoriteStar.classList.toggle("favorited", isFavorite);
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
      resultsContainer.innerHTML = '<div class="no-results">No results found.</div>';
      return;
    }
    results.forEach(r => {
      const card = document.createElement('div');
      card.className = 'spoonacular-result-card';
      card.innerHTML = `
        <img src="${r.image || ''}" alt="" class="result-thumb">
        <span class="result-title">${r.title}</span>
        <button type="button" class="spoonacular-import-btn" data-id="${r.id}">
          <span class="material-symbols-outlined">file_download</span>
          <span>Import</span>
        </button>
      `;
      resultsContainer.appendChild(card);
    });
  }

  function doSpoonacularSearch() {
    const q = searchInput.value.trim();
    if (!q) return;
    resultsContainer.innerHTML = '<div>Searching...</div>';
    fetch(`/api/meals/search?query=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(data => renderResults(data.results || []))
      .catch(() => { resultsContainer.innerHTML = '<div style="color:red;">Error searching recipes.</div>'; });
  }

  searchBtn.addEventListener('click', doSpoonacularSearch);

  // Add Enter key handler to input
  searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      doSpoonacularSearch();
    }
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
  const mealsPanelWrapper = document.querySelector(".meals-panel-wrapper");
  window.draggingRecipe = false;
  // const mealsViewContainer = document.getElementById('meals-view-container');
  const sidePanel = document.getElementById("meals-side-panel");
  const favoritesTab = document.getElementById("favorites-tab");
  const historyTab = document.getElementById("history-tab");
  const favoritesList = document.getElementById("favorites-list");
  const historyList = document.getElementById("history-list");
  const panelToggle = sidePanel.querySelector(".side-panel-toggle");

  // Show/hide wrapper when Meals tab is active
  // function showMealsPanelWrapper() {
  //   if (mealsPanelWrapper) {
  //     mealsPanelWrapper.classList.add('active');
  //     mealsPanelWrapper.style.display = 'flex';
  //     mealsViewContainer.classList.remove('hidden');
  //     fetchFavorites();
  //   }
  // }
  // function hideMealsPanelWrapper() {
  //   if (mealsPanelWrapper) {
  //     mealsPanelWrapper.classList.remove('active');
  //     mealsPanelWrapper.style.display = 'none';
  //     mealsViewContainer.classList.add('hidden');
  //   }
  // }
  // Patch calendar tab logic to show/hide panel
  // const monthTab = document.getElementById('month-tab');
  // const mealsSubtab = document.getElementById('meals-subtab');
  // const eventsSubtab = document.getElementById('events-subtab');
  // if (mealsSubtab) {
  //   mealsSubtab.addEventListener('click', showMealsPanelWrapper);
  // }
  // if (eventsSubtab) {
  //   eventsSubtab.addEventListener('click', hideMealsPanelWrapper);
  // }
  // if (monthTab) {
  //   monthTab.addEventListener('click', function() {
  //     if (mealsSubtab.classList.contains('active')) showMealsPanelWrapper();
  //     else hideMealsPanelWrapper();
  //   });
  // }

  // Collapse/expand logic
  panelToggle.addEventListener("click", function (e) {
    e.stopPropagation();
    sidePanel.classList.toggle("collapsed");
  });
  sidePanel
    .querySelector(".side-panel-header")
    .addEventListener("dblclick", function () {
      sidePanel.classList.toggle("collapsed");
    });

  // Tab switching logic
  favoritesTab.addEventListener("click", function () {
    favoritesTab.classList.add("active");
    historyTab.classList.remove("active");
    favoritesList.style.display = "";
    historyList.style.display = "none";
  });
  historyTab.addEventListener("click", function () {
    historyTab.classList.add("active");
    favoritesTab.classList.remove("active");
    historyList.style.display = "";
    favoritesList.style.display = "none";
    fetchHistory(); // Ensure history is refreshed when tab is activated
  });

  // --- Fetch and render Favorites ---
  function renderFavorites(favorites) {
    favoritesList.innerHTML = "";
    favorites.forEach(([uuid, title]) => {
      const div = document.createElement("div");
      div.className = "recipe-item";
      div.setAttribute("draggable", "true");
      div.setAttribute("data-title", title);
      div.setAttribute("data-uuid", uuid);
      div.innerHTML =
        '<span class="material-symbols-outlined star-icon">star</span>' + title;
      favoritesList.appendChild(div);
    });
    makeRecipeItemsDraggable(); // Call here
  }
  function fetchFavorites() {
    fetch("/api/meals/favorites")
      .then((r) => r.json())
      .then(renderFavorites);
  }

  // --- Fetch and render History ---
  function renderHistory(historyRecipes) {
    historyList.innerHTML = "";
    historyRecipes.forEach((recipe) => {
      const div = document.createElement("div");
      div.className = "recipe-item";
      div.setAttribute("draggable", "true");
      div.setAttribute("data-title", recipe.title);
      div.setAttribute("data-uuid", recipe.uuid);
      div.innerHTML =
        '<span class="material-symbols-outlined history-icon">history</span>' +
        recipe.title;
      div.dataset.recipe = JSON.stringify(recipe);
      historyList.appendChild(div);
    });
    makeRecipeItemsDraggable(); // Call here
  }
  function fetchHistory() {
    fetch("/api/recipes")
      .then((r) => r.json())
      .then(renderHistory);
  }

  // --- Drag and Drop Logic ---
  function handleDragStart(e) {
    const title = this.getAttribute("data-title");
    const uuid = this.getAttribute("data-uuid");

    if (title) {
      e.dataTransfer.setData("text/plain", title); // For compatibility
      e.dataTransfer.setData("application/x-recipe-title", title);
    }
    if (uuid) {
      e.dataTransfer.setData("application/x-recipe-uuid", uuid);
    }
    // If the full recipe object is available (for history items), include it as JSON
    if (this.dataset.recipe) {
      e.dataTransfer.setData("application/json", this.dataset.recipe);
    }

    e.dataTransfer.effectAllowed = "copy";
    window.draggingRecipe = true;
  }
  function handleDragEnd() {
    window.draggingRecipe = false;
    document.querySelectorAll('.meals-day-cell.show-slots').forEach(c => c.classList.remove('show-slots'));
  }
  function makeRecipeItemsDraggable() {
    const items = document.querySelectorAll(".recipe-item");
    items.forEach((item) => {
      item.removeEventListener("dragstart", handleDragStart); // Avoid duplicate listeners
      item.addEventListener("dragstart", handleDragStart);
      item.removeEventListener("dragend", handleDragEnd);
      item.addEventListener("dragend", handleDragEnd);
    });
  }
  function handleMealSlotDrop(e) {
    e.preventDefault();
    const date = this.dataset.date;
    const mealType = this.dataset.mealType;
    let recipe = null;
    const recipe_uuid = e.dataTransfer.getData("application/x-recipe-uuid");
    // Try to get full recipe object from dataTransfer
    let recipeJson = e.dataTransfer.getData("application/json");
    if (recipeJson) {
      try {
        recipe = JSON.parse(recipeJson);
      } catch {}
    }
    if (!recipe) {
      // Fallback: look up by title in history or favorites
      const title = e.dataTransfer.getData("application/x-recipe-title");
      // Search history first
      // if (allMealsData && title) {
      //   let foundRecipe = null;
      //   // Iterate over all months in allMealsData
      //   for (const monthData of Object.values(allMealsData)) {
      //     // Iterate over all days in that month
      //     for (const dayMeals of Object.values(monthData)) {
      //       // Iterate over all meal types in that day
      //       for (const meal of Object.values(dayMeals)) {
      //         if (meal && meal.title === title) {
      //           foundRecipe = meal; // Found the recipe with full details
      //           break;
      //         }
      //       }
      //       if (foundRecipe) break;
      //     }
      //     if (foundRecipe) break;
      //   }
      //   if (foundRecipe) {
      //     recipe = foundRecipe; // Use the found recipe with full details
      //   }
      // }
      // If not found after searching all history, fallback to minimal object
      if (!recipe && title) recipe = { title };
    }
    // POST to /api/meals/update
    fetch("/api/meals/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month: date.slice(0, 7),
        date,
        mealType,
        recipe_uuid,
      }),
    })
      .then((r) => r.json())
      .then(() => {
        fetchAndRenderMealsMonthView();
        fetchHistory();
        fetchFavorites();
      });
  }
  function makeMealSlotsDroppable() {
    const grid = document.querySelector(".meals-grid");
    if (!grid) return;

    // Remove previous listeners if any
    grid.ondragover = null;
    grid.ondrop = null;

    grid.addEventListener("dragover", function (e) {
      const slot = e.target.closest(".meal-slot");
      const cell = e.target.closest(".meals-day-cell");
      if (cell && window.draggingRecipe) {
        cell.classList.add("show-slots");
      }
      if (slot) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        slot.classList.add("slot-hover");
      }
    });

    grid.addEventListener("dragleave", function (e) {
      const slot = e.target.closest(".meal-slot");
      const cell = e.target.closest(".meals-day-cell");
      if (slot) {
        slot.classList.remove("slot-hover");
      }
      if (cell && !cell.contains(e.relatedTarget)) {
        cell.classList.remove("show-slots");
      }
    });

    grid.addEventListener("drop", function (e) {
      const slot = e.target.closest(".meal-slot");
      if (!slot) {
        return;
      }
      e.preventDefault();
      slot.classList.remove("slot-hover");
      const cell = slot.closest(".meals-day-cell");
      if (cell) cell.classList.remove("show-slots");
      handleMealSlotDrop.call(slot, e);
    });
  }
  function makeMealSlotsSwipeable() {
    document.querySelectorAll(".meal-slot").forEach((slot) => {
      const inner = slot.querySelector(".meal-slot-inner");
      if (!inner) return;
      let startX = 0;
      let currentX = 0;
      let dragging = false;      const endDrag = () => {
        if (!dragging) return;

        inner.style.transition = "transform 0.2s ease";
        const threshold = slot.offsetWidth * 0.4;
        const significantDrag = currentX > 10; // Track if there was significant movement

        if (currentX > threshold) {
          const recipeUuid = slot.dataset.recipeUuid;
          // If there's a recipe to remove, slide out and remove it
          if (recipeUuid) {
            inner.style.transform = `translateX(${slot.offsetWidth}px)`;
            setTimeout(() => removeMealSlot(slot), 150);
          } else {
            // If it's an empty slot, just slide back to normal position
            inner.style.transform = "";
          }
        } else {
          inner.style.transform = "";
        }

        // Set a flag to prevent click events if there was significant dragging
        if (significantDrag) {
          slot.dataset.justDragged = "true";
          setTimeout(() => {
            delete slot.dataset.justDragged;
          }, 100);
        }

        dragging = false;
      };

      slot.addEventListener("pointerdown", (e) => {
        startX = e.clientX;
        currentX = 0;
        dragging = true;
        inner.style.transition = "none";
        slot.setPointerCapture(e.pointerId);
      });
      slot.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        currentX = Math.max(0, e.clientX - startX);
        inner.style.transform = `translateX(${currentX}px)`;
      });
      slot.addEventListener("pointerup", endDrag);
      slot.addEventListener("pointercancel", endDrag);
      slot.addEventListener("pointerleave", endDrag);
    });
  }

  let lastRemoved = null;  function removeMealSlot(slot) {
    const slotId = `${slot.dataset.date}|${slot.dataset.mealType}`;
    const recipeUuid = slot.dataset.recipeUuid;
    if (!recipeUuid) return;
    const titleEl = slot.querySelector(".meal-slot-title");
    lastRemoved = {
      slot,
      slotId,
      recipe: { recipe_uuid: recipeUuid },
      title: titleEl ? titleEl.textContent : "",
    };
    slot.dataset.recipeUuid = "";
    slot.classList.add("empty-meal-slot");
    if (titleEl) titleEl.textContent = "+";
    
    // Reset the visual state after removal
    const inner = slot.querySelector(".meal-slot-inner");
    if (inner) {
      inner.style.transition = "transform 0.2s ease";
      inner.style.transform = "";
    }
    
    fetch(`/api/mealslot/${encodeURIComponent(slotId)}`, { method: "DELETE" });
    showSnackbar("Recipe removed", undoLastRemoval);
  }

  function undoLastRemoval() {
    if (!lastRemoved) return;
    const { slot, slotId, recipe, title } = lastRemoved;
    const titleEl = slot.querySelector(".meal-slot-title");
    slot.dataset.recipeUuid = recipe.recipe_uuid;
    slot.classList.remove("empty-meal-slot");
    if (titleEl) titleEl.textContent = title;
    fetch("/api/mealslot/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot_id: slotId, recipe }),
    });
    lastRemoved = null;
  }
  window.removeMealSlot = removeMealSlot;
  window.undoLastRemoval = undoLastRemoval;

  // --- Logic to run after meals view is rendered ---
  window.onMealsGridRendered = function (data, recipeMap) {
    patchMealSlotClicksWithModal(data, recipeMap); // This is a global function
    makeMealSlotsDroppable(); // This function is defined within this IIFE
    makeMealSlotsSwipeable(); // enable swipe to remove
    fetchHistory(); // This will eventually call renderHistory, which calls makeRecipeItemsDraggable
    fetchFavorites(); // This will eventually call renderFavorites, which calls makeRecipeItemsDraggable
  };

  // Initial load if panel is visible
  if (mealsPanelWrapper && !mealsPanelWrapper.classList.contains("hidden")) {
    fetchFavorites(); // This will eventually call renderFavorites, which calls makeRecipeItemsDraggable
    fetchHistory(); // This will eventually call renderHistory, which calls makeRecipeItemsDraggable
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
  let currentDate = null,
    currentMealType = null,
    currentMonth = null;
  let isFavorite = false;
  let currentRecipeUuid = null;

  function setModalFields(rec) {
    titleInput.value = rec && rec.title ? rec.title : "";
    ingredientsInput.value =
      rec && rec.ingredients
        ? Array.isArray(rec.ingredients)
          ? rec.ingredients.join("\n")
          : rec.ingredients
        : "";
    isFavorite = rec && rec.isFavorite ? true : false;
    updateFavoriteStar();
    const tags = rec && rec.tags ? rec.tags : [];
    tagInputs.forEach((input) => {
      input.checked = tags.includes(input.value);
    });
  }

  function showModal(recipe, date, mealType) {
    modal.style.display = "flex";
    setTimeout(() => {
      modal.classList.add("open");
    }, 10);
    currentDate = date;
    currentMealType = mealType;
    currentMonth = date.slice(0, 7);
    currentRecipeUuid = (recipe && (recipe.uuid || recipe.recipe_uuid)) || null;
    setModalFields(recipe || {});
  }
  function hideModal() {
    modal.classList.remove("open");
    setTimeout(() => {
      modal.style.display = "none";
    }, 200);
    form.reset();
    isFavorite = false;
    currentRecipeUuid = null;
    updateFavoriteStar();
  }
  function updateFavoriteStar() {
    if (!favoriteStar) return;
    favoriteStar.textContent = isFavorite ? "star" : "star_outline";
    favoriteStar.classList.toggle("favorited", isFavorite);
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
    favoriteStar.parentElement.style.display = show ? "" : "none";
  }
  // Always show favorite toggle in modal
  showFavoriteStar(true);

  closeBtn.addEventListener("click", hideModal);
  cancelBtn.addEventListener("click", (e) => {
    e.preventDefault();
    hideModal();
  });
  const removeBtn = document.getElementById("recipe-remove");
  if (removeBtn) {
    removeBtn.addEventListener("click", () => {
      hideModal();
      const slot = document.querySelector(
        `.meal-slot[data-date="${currentDate}"][data-meal-type="${currentMealType}"]`
      );
      if (slot) window.removeMealSlot(slot);
    });
  }
  // Close modal when clicking outside modal content
  modal.addEventListener("click", function (e) {
    if (e.target === modal) hideModal();
  });
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const title = titleInput.value.trim();
    if (!title) return;
    let ingredients = ingredientsInput.value
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
    const tags = Array.from(tagInputs)
      .filter((i) => i.checked)
      .map((i) => i.value);
    const recipeData = { title, ingredients, tags, isFavorite };
    try {
      let recipe_uuid = currentRecipeUuid;
      if (recipe_uuid) {
        const r = await fetch("/api/recipes/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uuid: recipe_uuid, ...recipeData }),
        });
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error || "Failed to update recipe");
        }
      } else {
        const r = await fetch("/api/recipes/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(recipeData),
        });
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error || "Failed to add recipe");
        }
        const data = await r.json();
        recipe_uuid = data.uuid;
      }

      const resp = await fetch("/api/meals/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: currentMonth,
          date: currentDate,
          mealType: currentMealType,
          recipe_uuid,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save recipe");
      }
      hideModal();
      fetchAndRenderMealsMonthView();
    } catch (err) {
      alert("Error saving recipe: " + err.message);
    }
  });
  // Expose for use in meals view
  window.openRecipeModal = showModal;
})();

// Patch meal-slot click handler to open modal with data
function patchMealSlotClicksWithModal(mealsData, recipeMap) {
  document.querySelectorAll(".meal-slot").forEach((slot) => {
    slot.addEventListener("click", function (e) {
      // Prevent modal from opening if we just finished dragging
      if (slot.dataset.justDragged) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const date = slot.dataset.date;
      const mealType = slot.dataset.mealType;
      // Find recipe data if available
      let recipe = null;
      if (recipeMap) {
        recipe = recipeMap[slot.dataset.recipeUuid];
      }
      window.openRecipeModal(recipe, date, mealType);
    });
  });
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

  // Meals data is structured as { [month]: { [date]: { breakfast: {...}, lunch: {...}, dinner: {...} } } }
  // month = YYYY-MM, date = YYYY-MM-DD
  const mealsData = data || {};

  // --- Collect all recipe_uuids for this grid ---
  const recipeUuidSet = new Set();
  const cellInfoArr = [];
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  let gridStartDate = new Date(firstDayOfMonth);
  gridStartDate.setDate(gridStartDate.getDate() - gridStartDate.getDay());
  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(gridStartDate);
    cellDate.setDate(gridStartDate.getDate() + i);
    const dateStr = cellDate.toISOString().split("T")[0];
    const monthStr = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, "0")}`;
    const dayMeals = (mealsData[monthStr] && mealsData[monthStr][dateStr]) || {};
    ["breakfast", "lunch", "dinner"].forEach((mealType) => {
      const meal = dayMeals[mealType];
      let recipe_uuid = meal && meal.recipe_uuid;
      if (recipe_uuid) recipeUuidSet.add(recipe_uuid);
      cellInfoArr.push({ dateStr, mealType, meal, recipe_uuid });
    });
  }
  const recipeUuids = Array.from(recipeUuidSet);

  // --- Fetch all recipes in parallel, then render grid ---
  if (recipeUuids.length === 0) {
    // No recipes, render with default titles
    renderGrid({});
    if (window.onMealsGridRendered) {
      window.onMealsGridRendered(data, {}); // Pass the original mealsData
    }
  } else {
    Promise.all(
      recipeUuids.map(uuid => fetch(`/api/recipes/${uuid}`).then(r => r.ok ? r.json() : null))
    ).then(recipeObjs => {
      const recipeMap = {};
      recipeObjs.forEach((rec, idx) => {
        if (rec && rec.uuid) recipeMap[rec.uuid] = rec;
      });
      renderGrid(recipeMap);
      if (window.onMealsGridRendered) {
        window.onMealsGridRendered(data, recipeMap); // Pass the original mealsData
      }
    });
  }

  function renderGrid(recipeMap) {
    let mealsGridHtml = '<div class="meals-grid">';
    let cellIdx = 0;
    let gridStartDate = new Date(firstDayOfMonth);
    gridStartDate.setDate(gridStartDate.getDate() - gridStartDate.getDay());
    for (let i = 0; i < 42; i++) {
      const cellDate = new Date(gridStartDate);
      cellDate.setDate(gridStartDate.getDate() + i);
      let cellClasses = "meals-day-cell";
      const otherMonth = cellDate.getMonth() !== currentMonth;
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
      if (otherMonth) {
        mealsGridHtml += `<div class="other-month">`;
      }
      mealsGridHtml += `<div class="day-number">${cellDate.getDate()}</div>`;
      mealsGridHtml += `<div class="meals-zones">`;
      ["breakfast", "lunch", "dinner"].forEach((mealType, idx) => {
        let slotClasses = "meal-slot " + mealType + [" top", " mid", " bottom"][idx];
        const meal = dayMeals[mealType];
        // const slotClass = ["top", "mid", "bottom"][idx];
        let slotContent = "+";
        let locked = false;
        let recipe_uuid = meal && meal.recipe_uuid;
        if (meal) {
          locked = meal.locked ? true : false;
          if (recipe_uuid && recipeMap[recipe_uuid]) {
            slotContent = recipeMap[recipe_uuid].title || "+";
          }
        } else {
          slotClasses += " empty-meal-slot";
          slotContent = mealType.charAt(0).toUpperCase() + mealType.slice(1);
        }
        const lockIcon = `<span class="meal-lock-icon material-symbols-outlined" data-locked="${locked}" title="${locked ? 'Unlock' : 'Lock'}">${locked ? 'lock' : 'lock_open'}</span>`;
        const deleteBg = `<div class="delete-bg"><span class="material-symbols-outlined">delete</span></div>`;
        const inner = `<div class="meal-slot-inner">${lockIcon}<span class="meal-slot-title">${slotContent}</span></div>`;
        mealsGridHtml += `<div class="${slotClasses}" data-date="${dateStr}" data-meal-type="${mealType}" data-locked="${locked}" data-recipe-uuid="${recipe_uuid}">${deleteBg}${inner}</div>`;
      });
      if (otherMonth) {
        mealsGridHtml += `</div>`;
      }
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
        lockIcon.textContent = locked ? 'lock' : 'lock_open';
        lockIcon.setAttribute('data-locked', locked);
        lockIcon.title = locked ? 'Unlock' : 'Lock';
        lockIcon.onclick = (e) => {
          e.stopPropagation();
          locked = !locked;
          mealSlotLocks[key] = locked;
          slot.setAttribute('data-locked', locked);
          lockIcon.textContent = locked ? 'lock' : 'lock_open';
          lockIcon.setAttribute('data-locked', locked);
          lockIcon.title = locked ? 'Unlock' : 'Lock';
        };
      }
    });
    window.mealSlotLocks = mealSlotLocks;
    // Ensure meal slots are always droppable after rendering
    // Only call after DOM is updated and grid is rendered
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