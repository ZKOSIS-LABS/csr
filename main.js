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
loadingScreen.innerHTML = "0%";
document.body.appendChild(loadingScreen);

// ----- Loading Manager -----
const manager = new THREE.LoadingManager();
manager.onProgress = (item, loaded, total) => {
  const progress = Math.round((loaded / total) * 100);
  loadingScreen.innerHTML = `${progress}%`;
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
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 0, 0);

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
// (Omitted in this snippet; add if needed)

// ----- Global Variables for Popups, Models, and Coins -----
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const textObjects = [];

let hoveredObject = null;
let currentPopupTitle = "";
let popupDom = null; // For SOCIALS & INFO 2D popups
let infoPopup3D = null; // For 3D INFO popup as a plane
let teslaMixer = null;
let tesla2Mixer = null;
let ethMixer = null;
let bidenMixer = null;

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
    camera.position.set(0, size.y * 0.0001, minDimension / 2000 + 2);
    // Rotate camera 45° clockwise around the scene’s center
    const target = new THREE.Vector3(0, 0, 0);
    const offset = camera.position.clone().sub(target);
    const spherical = new THREE.Spherical();
    spherical.setFromVector3(offset);
    spherical.theta += THREE.MathUtils.degToRad(-90);
    offset.setFromSpherical(spherical);
    camera.position.copy(target).add(offset);
    camera.lookAt(target);
    controls.target.copy(target);
    controls.update();

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

    // ----- Load miner.glb and integrate it within the office model -----
    // (Add code here if needed)

    // ----- Load tesla.glb and integrate it within the office model -----
    const teslaLoader = new GLTFLoader(manager);
    teslaLoader.load(
      "/assets/tesla.glb",
      (gltf) => {
        const teslaModel = gltf.scene;
        teslaModel.scale.set(1.5, 1.5, 1.5);
        teslaModel.position.set(0, 0, -5);
        officeModel.add(teslaModel);
        console.log("Tesla Model Integrated into Office Model!");
        if (gltf.animations && gltf.animations.length > 0) {
          teslaMixer = new THREE.AnimationMixer(teslaModel);
          gltf.animations.forEach((clip) => {
            const action = teslaMixer.clipAction(clip);
            action.play();
          });
        }
      },
      undefined,
      (error) => {
        console.error("Error loading tesla.glb:", error);
      }
    );
    const tesla2Loader = new GLTFLoader(manager);
    tesla2Loader.load(
      "/assets/tesla.glb",
      (gltf) => {
        const tesla2Model = gltf.scene;
        tesla2Model.scale.set(1.5, 1.5, 1.5);
        tesla2Model.position.set(0, 0, 4);
        tesla2Model.rotation.y = Math.PI;
        officeModel.add(tesla2Model);
        console.log("Tesla2 Model Integrated into Office Model!");
        if (gltf.animations && gltf.animations.length > 0) {
          tesla2Mixer = new THREE.AnimationMixer(tesla2Model);
          gltf.animations.forEach((clip) => {
            const action = tesla2Mixer.clipAction(clip);
            action.play();
          });
        }
      },
      undefined,
      (error) => {
        console.error("Error loading tesla.glb:", error);
      }
    );
        const bidenLoader = new GLTFLoader(manager);
        bidenLoader.load(
          "/assets/biden.glb",
          (gltf) => {
            const bidenModel = gltf.scene;
            bidenModel.scale.set(1.5, 1.5, 1.5);
            bidenModel.position.set(1, 0, -5);
            officeModel.add(bidenModel);
                         
            console.log("biden Model Integrated into Office Model!");

            if (gltf.animations && gltf.animations.length > 0) {
              bidenMixer = new THREE.AnimationMixer(bidenModel);
              gltf.animations.forEach((clip) => {
                const action = bidenMixer.clipAction(clip);
                action.play();
              });
            }
          },
          
          undefined,
          (error) => {
            console.error("Error loading biden.glb:", error);
          }
        );
               modelLight.position.set(1, 1, -4);
               officeModel.add(modelLight);

    // ----- Load eth.glb and integrate it within the office model -----
    const ethLoader = new GLTFLoader(manager);
    ethLoader.load(
      "/assets/eth.glb",
      (gltf) => {
        const ethModel = gltf.scene;
        ethModel.scale.set(0.25, 0.25, 0.25);
        ethModel.position.set(2, 1.4, -1.1);
        officeModel.add(ethModel);
        console.log("eth Model Integrated into Office Model!");
        if (gltf.animations && gltf.animations.length > 0) {
          ethMixer = new THREE.AnimationMixer(ethModel);
          gltf.animations.forEach((clip) => {
            const action = ethMixer.clipAction(clip);
            action.play();
          });
        }
      },
      undefined,
      (error) => {
        console.error("Error loading eth.glb:", error);
      }
    );

    // ----- Load cryptizo.glb and place it in front of the additional model -----
    const cryptizoLoader = new GLTFLoader(manager);
    cryptizoLoader.load(
      "/assets/cryptizo.glb",
      (gltf) => {
        const cryptizoModel = gltf.scene;
        cryptizoModel.scale.set(0.6, 0.6, 0.6);
        cryptizoModel.position.set(3.5, 5, -0.2);
        cryptizoModel.rotation.y = -Math.PI / 2;
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
      depth: 0.1,
    });
    const textMaterial = new THREE.MeshBasicMaterial({ color });
    const textMesh = new THREE.Mesh(textGeometry, textMaterial);
    textMesh.position.set(position.x, position.y, position.z);
    textMesh.name = text;
    textMesh.rotation.y = -Math.PI / 2;
    if (text === "INFO") {
      textMesh.rotation.y += Math.PI;
    }
    scene.add(textMesh);
    textObjects.push(textMesh);
    return textMesh;
  };

  createText("SOCIALS", 0xffffff, { x: 3, y: -2.3, z: -0.6 });
  createText("CHART", 0xffffff, { x: 5, y: 1.4, z: -0.4 });
  createText("INFO", 0xffffff, { x: -7.2, y: 1.3, z: 0.3 });

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
      div.innerHTML = `
        <a href="https://t.me/cryptostrategic_sol" target="_blank" style="color:#5f7396;">
          <img src="/tg.png" alt="Info Image" style="width:80px; height:auto;">
        </a>
        <a href="https://x.com/CSROfficialCoin" target="_blank" style="color:#5f7396;">
          <img src="/X.png" alt="Info Image" style="width:80px; height:auto;">
        </a>
      `;
    } else if (title === "INFO") {
      div.classList.add("popup-info");
      div.innerHTML = `
        <p>Crypto Strategic Reserve - What is it?
<br>
Trump’s Crypto Strategic Reserve aims to hold cryptocurrency in a government fund as a hedge against inflation and monetary instability. AKA, the government is going to print money and buy crypto (SOL, ETH, BTC, XRP, ADA). 
<br>
What is $CSR? 💵
<br>
$CSR is a rewards token that yields SOL, ETH, and BTC purely by holding.
<br>
1️⃣ Buy & Hold $CSR – A 5% tax is taken on both buys and sells
<br>
2️⃣ Earn Automatically – Our contract buys BTC, ETH, and SOL, then distributes it straight to you based on the percentage you hold.</p>
      `;
    }
    return div;
  }

  function showPopup(title, screenPos) {
    if (title === "CHART") return; // CHART is handled separately as a 2D DOM element
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
          <a href="https://t.me/cryptostrategic_sol" target="_blank" style="color:#5f7396;">
            <img src="/tg.png" alt="Info Image" style="width:80px; height:auto;">
          </a>
          <a href="https://x.com/CSROfficialCoin" target="_blank" style="color:#5f7396;">
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
  function wrapTextWithBR(ctx, text, x, y, maxWidth, lineHeight) {
    const paragraphs = text.split("<br>");
    let currentY = y;
    paragraphs.forEach((paragraph) => {
      const words = paragraph.trim().split(" ");
      let line = "";
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + " ";
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && line !== "") {
          ctx.fillText(line, x, currentY);
          line = words[n] + " ";
          currentY += lineHeight;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, x, currentY);
      currentY += lineHeight;
    });
  }

  function createInfoPopup3D() {
    const width = 512;
    const height = 336;
    const ratio = window.devicePixelRatio || 1;
    const canvas = document.createElement("canvas");
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    const context = canvas.getContext("2d");
    context.scale(ratio, ratio);
    context.fillStyle = "rgba(0, 0, 0, 0.81)";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#fff";
    context.font = "16px arial";
    const infoText =
      "Crypto Strategic Reserve - What is it? <br> Trump’s Crypto Strategic Reserve aims to hold cryptocurrency in a government fund as a hedge against inflation and monetary instability. AKA, the government is going to print money and buy crypto (SOL, ETH, BTC, XRP, ADA). <br> What is $CSR? 💵 <br> $CSR is a rewards token that yields SOL, ETH, and BTC purely by holding. <br> 1️⃣ Buy & Hold $CSR – A 5% tax is taken on both buys and sells <br> 2️⃣ Earn Automatically – Our contract buys BTC, ETH, and SOL, then distributes it straight to you based on the percentage you hold.";
    wrapTextWithBR(context, infoText, 10, 30, width - 20, 25);
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
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
    infoPopup3D.position.y += -2.9;
    infoPopup3D.rotation.y += Math.PI;
    infoPopup3D.position.x += 12.9;
  }

  // ----- New: 2D CHART Popup as a Fixed DOM Element -----
  function createChartPopupDom() {
    const div = document.createElement("div");
    div.id = "chartPopupDom";
    Object.assign(div.style, {
      position: "fixed",
      bottom: "-50px",
      left: "50%",
      width: "70vw",
      height: "400px",
      backgroundColor: "#000",
      border: "0px solid #000",
      padding: "1px",
      zIndex: "1000",
      transform: "translateX(-50%) scale(0)",
      opacity: "0",
      transition: "transform 0.5s ease-out, opacity 0.5s ease-out",
    });
    div.innerHTML = `
  <iframe id="dextools-widget"
    title="DEXTools Trading Chart"
    width="500" height="400"
    src="https://www.dextools.io/widget-chart/en/solana/pe-light/5hMMdyNcSo6frYew2q9454dJz5PgE9CPYtvfYWYvfxtU?theme=light&chartType=2&chartResolution=30&drawingToolbars=false"></iframe>
      <button id="chartCloseBtn" style="
        position: absolute;
        top: 5px;
        right: 5px;
        background-color: red;
        color: white;
        border: none;
        padding: 5px 10px;
        cursor: pointer;
        z-index: 1001;
      ">Close</button>
    `;
    div.querySelector("#chartCloseBtn").addEventListener("click", () => {
      div.style.transform = "translateX(-50%) scale(0)";
      div.style.opacity = "0";
      setTimeout(() => {
        if (div.parentNode) {
          div.parentNode.removeChild(div);
        }
        chartPopupDom = null;
      }, 500);
    });
    return div;
  }

  function showChartPopupDom() {
    if (chartPopupDom && !document.body.contains(chartPopupDom)) {
      chartPopupDom = null;
    }
    if (!chartPopupDom) {
      chartPopupDom = createChartPopupDom();
      document.body.appendChild(chartPopupDom);
    }
    chartPopupDom.getBoundingClientRect();
    chartPopupDom.style.transform = "translateX(-50%) scale(1)";
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
      infoPopup3D.position.y += -1.3;
      infoPopup3D.position.x += 4.3;
      infoPopup3D.position.z += -0.3;
    }

    if (teslaMixer) {
      teslaMixer.update(delta);
    }
        if (bidenMixer) {
          bidenMixer.update(delta);
        }
        if (tesla2Mixer) {
          tesla2Mixer.update(delta);
        }
    if (ethMixer) {
      ethMixer.update(delta);
    }
    // ----- Coin Spawning and Update -----
    const now = performance.now();
    if (now - lastCoinSpawnTime > 300 && coinEmitters.length > 0) {
      coinEmitters.forEach((emitter) => {
        const coin = new THREE.Mesh(coinGeometry, coinMaterial);
        emitter.getWorldPosition(coin.position);
        const dir = new THREE.Vector3();
        emitter.getWorldDirection(dir);
        dir.x += (Math.random() - 0.5) * 0.03;
        dir.y += (Math.random() + 0.5) * 0.3;
        dir.z += (Math.random() - 0.5) * 0.5;
        dir.normalize();
        coin.velocity = dir.multiplyScalar(1 + Math.random() * 7);
        // Add random angular velocity for rotation (radians per second)
        coin.rotationVelocity = new THREE.Vector3(
          (Math.random() - 0.5) * Math.PI,
          (Math.random() - 0.5) * Math.PI,
          (Math.random() - 0.5) * Math.PI
        );
        coins.push(coin);
        scene.add(coin);
      });
      lastCoinSpawnTime = now;
    }
    // Update coin positions and rotations with gravity
    const gravity = 30.81; // Adjust gravity constant as needed
    for (let i = coins.length - 1; i >= 0; i--) {
      const coin = coins[i];
      coin.velocity.y -= gravity * delta * 0.2;
      coin.position.addScaledVector(coin.velocity, delta);
      // Update rotation based on angular velocity
      coin.rotation.x += coin.rotationVelocity.x * delta;
      coin.rotation.y += coin.rotationVelocity.y * delta;
      coin.rotation.z += coin.rotationVelocity.z * delta;
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
