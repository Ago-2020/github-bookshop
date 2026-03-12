import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const canvas = document.querySelector("#scene");
const statusEl = document.querySelector("#status");
const repoCardEl = document.querySelector("#repo-card");
const filtersPanelEl = document.querySelector("#filters-panel");
const filtersEl = document.querySelector("#filters");
const toggleFiltersPanelButton = document.querySelector("#toggle-filters-panel");
const refreshButton = document.querySelector("#refresh-button");
const languageFiltersEl = document.querySelector("#language-filters");
const starFiltersEl = document.querySelector("#star-filters");
const bookCountInputEl = document.querySelector("#book-count");
const bookCountValueEl = document.querySelector("#book-count-value");

const languageOptions = [
  { value: "any", label: "Any" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
];

const starOptions = [
  { value: 25, label: "25+" },
  { value: 100, label: "100+" },
  { value: 500, label: "500+" },
  { value: 2000, label: "2k+" },
];

const state = {
  language: "any",
  minStars: 25,
  bookCount: Number(bookCountInputEl.value),
  filtersOpen: true,
  loadToken: 0,
};

const scene = new THREE.Scene();
scene.background = new THREE.Color("#120d0b");
scene.fog = new THREE.Fog("#120d0b", 15, 42);

const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.set(0, 5.2, 12.5);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 2.8, 0.5);
controls.minDistance = 6;
controls.maxDistance = 18;
controls.maxPolarAngle = Math.PI / 2.08;

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(2, 2);
const clickableBooks = [];
const shelfSlots = [];

let hoveredBook = null;
let selectedBook = null;

setupLights();
createRoom();
createShelves();
renderFilterControls();
syncBookCountDisplay();
syncFilterPanel();
void loadRepos();
animate();

window.addEventListener("resize", onResize);
window.addEventListener("pointermove", onPointerMove);
window.addEventListener("click", onClick);
toggleFiltersPanelButton.addEventListener("click", toggleFilters);
refreshButton.addEventListener("click", () => {
  void loadRepos();
});
bookCountInputEl.addEventListener("input", onBookCountInput);
bookCountInputEl.addEventListener("change", onBookCountChange);

function setupLights() {
  const ambient = new THREE.AmbientLight("#f4d7b8", 1.5);
  scene.add(ambient);

  const key = new THREE.DirectionalLight("#ffe7c0", 2.2);
  key.position.set(6, 10, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -15;
  key.shadow.camera.right = 15;
  key.shadow.camera.top = 15;
  key.shadow.camera.bottom = -15;
  scene.add(key);

  const fill = new THREE.PointLight("#d88f52", 18, 32, 2);
  fill.position.set(0, 4.5, 0);
  scene.add(fill);
}

function createRoom() {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(42, 32),
    new THREE.MeshStandardMaterial({
      color: "#50301d",
      roughness: 0.92,
      metalness: 0.04,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(42, 18),
    new THREE.MeshStandardMaterial({
      color: "#2a1e1a",
      roughness: 1,
    }),
  );
  backWall.position.set(0, 9, -9);
  scene.add(backWall);

  const ceilingGlow = new THREE.Mesh(
    new THREE.CircleGeometry(2.7, 48),
    new THREE.MeshBasicMaterial({
      color: "#ffb76a",
      transparent: true,
      opacity: 0.18,
    }),
  );
  ceilingGlow.position.set(0, 8.9, 1);
  ceilingGlow.rotation.x = Math.PI / 2;
  scene.add(ceilingGlow);
}

function createShelves() {
  const shelfDefinitions = [
    { position: new THREE.Vector3(-8.4, 0, 2.8), rotationY: 0.72 },
    { position: new THREE.Vector3(0, 0, -4.1), rotationY: 0 },
    { position: new THREE.Vector3(8.4, 0, 2.8), rotationY: -0.72 },
  ];

  for (const definition of shelfDefinitions) {
    createShelfUnit(definition);
  }
}

function createShelfUnit({ position, rotationY }) {
  const boardDepth = 1.08;
  const boardThickness = 0.18;
  const shelfMaterial = new THREE.MeshStandardMaterial({
    color: "#6d472a",
    roughness: 0.85,
    metalness: 0.05,
  });

  const group = new THREE.Group();
  group.position.copy(position);
  group.rotation.y = rotationY;
  scene.add(group);

  const backPanel = new THREE.Mesh(
    new THREE.BoxGeometry(9.6, 6.8, 0.12),
    shelfMaterial,
  );
  backPanel.position.set(0, 3.5, -0.48);
  backPanel.receiveShadow = true;
  backPanel.castShadow = true;
  group.add(backPanel);

  for (const x of [-4.7, 4.7]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 6.8, 1.08),
      shelfMaterial,
    );
    post.position.set(x, 3.5, 0);
    post.receiveShadow = true;
    post.castShadow = true;
    group.add(post);
  }

  for (const y of [1.2, 3.2, 5.2]) {
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(9.2, boardThickness, boardDepth),
      shelfMaterial,
    );
    board.position.set(0, y, 0);
    board.receiveShadow = true;
    board.castShadow = true;
    group.add(board);
  }

  group.updateMatrixWorld(true);

  for (const y of [1.35, 3.35, 5.35]) {
    const start = group.localToWorld(new THREE.Vector3(-4.25, y, 0));
    const end = group.localToWorld(new THREE.Vector3(4.25, y, 0));
    const direction = end.clone().sub(start).normalize();
    const shelfCenter = group.localToWorld(new THREE.Vector3(0, y, 0));
    const shelfFront = group.localToWorld(new THREE.Vector3(0, y, 1));
    const forward = shelfFront.sub(shelfCenter).setY(0).normalize();

    shelfSlots.push({
      start,
      direction,
      forward,
      length: 8.5,
      rotationY,
      shelfY: y,
      boardTop: y + boardThickness / 2,
      boardFront: boardDepth / 2,
    });
  }
}

