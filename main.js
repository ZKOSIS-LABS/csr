import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

// ----- Scene Setup -----
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  35,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 0, 0);
camera.rotation.y = Math.PI / 2;

const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById("scene"),
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Orbit Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;

// Using a 180° vertical limit (no horizontal restriction)
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

// ----- Global Variables for Hover, Popup, and Models -----
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const textObjects = [];

let hoveredObject = null;
let currentPopupTitle = "";
let popupDom = null;

let modelBox = null; // Bounding box for the office model
let officeModel = null; // Global office model reference

// Update mouse vector for desktop
window.addEventListener("mousemove", (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

// For mobile: attach touch events
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
        showPopup(hoveredObject.name, screenPos);
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
const officeLoader = new GLTFLoader();
officeLoader.load(
  "/assets/ofisi.glb", // Office model path
  (gltf) => {
    officeModel = gltf.scene;
    scene.add(officeModel);

    // Compute the bounding box for the office interior
    modelBox = new THREE.Box3().setFromObject(officeModel);
    const size = modelBox.getSize(new THREE.Vector3());
    console.log("Office Model Loaded!", size);

    // Center the office model
    const center = modelBox.getCenter(new THREE.Vector3());
    officeModel.position.sub(center);

    // Set camera limits based on interior dimensions
    const minDimension = Math.min(size.x, size.y, size.z);
    controls.maxDistance = minDimension * 0.3;
    camera.position.set(0, size.y * 0.5, minDimension * 0.5);

    // ----- Additional GLB Model Loading -----
    // This model will be integrated into the office interior.
    const additionalLoader = new GLTFLoader();
    additionalLoader.load(
      "/assets/sitdownfoo.glb", // Replace with your GLB model's path
      (gltf) => {
        const additionalModel = gltf.scene;
        // Adjust scale, position, and rotation
        additionalModel.scale.set(2, 2, 2);
        additionalModel.position.set(3, 1.1, -0.4);
        additionalModel.rotation.y = -Math.PI / 2; // Rotate 90° to the right

        // Add a dedicated light to illuminate the additional model
        const modelLight = new THREE.PointLight(0xffffff, 1, 10);
        modelLight.position.set(3, 4.1, 0.4); // Adjust this position as needed
        additionalModel.add(modelLight);

        // Parent the additional model to the office model for integration
        officeModel.add(additionalModel);
        console.log("Additional Model Integrated with dedicated light!");
      },
      undefined,
      (error) => {
        console.error("Error loading additional model:", error);
      }
    );
  },
  undefined,
  (error) => {
    console.error("Error loading office model:", error);
  }
);

// ----- Font and Title Text Loading -----
const fontLoader = new FontLoader();
fontLoader.load("/assets/helvetiker_regular.typeface.json", (font) => {
  const createText = (text, color, position) => {
    const textGeometry = new TextGeometry(text, {
      font: font,
      size: 0.1,
      height: 0.1,
      depth: 0.1,
    });
    const textMaterial = new THREE.MeshBasicMaterial({ color });
    const textMesh = new THREE.Mesh(textGeometry, textMaterial);
    textMesh.position.set(position.x, position.y, position.z);
    textMesh.name = text;
    scene.add(textMesh);
    textObjects.push(textMesh);
    return textMesh;
  };

  // Create 3D titles within the office
  createText("SOCIALS", 0x00008b, { x: 2, y: -2, z: 3 });
  createText("CHART", 0x00008b, { x: 3, y: -2, z: 0.5 });
  createText("INFO", 0x00008b, { x: -1, y: -1, z: 2 });

  // ----- 2D Popup DOM Functions -----
  function getScreenPosition(object, camera) {
    const vector = new THREE.Vector3();
    object.getWorldPosition(vector)
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
    } else if (title === "CHART") {
      div.classList.add("popup-chart");
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
    } else if (title === "CHART") {
      div.innerHTML = `
        <style>
          #dexscreener-embed {
            position: relative;
            width: 100%;
            min-height: 300px;
            min-width: 300px;
            padding-bottom: 125%;
          }
          @media(min-width: 1400px) {
            #dexscreener-embed {
              padding-bottom: 65%;
            }
          }
          #dexscreener-embed iframe {
            position: absolute;
            width: 100%;
            height: 100%;
            top: 0;
            left: 0;
            border: 0;
          }
        </style>
        <div id="dexscreener-embed">
          <iframe src="https://dexscreener.com/solana/Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartDefaultOnMobile=1&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15"></iframe>
        </div>
      `;
    } else {
      div.innerHTML = `<p>Popup for ${title}</p>`;
    }
    return div;
  }

  function showPopup(title, screenPos) {
    if (!popupDom) {
      popupDom = createPopupDom(title);
      document.body.appendChild(popupDom);
      currentPopupTitle = title;
    } else if (currentPopupTitle !== title) {
      popupDom.innerHTML = "";
      popupDom.classList.remove("popup-socials", "popup-info", "popup-chart");
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
      } else if (title === "INFO") {
        popupDom.classList.add("popup-info");
        popupDom.innerHTML = `
          <p>Crypto Strategic Rewards (CSR) is a pioneering rewards token launching on the Solana blockchain, designed to empower a vibrant community of crypto enthusiasts and investors. Leveraging Solana’s unparalleled speed and low transaction fees, CSR redefines digital incentives by seamlessly integrating decentralized finance with innovative tokenomics.</p>
        `;
      } else if (title === "CHART") {
        popupDom.classList.add("popup-chart");
        popupDom.innerHTML = `
          <style>
            #dexscreener-embed {
              position: relative;
              width: 100%;
              min-height: 300px;
              min-width: 300px;
              padding-bottom: 125%;
            }
            @media(min-width: 1400px) {
              #dexscreener-embed {
                padding-bottom: 65%;
              }
            }
            #dexscreener-embed iframe {
              position: absolute;
              width: 100%;
              height: 100%;
              top: 0;
              left: 0;
              border: 0;
            }
          </style>
          <div id="dexscreener-embed">
            <iframe src="https://dexscreener.com/solana/Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartDefaultOnMobile=1&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15"></iframe>
          </div>
        `;
      } else {
        popupDom.innerHTML = `<p>Popup for ${title}</p>`;
      }
      currentPopupTitle = title;
    }
    if (title === "CHART") {
      popupDom.style.right = "20px";
      popupDom.style.bottom = "20px";
      popupDom.style.left = "";
      popupDom.style.top = "";
    } else if (title === "SOCIALS") {
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

  // ----- Animation Loop -----
  function animate() {
    requestAnimationFrame(animate);
    // Make text always face the camera.
    // biome-ignore lint/complexity/noForEach: <explanation>
        textObjects.forEach((txt) => txt.lookAt(camera.position));
    controls.update();

    // Clamp only the vertical (y) position within the office interior.
    if (modelBox) {
      camera.position.y = THREE.MathUtils.clamp(
        camera.position.y,
        modelBox.min.y,
        modelBox.max.y
      );
    }

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(textObjects);
    if (intersects.length > 0) {
      const intersected = intersects[0].object;
      if (!hoveredObject || hoveredObject.name !== intersected.name) {
        hoveredObject = intersected;
        const screenPos = getScreenPosition(intersected, camera);
        showPopup(intersected.name, screenPos);
      }
    }
    if (popupDom && hoveredObject && currentPopupTitle === "INFO") {
      const screenPos = getScreenPosition(hoveredObject, camera);
      popupDom.style.left = `${screenPos.x}px`;
      popupDom.style.top = `${screenPos.y + 20}px`;
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
