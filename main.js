import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

// ----- Scene Setup -----
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(2, 2, 2);
// Removed fixed rotation for free movement

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
let popupDom = null; // For DOM-based popups (SOCIALS & CHART)
let infoPopup3D = null; // For 3D INFO popup as a plane

let modelBox = null; // Bounding box for the office model
let officeModel = null; // Global office model reference

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

    // Update bounding box after centering:
    modelBox = new THREE.Box3().setFromObject(officeModel);
    // Expand the bounding box to give the camera more freedom (increase by 1 unit in all directions)
    modelBox.expandByScalar(1000000);

    const minDimension = Math.min(size.x, size.y, size.z);
    controls.maxDistance = minDimension * 10.3;
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
        modelLight.position.set(3, 4.1, 0.4); // Adjust as needed
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
let loadedFont = null;
const fontLoader = new FontLoader();
fontLoader.load("/assets/helvetiker_regular.typeface.json", (font) => {
  loadedFont = font;
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
  createText("CHART", 0x00008b, { x: 3, y: -2.8, z: 0.5 });
  createText("INFO", 0x00008b, { x: -1, y: -1, z: 2 });

  // ----- 2D Popup DOM Functions for SOCIALS and CHART -----
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
    } else if (title === "CHART") {
      div.classList.add("popup-chart");
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
      }
      currentPopupTitle = title;
    }
    // Set fixed positions for SOCIALS and CHART; dynamic for others.
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

  // ----- 3D INFO Popup as a Plane -----
  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(" ");
    let line = "";
    for (let n = 0; n < words.length; n++) {
      // biome-ignore lint/style/useTemplate: <explanation>
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, y);
        // biome-ignore lint/style/useTemplate: <explanation>
        line = words[n] + " ";
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, y);
  }

  function createInfoPopup3D() {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    // Draw background
    context.fillStyle = "rgba(34,34,34,0.9)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    // Draw text
    context.fillStyle = "#fff";
    context.font = "20px sans-serif";
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
    // Rotate the plane 180° around the Y-axis
    plane.rotation.y = Math.PI;
    return plane;
  }

  function showInfoPopup3D(object) {
    if (!infoPopup3D) {
      infoPopup3D = createInfoPopup3D();
      scene.add(infoPopup3D);
    }
    // Position the 3D INFO popup near the INFO title's world position.
    const pos = new THREE.Vector3();
    object.getWorldPosition(pos);
    infoPopup3D.position.copy(pos);
    infoPopup3D.position.y += 0.5; // Adjust vertical offset as needed
  }

  // ----- Animation Loop -----
  let lastTime = performance.now();
  function animate() {
    requestAnimationFrame(animate);
    // WASD movement update using world-space relative to camera's orientation:
    const currentTime = performance.now();
    const delta = (currentTime - lastTime) / 1000; // seconds
    lastTime = currentTime;
    const speed = 4; // Increased speed for more freedom

    // Calculate forward and right vectors based on camera direction.
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; // remove vertical component for horizontal movement
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

    // Clamp camera position within the office model's bounding box.
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

    // biome-ignore lint/complexity/noForEach: <explanation>
    textObjects.forEach((txt) => txt.lookAt(camera.position));
    controls.update();

    // Raycaster for title detection (for desktop)
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
        } else {
          if (infoPopup3D) {
            scene.remove(infoPopup3D);
            infoPopup3D = null;
          }
          showPopup(intersected.name, screenPos);
        }
      }
    }
    // For INFO, update its 3D popup position continuously.
    if (infoPopup3D && hoveredObject && hoveredObject.name === "INFO") {
      const pos = new THREE.Vector3();
      hoveredObject.getWorldPosition(pos);
      infoPopup3D.position.copy(pos);
      infoPopup3D.position.y += 0.5;
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