function renderFilterControls() {
  renderChipGroup(languageFiltersEl, languageOptions, state.language, (value) => {
    state.language = value;
    renderFilterControls();
    void loadRepos();
  });

  renderChipGroup(starFiltersEl, starOptions, state.minStars, (value) => {
    state.minStars = value;
    renderFilterControls();
    void loadRepos();
  });
}

function renderChipGroup(container, options, activeValue, onSelect) {
  container.innerHTML = "";

  for (const option of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    if (option.value === activeValue) {
      button.classList.add("chip--active");
    }
    button.textContent = option.label;
    button.addEventListener("click", () => onSelect(option.value));
    container.append(button);
  }
}

function toggleFilters() {
  state.filtersOpen = !state.filtersOpen;
  syncFilterPanel();
}

function syncFilterPanel() {
  filtersPanelEl.classList.toggle("panel--collapsed", !state.filtersOpen);
  filtersEl.classList.toggle("filters--open", state.filtersOpen);
  toggleFiltersPanelButton.setAttribute(
    "aria-expanded",
    String(state.filtersOpen),
  );
  toggleFiltersPanelButton.setAttribute(
    "aria-label",
    state.filtersOpen ? "Hide filters panel" : "Show filters panel",
  );
  toggleFiltersPanelButton.innerHTML = state.filtersOpen ? "&#10094;" : "&#10095;";
}

function syncBookCountDisplay() {
  bookCountValueEl.textContent = String(state.bookCount);
}

function onBookCountInput(event) {
  state.bookCount = Number(event.target.value);
  syncBookCountDisplay();
}

function onBookCountChange(event) {
  state.bookCount = Number(event.target.value);
  syncBookCountDisplay();
  void loadRepos();
}

async function loadRepos() {
  const loadToken = ++state.loadToken;
  setLoadingState(true);
  clearBooks();
  statusEl.textContent = "Loading repositories...";

  try {
    const repos = await fetchRandomRepos(state.bookCount + 24);

    if (loadToken !== state.loadToken) {
      return;
    }

    placeBooks(repos.slice(0, state.bookCount));
    selectedBook = null;
    repoCardEl.innerHTML =
      '<p class="repo-card__empty">Select a book on the shelf.</p>';
    statusEl.textContent = `Loaded ${Math.min(state.bookCount, repos.length)} repositories.`;
  } catch (error) {
    console.error(error);
    if (loadToken !== state.loadToken) {
      return;
    }
    statusEl.textContent =
      "GitHub request failed. Check rate limits or try another filter.";
  } finally {
    if (loadToken === state.loadToken) {
      setLoadingState(false);
    }
  }
}

async function fetchRandomRepos(targetCount) {
  const languageClause =
    state.language === "any" ? "" : `+language:${state.language}`;
  const repoMap = new Map();
  const requestCount = Math.max(2, Math.ceil(targetCount / 60));
  const requests = [];

  for (let index = 0; index < requestCount; index += 1) {
    const page = Math.floor(Math.random() * 10) + 1;
    const salt = Math.floor(Math.random() * 280);
    const url =
      "https://api.github.com/search/repositories" +
      `?q=stars:>${state.minStars + salt}${languageClause}+archived:false` +
      "&sort=updated&order=desc&per_page=60" +
      `&page=${page}`;

    requests.push(
      fetch(url, {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }),
    );
  }

  const responses = await Promise.all(requests);

  for (const response of responses) {
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    for (const repo of data.items ?? []) {
      repoMap.set(repo.id, repo);
    }
  }

  return Array.from(repoMap.values()).slice(0, targetCount);
}

