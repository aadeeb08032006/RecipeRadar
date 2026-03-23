/**
 * Recipe Finder App — app.js
 * API: TheMealDB (https://www.themealdb.com/api.php)
 * Features: Search, Filter by Category, Sort A-Z/Z-A, Dark Mode, Recipe Modal
 */

/* ============================================================
   Constants & State
   ============================================================ */
const API_BASE = "https://www.themealdb.com/api/json/v1/1";

let allMeals = []; // raw results from last search
let filteredMeals = []; // after category filter + sort

/* ============================================================
   DOM References
   ============================================================ */
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const categoryFilter = document.getElementById("categoryFilter");
const sortSelect = document.getElementById("sortSelect");
const recipeGrid = document.getElementById("recipeGrid");
const stateBox = document.getElementById("stateBox");
const stateEmoji = document.getElementById("stateEmoji");
const stateMsg = document.getElementById("stateMsg");
const resultsCount = document.getElementById("resultsCount");
const darkToggle = document.getElementById("darkToggle");
const toggleIcon = document.getElementById("toggleIcon");
const modalOverlay = document.getElementById("modalOverlay");
const modalClose = document.getElementById("modalClose");
const backToTop = document.getElementById("backToTop");

/* ============================================================
   Theme (Dark / Light)
   ============================================================ */
function initTheme() {
  const saved = localStorage.getItem("rf-theme") || "light";
  setTheme(saved);
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  toggleIcon.textContent = theme === "dark" ? "☀️" : "🌙";
  localStorage.setItem("rf-theme", theme);
}

darkToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  setTheme(current === "dark" ? "light" : "dark");
});

/* ============================================================
   Fetch Helpers
   ============================================================ */

/** Search meals by name */
async function fetchMealsByName(query) {
  const res = await fetch(
    `${API_BASE}/search.php?s=${encodeURIComponent(query)}`,
  );
  const data = await res.json();
  return data.meals || [];
}

/** Get full meal details by ID */
async function fetchMealById(id) {
  const res = await fetch(`${API_BASE}/lookup.php?i=${id}`);
  const data = await res.json();
  return data.meals ? data.meals[0] : null;
}

/** Get all categories */
async function fetchCategories() {
  const res = await fetch(`${API_BASE}/categories.php`);
  const data = await res.json();
  return data.categories || [];
}

/* ============================================================
   Categories — populate filter dropdown
   ============================================================ */
async function loadCategories() {
  try {
    const categories = await fetchCategories();
    categories.forEach((cat) => {
      const option = document.createElement("option");
      option.value = cat.strCategory;
      option.textContent = cat.strCategory;
      categoryFilter.appendChild(option);
    });
  } catch {
    console.warn("Could not load categories.");
  }
}

/* ============================================================
   Search
   ============================================================ */
async function handleSearch() {
  const query = searchInput.value.trim();
  if (!query) return;

  showState("loading");

  try {
    allMeals = await fetchMealsByName(query);
    categoryFilter.value = "all";
    sortSelect.value = "default";

    if (allMeals.length === 0) {
      showState(
        "empty",
        `No recipes found for "${query}". Try something else!`,
      );
      return;
    }

    applyFilterAndSort();
  } catch {
    showState(
      "error",
      "Something went wrong. Check your connection and try again.",
    );
  }
}

searchBtn.addEventListener("click", handleSearch);
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSearch();
});

/* ============================================================
   Filter & Sort — Higher Order Functions
   ============================================================ */
function applyFilterAndSort() {
  const category = categoryFilter.value;
  const sort = sortSelect.value;

  // Filter using HOF: Array.filter
  filteredMeals = allMeals.filter((meal) =>
    category === "all" ? true : meal.strCategory === category,
  );

  // Sort using HOF: Array.sort
  filteredMeals = filteredMeals.sort((a, b) => {
    if (sort === "az") return a.strMeal.localeCompare(b.strMeal);
    if (sort === "za") return b.strMeal.localeCompare(a.strMeal);
    return 0; // default — preserve original order
  });

  renderCards(filteredMeals);
}

categoryFilter.addEventListener("change", applyFilterAndSort);
sortSelect.addEventListener("change", applyFilterAndSort);

/* ============================================================
   Render Cards
   ============================================================ */
function renderCards(meals) {
  recipeGrid.innerHTML = "";

  if (meals.length === 0) {
    showState("empty", "No recipes match the current filter.");
    updateResultsCount(0);
    return;
  }

  hideState();
  updateResultsCount(meals.length);

  // Map using HOF: Array.map to create card HTML strings, then join & insert
  const cardsHTML = meals
    .map((meal, index) => createCardHTML(meal, index))
    .join("");
  recipeGrid.innerHTML = cardsHTML;

  // Attach click events
  recipeGrid.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("click", () => openModal(card.dataset.id));
  });
}

