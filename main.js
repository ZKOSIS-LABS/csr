import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import {
  CSS3DRenderer,
  CSS3DObject,
} from "three/examples/jsm/renderers/CSS3DRenderer";

// ----- Loading Screen Setup -----
const loadingScreen = document.createElement("div");
loadingScreen.id = "loadingScreen";
Object.assign(loadingScreen.style, {
  position: "fixed",
  top: "0",
  left: "0",
  width: "100%",
  height: "100%",
  backgroundColor: "#000",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  fontSize: "2em",
  zIndex: "9999999999999999999999999999999999999999",
});
loadingScreen.innerHTML = "Loading <br> 0%";
document.body.appendChild(loadingScreen);

// ----- Loading Manager -----
const manager = new THREE.LoadingManager();
manager.onProgress = (item, loaded, total) => {
  const progress = Math.round((loaded / total) * 100);
  loadingScreen.innerHTML = `Loading <br> ${progress}%`;
};
manager.onLoad = () => {
  loadingScreen.style.transition = "opacity 1s";
  loadingScreen.style.opacity = "0";
  setTimeout(() => {
    loadingScreen.remove();
  }, 1000);
};
manager.onError = (url) => {
  console.error(`Error loading: ${url}`);
};

// ----- Scene Setup -----
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(2, 2, 2);

const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById("scene"),
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// CSS3DRenderer remains for any other DOM elements if needed
const cssRenderer = new CSS3DRenderer();
cssRenderer.setSize(window.innerWidth, window.innerHeight);
cssRenderer.domElement.style.position = "absolute";
cssRenderer.domElement.style.top = "0";
cssRenderer.domElement.style.pointerEvents = "none";
document.body.appendChild(cssRenderer.domElement);

// Orbit Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
const verticalLimit = THREE.MathUtils.degToRad(180);
controls.minPolarAngle = Math.PI / 2 - verticalLimit;
controls.maxPolarAngle = Math.PI / 2 + verticalLimit;
controls.minDistance = 1;

// Lights
const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(1, 4, 1);
scene.add(light);
const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);

// ----- Video Plane Setup -----


// ----- Global Variables for Popups, Models, and Coins -----
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const textObjects = [];

let hoveredObject = null;
let currentPopupTitle = "";
let popupDom = null; // For SOCIALS & INFO 2D popups
let infoPopup3D = null; // For 3D INFO popup as a plane

// New: For CHART popup as a 2D DOM element
let chartPopupDom = null;

let modelBox = null;
let officeModel = null;

// --- Coin System Globals ---
let coins = [];
let lastCoinSpawnTime = performance.now();
const coinGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.01, 32);
const coinMaterial = new THREE.MeshStandardMaterial({
  color: 0xffd700,
  metalness: 0.98,
  roughness: 0.32,
});
let coinEmitters = [];

// ----- WASD Movement Setup -----
const keys = { w: false, a: false, s: false, d: false };
window.addEventListener("keydown", (event) => {
  switch (event.key.toLowerCase()) {
    case "w":
      keys.w = true;
      break;
    case "a":
      keys.a = true;
      break;
    case "s":
      keys.s = true;
      break;
    case "d":
      keys.d = true;
      break;
  }
});
window.addEventListener("keyup", (event) => {
  switch (event.key.toLowerCase()) {
    case "w":
      keys.w = false;
      break;
    case "a":
      keys.a = false;
      break;
    case "s":
      keys.s = false;
      break;
    case "d":
      keys.d = false;
      break;
  }
});

// ----- Mouse/Touch Events for Popup Interaction -----
window.addEventListener("mousemove", (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});
renderer.domElement.addEventListener(
  "touchstart",
  (event) => {
    if (event.touches.length > 0) {
      const touch = event.touches[0];
      mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(textObjects);
      if (intersects.length > 0) {
        hoveredObject = intersects[0].object;
        const screenPos = getScreenPosition(hoveredObject, camera);
        if (hoveredObject.name === "INFO") {
          showInfoPopup3D(hoveredObject);
          if (popupDom) {
            document.body.removeChild(popupDom);
            popupDom = null;
          }
        } else if (hoveredObject.name === "CHART") {
          // Use the new 2D DOM popup for CHART
          showChartPopupDom();
        } else {
          if (infoPopup3D) {
            scene.remove(infoPopup3D);
            infoPopup3D = null;
          }
          showPopup(hoveredObject.name, screenPos);
        }
      }
    }
  },
  false
);
renderer.domElement.addEventListener(
  "touchmove",
  (event) => {
    if (event.touches.length > 0) {
      const touch = event.touches[0];
      mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
    }
  },
  false
);

