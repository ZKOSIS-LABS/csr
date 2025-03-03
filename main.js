import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

// ----- Scene Setup -----
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
// Adjusted camera position for the office interior
camera.position.set(0, 3, 3);

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

// Convert 5° to radians (5 * Math.PI / 180)
const verticalLimit = THREE.MathUtils.degToRad(13);

// Restrict the vertical rotation to a narrow band around the horizontal (π/2)
controls.minPolarAngle = Math.PI / 2 - verticalLimit;
controls.maxPolarAngle = Math.PI / 2 + verticalLimit;
// Set minDistance; maxDistance will be defined after loading the office model.
controls.minDistance = 1;

// Lights
const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(5, 10, 5);
scene.add(light);
const ambientLight = new THREE.AmbientLight(0x404040, 1);
scene.add(ambientLight);

// ----- Global Variables for Hover Detection and 2D Popup -----
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const textObjects = []; // Stores the 3D title meshes

let hoveredObject = null;
let currentPopupTitle = "";
let popupDom = null;

// Update mouse vector for desktop using mousemove on the window
window.addEventListener("mousemove", (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

// For mobile: attach touch events to the canvas
renderer.domElement.addEventListener(
  "touchstart",
  (event) => {
    if (event.touches.length > 0) {
      const touch = event.touches[0];
      mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
      // Trigger raycasting on touchstart
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

// ----- 3D Model Loading (Office Model) -----
const loader = new GLTFLoader();
loader.load(
  "/assets/offices.glb", // New office model file from Blender
  (gltf) => {
    const model = gltf.scene;
    scene.add(model);
    // Compute the bounding box of the office interior
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    console.log("Office Model Loaded!", size);

    // Optionally center the office model
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);

    // Set camera maxDistance based on office interior dimensions.
    // Here we use 80% of the smallest interior dimension to restrict the zoom.
    const minDimension = Math.min(size.x, size.y, size.z);
    controls.maxDistance = minDimension * 0.3;

    // Optionally, reposition the camera to ensure it's inside the office.
    camera.position.set(0, size.y * 0.5, minDimension * 0.5);
  },
  undefined,
  (error) => {
    console.error("Error loading office model:", error);
  }
);

// ----- Font and Title Text Loading -----
const fontLoader = new FontLoader();
fontLoader.load("/assets/helvetiker_regular.typeface.json", (font) => {
  // Helper function to create 3D title text
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

  // Create the 3 titles within the office interior.
  // These positions are examples—you may need to adjust them for your layout.
  createText("SOCIALS", 0x00008b, { x: 1, y: 0, z: -1 });
  createText("CHART", 0x00008b, { x: 0, y: 0.5, z: 0.5 });
  createText("INFO", 0x00008b, { x: -1, y: 0, z: -0.5 });

  // ----- 2D Popup DOM Functions -----

  // Compute the 2D screen position from a 3D object (used for INFO popup)
  function getScreenPosition(object, camera) {
    const vector = new THREE.Vector3();
    object.getWorldPosition(vector);
    vector.project(camera);
    const x = ((vector.x + 1) / 2) * window.innerWidth;
    const y = ((1 - vector.y) / 2) * window.innerHeight;
    return { x, y };
  }

  // Create a popup DOM element with content and assign style classes based on title
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

  // Show (or update) the popup DOM element with content and position it appropriately
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
    // Set fixed positions for SOCIALS and CHART; for INFO, use dynamic positioning.
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
    // Trigger the pop-in animation
    popupDom.getBoundingClientRect();
    popupDom.style.transform = "scale(1)";
    popupDom.style.opacity = "1";
  }

  // ----- Animation Loop -----
  function animate() {
    requestAnimationFrame(animate);
    // Make the text always face the camera.
    // biome-ignore lint/complexity/noForEach: <explanation>
        textObjects.forEach((txt) => txt.lookAt(camera.position));
    controls.update();
    // For desktop, use raycasting on mousemove
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
    // For INFO, update dynamic position continuously.
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