function clearBooks() {
  hoveredBook = null;
  selectedBook = null;

  while (clickableBooks.length > 0) {
    const book = clickableBooks.pop();
    scene.remove(book);
    book.geometry.dispose();
    book.material.dispose();
  }

  updateBookStates();
}

function placeBooks(repos) {
  let repoIndex = 0;

  for (const slot of shelfSlots) {
    let distance = 0;

    while (distance < slot.length - 0.25 && repoIndex < repos.length) {
      const repo = repos[repoIndex];
      const book = createBook(repo, slot.rotationY);
      const width = book.userData.width;
      const height = book.userData.height;

      if (distance + width > slot.length) {
        break;
      }

      const forwardOffset = Math.max(0.02, slot.boardFront - book.userData.depth / 2 - 0.04);
      const position = slot.start
        .clone()
        .addScaledVector(slot.direction, distance + width / 2)
        .addScaledVector(slot.forward, forwardOffset);
      position.y = slot.boardTop + height / 2 - 0.15;

      book.position.copy(position);
      book.userData.basePosition = position.clone();
      book.userData.wobbleVector = slot.forward.clone();

      scene.add(book);
      clickableBooks.push(book);

      distance += width + 0.08 + Math.random() * 0.06;
      repoIndex += 1;
    }
  }
}

function createBook(repo, shelfRotationY) {
  const width = THREE.MathUtils.randFloat(0.34, 0.68);
  const height = THREE.MathUtils.randFloat(0.95, 1.55);
  const depth = THREE.MathUtils.randFloat(0.65, 0.9);

  const hue = getLanguageHue(repo.language);
  const color = new THREE.Color().setHSL(hue, 0.45, 0.42);

  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.72,
    metalness: 0.1,
  });

  const book = new THREE.Mesh(geometry, material);
  book.castShadow = true;
  book.receiveShadow = true;

  const tilt = THREE.MathUtils.randFloatSpread(0.05);
  book.rotation.y = shelfRotationY + tilt;

  book.userData = {
    repo,
    width,
    height,
    depth,
    baseColor: color.clone(),
    wobbleOffset: Math.random() * Math.PI * 2,
  };

  return book;
}

function getLanguageHue(language) {
  const map = {
    JavaScript: 0.12,
    TypeScript: 0.58,
    Python: 0.34,
    Go: 0.53,
    Rust: 0.04,
  };

  return map[language] ?? 0.08;
}

function onPointerMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function onClick(event) {
  if (event.target.closest(".panel")) {
    return;
  }

  if (!hoveredBook) {
    return;
  }

  selectedBook = hoveredBook;
  updateBookStates();
  renderRepoCard(selectedBook.userData.repo);
}

function updateIntersections() {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(clickableBooks, false);
  hoveredBook = hits[0]?.object ?? null;
  updateBookStates();
}

function updateBookStates() {
  for (const book of clickableBooks) {
    const material = book.material;
    const isHovered = hoveredBook === book;
    const isSelected = selectedBook === book;

    material.color.copy(book.userData.baseColor);

    if (isSelected) {
      material.emissive.set("#ffcc8a");
      material.emissiveIntensity = 0.5;
    } else if (isHovered) {
      material.emissive.set("#ffffff");
      material.emissiveIntensity = 0.2;
    } else {
      material.emissive.set("#000000");
      material.emissiveIntensity = 0;
    }
  }
}

function renderRepoCard(repo) {
  const updated = new Date(repo.updated_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  repoCardEl.innerHTML = `
    <div class="repo-card__header">
      <img class="repo-card__avatar" src="${repo.owner.avatar_url}" alt="${repo.owner.login}" />
      <div>
        <p class="repo-card__owner">${repo.owner.login}</p>
        <h2>${repo.name}</h2>
      </div>
    </div>
    <p class="repo-card__description">${repo.description ?? "No description available."}</p>
    <div class="repo-card__stats">
      <span>Stars ${repo.stargazers_count}</span>
      <span>Forks ${repo.forks_count}</span>
      <span>${repo.language ?? "Unknown"}</span>
    </div>
    <p class="repo-card__meta">Updated ${updated}</p>
    <a class="repo-card__link" href="${repo.html_url}" target="_blank" rel="noreferrer">Open repository</a>
  `;
}

function setLoadingState(isLoading) {
  refreshButton.disabled = isLoading;
  toggleFiltersPanelButton.disabled = isLoading;
  bookCountInputEl.disabled = isLoading;
}

function animate() {
  requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();

  updateIntersections();

  for (const book of clickableBooks) {
    const isActive = hoveredBook === book || selectedBook === book;
    const lift = isActive ? 0.06 : 0;
    const wobble = Math.sin(elapsed + book.userData.wobbleOffset) * 0.02;

    book.position.copy(book.userData.basePosition);
    book.position.addScaledVector(book.userData.wobbleVector, wobble);
    book.position.y += lift;
  }

  controls.update();
  renderer.render(scene, camera);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