// ----- Office Model Loading -----
const officeLoader = new GLTFLoader(manager);
officeLoader.load(
  "/assets/ofisi.glb", // Office model path
  (gltf) => {
    officeModel = gltf.scene;
    scene.add(officeModel);
    modelBox = new THREE.Box3().setFromObject(officeModel);
    const size = modelBox.getSize(new THREE.Vector3());
    console.log("Office Model Loaded!", size);
    const center = modelBox.getCenter(new THREE.Vector3());
    officeModel.position.sub(center);
    modelBox = new THREE.Box3().setFromObject(officeModel);
    modelBox.expandByScalar(1000000);
    const minDimension = Math.min(size.x, size.y, size.z);
    controls.maxDistance = minDimension * 0.3;
    camera.position.set(0, size.y * 0.5, minDimension * 0.5);

    // ----- Additional GLB Model Loading -----
    const additionalLoader = new GLTFLoader(manager);
    additionalLoader.load(
      "/assets/sitdownfoo.glb",
      (gltf) => {
        const additionalModel = gltf.scene;
        additionalModel.scale.set(2, 2, 2);
        additionalModel.position.set(3, 1.1, -0.4);
        additionalModel.rotation.y = -Math.PI / 2;

        const modelLight = new THREE.PointLight(0xffffff, 1, 10);
        modelLight.position.set(3, 4.1, 0.4);
        additionalModel.add(modelLight);

        officeModel.add(additionalModel);
        console.log("Additional Model Integrated with dedicated light!");

        // --- Set up coin emitters on the money guns ---
        const leftEmitter = new THREE.Object3D();
        leftEmitter.position.set(-0.13, 0.38, 0.36); // adjust offset for left gun
        additionalModel.add(leftEmitter);
        const rightEmitter = new THREE.Object3D();
        rightEmitter.position.set(0.2, 0.38, 0.36); // adjust offset for right gun
        additionalModel.add(rightEmitter);
        coinEmitters.push(leftEmitter, rightEmitter);
      },
      undefined,
      (error) => {
        console.error("Error loading additional model:", error);
      }
    );
    // ----- Load cryptizo.glb and place it in front of the additional model -----
    const cryptizoLoader = new GLTFLoader(manager);
    cryptizoLoader.load(
      "/assets/cryptizo.glb",
      (gltf) => {
        const cryptizoModel = gltf.scene;
        cryptizoModel.scale.set(0.8, 0.8, 0.8);
        cryptizoModel.position.set(2.7, 4.7, -0.2);
        cryptizoModel.rotation.y = -Math.PI / 2; // adjust scale if needed
        // Place cryptizoModel in front of additionalModel.
        // Assuming additionalModel’s local forward is along negative z, we offset by 2 units.
       
        cryptizoModel.add();
        officeModel.add(cryptizoModel);
      },
      undefined,
      (error) => {
        console.error("Error loading cryptizo.glb", error);
      }
    );
  },
  undefined,
  (error) => {
    console.error("Error loading office model:", error);
  }
);