function createCardHTML(meal, index) {
  const delayMs = Math.min(index * 60, 600);
  const area = meal.strArea ? `🌍 ${meal.strArea}` : "";
  return `
    <article class="card" data-id="${meal.idMeal}" style="animation-delay:${delayMs}ms" tabindex="0" role="button" aria-label="View ${meal.strMeal} recipe">
      <div class="card-img-wrap">
        <img class="card-img" src="${meal.strMealThumb}" alt="${meal.strMeal}" loading="lazy" />
        ${meal.strCategory ? `<span class="card-badge">${meal.strCategory}</span>` : ""}
      </div>
      <div class="card-body">
        <h2 class="card-title">${meal.strMeal}</h2>
        <div class="card-footer">
          <span class="card-area">${area}</span>
          <span class="card-cta">View Recipe →</span>
        </div>
      </div>
    </article>
  `;
}

/* ============================================================
   Modal
   ============================================================ */
async function openModal(id) {
  // Show loading inside modal
  document.getElementById("modalTitle").textContent = "Loading…";
  document.getElementById("modalImg").src = "";
  document.getElementById("ingredientList").innerHTML = "";
  document.getElementById("instructionsText").textContent = "";
  document.getElementById("modalMeta").innerHTML = "";
  document.getElementById("modalCategoryTag").textContent = "";
  document.getElementById("youtubeLink").style.display = "none";
  modalOverlay.classList.add("active");
  document.body.style.overflow = "hidden";

  try {
    const meal = await fetchMealById(id);
    if (!meal) return;
    populateModal(meal);
  } catch {
    document.getElementById("modalTitle").textContent =
      "Could not load recipe.";
  }
}

function populateModal(meal) {
  // Image
  const img = document.getElementById("modalImg");
  img.src = meal.strMealThumb;
  img.alt = meal.strMeal;

  // Title
  document.getElementById("modalTitle").textContent = meal.strMeal;

  // Category tag
  document.getElementById("modalCategoryTag").textContent =
    meal.strCategory || "";

  // Meta chips
  const metaParts = [
    meal.strCategory && `🍽️ ${meal.strCategory}`,
    meal.strArea && `🌍 ${meal.strArea}`,
    meal.strTags && `🏷️ ${meal.strTags.split(",").slice(0, 3).join(", ")}`,
  ].filter(Boolean);

  document.getElementById("modalMeta").innerHTML = metaParts
    .map((p) => `<span>${p}</span>`)
    .join("");

  // Ingredients — extract using a loop (indices 1–20)
  const ingredientList = document.getElementById("ingredientList");
  ingredientList.innerHTML = "";
  for (let i = 1; i <= 20; i++) {
    const ing = meal[`strIngredient${i}`];
    const measure = meal[`strMeasure${i}`];
    if (ing && ing.trim()) {
      const li = document.createElement("li");
      li.textContent = `${measure ? measure.trim() + " " : ""}${ing.trim()}`;
      ingredientList.appendChild(li);
    }
  }

  // Instructions
  document.getElementById("instructionsText").textContent =
    meal.strInstructions || "No instructions available.";

  // YouTube link
  const ytLink = document.getElementById("youtubeLink");
  if (meal.strYoutube) {
    ytLink.href = meal.strYoutube;
    ytLink.style.display = "inline-flex";
  } else {
    ytLink.style.display = "none";
  }
}

function closeModal() {
  modalOverlay.classList.remove("active");
  document.body.style.overflow = "";
}

modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

/* ============================================================
   State Display (loading / empty / error)
   ============================================================ */
function showState(type, message = "") {
  recipeGrid.innerHTML = "";
  updateResultsCount(0);
  stateBox.classList.remove("hidden");

  if (type === "loading") {
    stateBox.innerHTML = `<div class="spinner"></div><p class="state-msg">Finding delicious recipes…</p>`;
  } else if (type === "empty") {
    stateBox.innerHTML = `<div class="state-emoji">🍽️</div><p class="state-msg">${message}</p>`;
  } else if (type === "error") {
    stateBox.innerHTML = `<div class="state-emoji">⚠️</div><p class="state-msg">${message}</p>`;
  } else {
    // default / initial
    stateBox.innerHTML = `<div class="state-emoji">🔍</div><p class="state-msg">Search for a recipe above to get started!</p>`;
  }
}

function hideState() {
  stateBox.innerHTML = "";
  stateBox.classList.add("hidden");
}

function updateResultsCount(n) {
  resultsCount.textContent =
    n > 0 ? `${n} recipe${n !== 1 ? "s" : ""} found` : "";
}

/* ============================================================
   Back to Top
   ============================================================ */
window.addEventListener("scroll", () => {
  backToTop.classList.toggle("visible", window.scrollY > 400);
});

backToTop.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

/* ============================================================
   Init
   ============================================================ */
function init() {
  initTheme();
  loadCategories();
  showState("default");
}

init();
