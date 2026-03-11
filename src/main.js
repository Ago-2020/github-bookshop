import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const canvas = document.querySelector("#scene");
const statusEl = document.querySelector("#status");
const repoCardEl = document.querySelector("#repo-card");

const scene = new THREE.Scene();
scene.background = new THREE.Color("#120d0b");
scene.fog = new THREE.Fog("#120d0b", 15, 40);

const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.set(0, 4.8, 11);

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
controls.target.set(0, 3, 0);
controls.minDistance = 6;
controls.maxDistance = 18;
controls.maxPolarAngle = Math.PI / 2.05;

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clickableBooks = [];
let hoveredBook = null;
let selectedBook = null;

setupLights();
createRoom();
createShelves();
loadRepos();
animate();

window.addEventListener("resize", onResize);
window.addEventListener("pointermove", onPointerMove);
window.addEventListener("click", onClick);

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

  const fill = new THREE.PointLight("#d88f52", 15, 30, 2);
  fill.position.set(0, 4, 0);
  scene.add(fill);
}

function createRoom() {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 30),
    new THREE.MeshStandardMaterial({
      color: "#50301d",
      roughness: 0.9,
      metalness: 0.05,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 18),
    new THREE.MeshStandardMaterial({
      color: "#2a1e1a",
      roughness: 1,
    }),
  );
  backWall.position.set(0, 9, -8);
  scene.add(backWall);

  const ceilingGlow = new THREE.Mesh(
    new THREE.CircleGeometry(2.5, 48),
    new THREE.MeshBasicMaterial({
      color: "#ffb76a",
      transparent: true,
      opacity: 0.18,
    }),
  );
  ceilingGlow.position.set(0, 8.8, 1);
  ceilingGlow.rotation.x = Math.PI / 2;
  scene.add(ceilingGlow);
}

function createShelves() {
  const shelfMaterial = new THREE.MeshStandardMaterial({
    color: "#6d472a",
    roughness: 0.85,
    metalness: 0.05,
  });

  for (const z of [-3.5, 0, 3.5]) {
    const backPanel = new THREE.Mesh(
      new THREE.BoxGeometry(15, 6.8, 0.12),
      shelfMaterial,
    );
    backPanel.position.set(0, 3.5, z - 0.48);
    backPanel.receiveShadow = true;
    backPanel.castShadow = true;
    scene.add(backPanel);

    for (const x of [-7.2, 7.2]) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 6.8, 1.1),
        shelfMaterial,
      );
      post.position.set(x, 3.5, z);
      post.receiveShadow = true;
      post.castShadow = true;
      scene.add(post);
    }

    for (const y of [1.2, 3.2, 5.2]) {
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(14.6, 0.18, 1.1),
        shelfMaterial,
      );
      board.position.set(0, y, z);
      board.receiveShadow = true;
      board.castShadow = true;
      scene.add(board);
    }
  }
}

async function loadRepos() {
  statusEl.textContent = "Loading repositories...";

  try {
    const repos = await fetchRandomRepos(72);
    placeBooks(repos);
    statusEl.textContent = `Loaded ${repos.length} repositories.`;
  } catch (error) {
    console.error(error);
    statusEl.textContent =
      "GitHub request failed. Check rate limits or try reloading.";
  }
}

async function fetchRandomRepos(count) {
  const minStars = Math.floor(Math.random() * 800);
  const page = Math.floor(Math.random() * 8) + 1;
  const languageFilters = ["javascript", "typescript", "python", "go", "rust"];
  const language =
    languageFilters[Math.floor(Math.random() * languageFilters.length)];

  const url =
    "https://api.github.com/search/repositories" +
    `?q=stars:>${minStars}+language:${language}+archived:false` +
    `&sort=updated&order=desc&per_page=${count}&page=${page}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = await response.json();
  return data.items ?? [];
}

function placeBooks(repos) {
  const shelfRows = [
    { y: 1.35, z: -3.5 },
    { y: 3.35, z: -3.5 },
    { y: 5.35, z: -3.5 },
    { y: 1.35, z: 0 },
    { y: 3.35, z: 0 },
    { y: 5.35, z: 0 },
    { y: 1.35, z: 3.5 },
    { y: 3.35, z: 3.5 },
    { y: 5.35, z: 3.5 },
  ];

  let repoIndex = 0;

  for (const row of shelfRows) {
    let x = -7;

    while (x < 6.8 && repoIndex < repos.length) {
      const repo = repos[repoIndex];
      const book = createBook(repo);
      const width = book.userData.width;

      book.position.set(
        x + width / 2,
        row.y + book.userData.height / 2,
        row.z,
      );
      book.userData.baseY = book.position.y;
      book.userData.baseZ = book.position.z;

      scene.add(book);
      clickableBooks.push(book);

      x += width + 0.05 + Math.random() * 0.04;
      repoIndex += 1;
    }
  }
}

function createBook(repo) {
  const width = THREE.MathUtils.randFloat(0.18, 0.38);
  const height = THREE.MathUtils.randFloat(0.9, 1.45);
  const depth = THREE.MathUtils.randFloat(0.62, 0.82);

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

  const tilt = THREE.MathUtils.randFloatSpread(0.06);
  book.rotation.y = tilt;

  book.userData = {
    repo,
    width,
    height,
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

  return map[language] ?? Math.random();
}

function onPointerMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function onClick() {
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

function animate() {
  requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();

  updateIntersections();

  for (const book of clickableBooks) {
    const isActive = hoveredBook === book || selectedBook === book;
    const targetY = isActive ? 0.06 : 0;

    book.position.z =
      book.userData.baseZ +
      Math.sin(elapsed + book.userData.wobbleOffset) * 0.02;
    book.position.y += (book.userData.baseY + targetY - book.position.y) * 0.12;
  }

  controls.update();
  renderer.render(scene, camera);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