// ----- Font and Title Text Loading -----
let loadedFont = null;
const fontLoader = new FontLoader(manager);
fontLoader.load("/assets/helvetiker_regular.typeface.json", (font) => {
  loadedFont = font;
  const createText = (text, color, position) => {
    const textGeometry = new TextGeometry(text, {
      font: font,
      size: 0.2,
      height: 0.1,
      depth: 0.2,
    });
    const textMaterial = new THREE.MeshBasicMaterial({ color });
    const textMesh = new THREE.Mesh(textGeometry, textMaterial);
    textMesh.position.set(position.x, position.y, position.z);
    textMesh.name = text;
    textMesh.rotation.y = -Math.PI / 2;
    scene.add(textMesh);
    textObjects.push(textMesh);
    return textMesh;
  };

  createText("SOCIALS", 0x00008ff, { x: 3, y: -2.5, z: -0.6 });
  createText("CHART", 0x0000ff, { x: 5, y: 1, z: -0.4 });
  createText("INFO", 0x0000ff, { x: 4, y: -0.5, z: -0.4 });

  // ----- 2D Popup DOM Functions for SOCIALS and INFO -----
  function getScreenPosition(object, camera) {
    const vector = new THREE.Vector3();
    object.getWorldPosition(vector);
    vector.project(camera);
    const x = ((vector.x + 1) / 2) * window.innerWidth;
    const y = ((1 - vector.y) / 2) * window.innerHeight;
    return { x, y };
  }

  function createPopupDom(title) {
    const div = document.createElement("div");
    div.id = "popupDom";
    Object.assign(div.style, {
      position: "fixed",
      padding: "10px",
      transform: "scale(0)",
      opacity: "0",
      transition: "transform 0.5s ease-out, opacity 0.5s ease-out",
      zIndex: 1000,
    });
    div.classList.add("popup");
    if (title === "SOCIALS") {
      div.classList.add("popup-socials");
    } else if (title === "INFO") {
      div.classList.add("popup-info");
    }
    if (title === "SOCIALS") {
      div.innerHTML = `
        <a href="https://telegram.org" target="_blank" style="color:#5f7396;">
          <img src="/tg.png" alt="Info Image" style="width:80px; height:auto;">
        </a>
        <a href="https://twitter.com" target="_blank" style="color:#5f7396;">
          <img src="/X.png" alt="Info Image" style="width:80px; height:auto;">
        </a>
      `;
    } else if (title === "INFO") {
      div.innerHTML = `
        <p>Crypto Strategic Rewards (CSR) is a pioneering rewards token launching on the Solana blockchain, designed to empower a vibrant community of crypto enthusiasts and investors. Leveraging Solana’s unparalleled speed and low transaction fees, CSR redefines digital incentives by seamlessly integrating decentralized finance with innovative tokenomics.</p>
      `;
    }
    return div;
  }

  function showPopup(title, screenPos) {
    if (title === "CHART") return; // CHART is now handled separately as a 2D DOM element
    if (!popupDom) {
      popupDom = createPopupDom(title);
      document.body.appendChild(popupDom);
      currentPopupTitle = title;
    } else if (currentPopupTitle !== title) {
      popupDom.innerHTML = "";
      popupDom.classList.remove("popup-socials", "popup-info");
      if (title === "SOCIALS") {
        popupDom.classList.add("popup-socials");
        popupDom.innerHTML = `
          <a href="https://telegram.org" target="_blank" style="color:#5f7396;">
            <img src="/tg.png" alt="Info Image" style="width:80px; height:auto;">
          </a>
          <a href="https://twitter.com" target="_blank" style="color:#5f7396;">
            <img src="/X.png" alt="Info Image" style="width:80px; height:auto;">
          </a>
        `;
      }
      currentPopupTitle = title;
    }
    if (title === "SOCIALS") {
      popupDom.style.left = "20px";
      popupDom.style.bottom = "20px";
      popupDom.style.right = "";
      popupDom.style.top = "";
    } else {
      popupDom.style.left = `${screenPos.x}px`;
      popupDom.style.top = `${screenPos.y + 20}px`;
      popupDom.style.right = "";
      popupDom.style.bottom = "";
    }
    popupDom.getBoundingClientRect();
    popupDom.style.transform = "scale(1)";
    popupDom.style.opacity = "1";
  }

  // ----- 3D INFO Popup as a Plane -----
  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(" ");
    let line = "";
    let currentY = y;
    for (let n = 0; n < words.length; n++) {
      const testLine = `${line + words[n]} `;
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, currentY);
        line = words[n] + " ";
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
  }

  function createInfoPopup3D() {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    context.fillStyle = "rgba(0, 0, 0, 0.81)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#fff";
    context.font = "17px Copperplate, sans-serif";
    const infoText =
      "Crypto Strategic Rewards (CSR) is a pioneering rewards token launching on the Solana blockchain, designed to empower a vibrant community of crypto enthusiasts and investors. Leveraging Solana’s unparalleled speed and low transaction fees, CSR redefines digital incentives by seamlessly integrating decentralized finance with innovative tokenomics.";
    wrapText(context, infoText, 10, 30, canvas.width - 20, 25);
    const texture = new THREE.CanvasTexture(canvas);
    const geometry = new THREE.PlaneGeometry(3, 1.5);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
    });
    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.y = -Math.PI / 2;
    return plane;
  }

  function showInfoPopup3D(object) {
    if (!infoPopup3D) {
      infoPopup3D = createInfoPopup3D();
      scene.add(infoPopup3D);
    }
    const pos = new THREE.Vector3();
    object.getWorldPosition(pos);
    infoPopup3D.position.copy(pos);
    infoPopup3D.position.y += 2.9;
  }

  // ----- New: 2D CHART Popup as a Fixed DOM Element -----
  function createChartPopupDom() {
    const div = document.createElement("div");
    div.id = "chartPopupDom";
    Object.assign(div.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      width: "450px",
      height: "300px",
      backgroundColor: "#fff",
      border: "0px solid #000",
      padding: "10px",
      zIndex: "1000",
      transform: "scale(0)",
      opacity: "0",
      transition: "transform 0.5s ease-out, opacity 0.5s ease-out",
    });
    div.innerHTML = `
      <iframe src="https://dexscreener.com/solana/Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartDefaultOnMobile=1&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15"
        style="width:100%; height:100%; border:0;"></iframe>
    `;
    return div;
  }

  function showChartPopupDom() {
    if (!chartPopupDom) {
      chartPopupDom = createChartPopupDom();
      document.body.appendChild(chartPopupDom);
    }
    // Force reflow to trigger CSS transition
    chartPopupDom.getBoundingClientRect();
    chartPopupDom.style.transform = "scale(1)";
    chartPopupDom.style.opacity = "1";
  }

  // ----- Animation Loop -----
  let lastTime = performance.now();
  function animate() {
    requestAnimationFrame(animate);
    const currentTime = performance.now();
    const delta = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    const speed = 4;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 2, 0)).normalize();

    if (keys.w)
      camera.position.add(forward.clone().multiplyScalar(speed * delta));
    if (keys.s)
      camera.position.add(forward.clone().multiplyScalar(-speed * delta));
    if (keys.a)
      camera.position.add(right.clone().multiplyScalar(speed * delta));
    if (keys.d)
      camera.position.add(right.clone().multiplyScalar(-speed * delta));

    if (modelBox) {
      camera.position.x = THREE.MathUtils.clamp(
        camera.position.x,
        modelBox.min.x,
        modelBox.max.x
      );
      camera.position.y = THREE.MathUtils.clamp(
        camera.position.y,
        modelBox.min.y,
        modelBox.max.y
      );
      camera.position.z = THREE.MathUtils.clamp(
        camera.position.z,
        modelBox.min.z,
        modelBox.max.z
      );
    }

   
    controls.update();

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(textObjects);
    if (intersects.length > 0) {
      const intersected = intersects[0].object;
      if (!hoveredObject || hoveredObject.name !== intersected.name) {
        hoveredObject = intersected;
        const screenPos = getScreenPosition(intersected, camera);
        if (intersected.name === "INFO") {
          showInfoPopup3D(intersected);
          if (popupDom) {
            document.body.removeChild(popupDom);
            popupDom = null;
          }
        } else if (intersected.name === "CHART") {
          // Call new 2D CHART popup DOM
          showChartPopupDom();
        } else {
          if (infoPopup3D) {
            scene.remove(infoPopup3D);
            infoPopup3D = null;
          }
          showPopup(intersected.name, screenPos);
        }
      }
    }
    if (infoPopup3D && hoveredObject && hoveredObject.name === "INFO") {
      const pos = new THREE.Vector3();
      hoveredObject.getWorldPosition(pos);
      infoPopup3D.position.copy(pos);
      infoPopup3D.position.y += 0.9;
    }
    // ----- Coin Spawning and Update -----
    const now = performance.now();
    if (now - lastCoinSpawnTime > 300 && coinEmitters.length > 0) {
      // biome-ignore lint/complexity/noForEach: <explanation>
      coinEmitters.forEach((emitter) => {
        const coin = new THREE.Mesh(coinGeometry, coinMaterial);
        emitter.getWorldPosition(coin.position);
        const dir = new THREE.Vector3();
        emitter.getWorldDirection(dir);
        dir.x += (Math.random() - 0.5) * 0.03;
        dir.y += (Math.random() - 0.5) * 0.03;
        dir.z += (Math.random() - 0.5) * 0.5;
        dir.normalize();
        coin.velocity = dir.multiplyScalar(1 + Math.random() * 2);
        coins.push(coin);
        scene.add(coin);
      });
      lastCoinSpawnTime = now;
    }
    for (let i = coins.length - 1; i >= 0; i--) {
      const coin = coins[i];
      coin.position.addScaledVector(coin.velocity, delta);
      if (coin.position.distanceTo(camera.position) > 40) {
        scene.remove(coin);
        coins.splice(i, 1);
      }
    }

    renderer.render(scene, camera);
  }
  animate();
});

// ----- Handle Window Resizing -----
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
