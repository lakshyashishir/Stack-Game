import * as THREE from "three";
import CANNON from "cannon";

window.localStorage;

window.focus();
let camera,
  scene,
  renderer,
  world,
  lastTime,
  stack,
  overhangs,
  autopilot,
  gameEnded,
  multiplayer = false,
  highscore,
  mySound,
  bgSound;
const boxHeight = 1;
const originalBoxSize = 3;

const scoreElement = document.getElementById("score");
const instructionsElement = document.getElementById("instructions");
const resultsElement = document.getElementById("results");
const modeElement = document.getElementById("mode");
const playerElement = document.getElementById("players");
const highscoreElement = document.getElementById("highscore");

init();

function init() {
  autopilot = true;
  gameEnded = false;
  lastTime = 0;
  stack = [];
  overhangs = [];

  if (window.localStorage.getItem("highscore") == null) {
    window.localStorage.setItem("highscore", 0);
  }

  highscore = window.localStorage.getItem("highscore");
  highscoreElement.innerText = "Highscore : " + highscore;

  world = new CANNON.World();
  world.gravity.set(0, -10, 0);
  world.broadphase = new CANNON.NaiveBroadphase();
  world.solver.iterations = 10;

  const aspect = window.innerWidth / window.innerHeight;
  const width = 12;
  const height = width / aspect;

  camera = new THREE.OrthographicCamera(
    width / -2,
    width / 2,
    height / 2,
    height / -2,
    0,
    100
  );

  camera.position.set(4, 4, 4);
  camera.lookAt(0, 0, 0);

  scene = new THREE.Scene();

  addLayer(0, 0, originalBoxSize, originalBoxSize);

  addLayer(-10, 0, originalBoxSize, originalBoxSize, "x");

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  scene.background = new THREE.Color(0x22a7f0);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
  directionalLight.position.set(10, 20, 0);
  scene.add(directionalLight);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animation);
  document.body.appendChild(renderer.domElement);
}

class sound {
  constructor(src) {
    this.sound = document.createElement("audio");
    this.sound.src = src;
    this.sound.setAttribute("preload", "auto");
    this.sound.setAttribute("controls", "none");
    this.sound.style.display = "none";
    this.sound.volume = 0.5;
    document.body.appendChild(this.sound);
    this.loop = function () {
      this.sound.loop = true;
    };
    this.play = function () {
      this.sound.play();
    };
    this.stop = function () {
      this.sound.pause();
    };
  }
}

function startGame() {
  autopilot = false;
  gameEnded = false;
  lastTime = 0;
  stack = [];
  overhangs = [];

  bgSound = new sound("./assets/play.wav");
  bgSound.play();
  bgSound.loop();

  if (multiplayer) {
    modeElement.innerText = "• Multiplayer";
    playerElement.style.display = "block";
    highscoreElement.style.display = "none";
  } else {
    modeElement.innerText = "• Single Player";
    highscoreElement.style.display = "block";
  }

  if (instructionsElement) instructionsElement.style.display = "none";
  if (resultsElement) resultsElement.style.display = "none";
  if (scoreElement) scoreElement.innerText = 0;

  if (world) {
    while (world.bodies.length > 0) {
      world.remove(world.bodies[0]);
    }
  }

  if (scene) {
    while (scene.children.find((c) => c.type == "Mesh")) {
      const mesh = scene.children.find((c) => c.type == "Mesh");
      scene.remove(mesh);
    }

    addLayer(0, 0, originalBoxSize, originalBoxSize);

    addLayer(-10, 0, originalBoxSize, originalBoxSize, "x");
  }

  if (camera) {
    camera.position.set(4, 4, 4);
    camera.lookAt(0, 0, 0);
  }
}

function addLayer(x, z, width, depth, direction) {
  const y = boxHeight * stack.length;
  const layer = generateBox(x, y, z, width, depth, false);
  layer.direction = direction;
  stack.push(layer);
}

function addOverhang(x, z, width, depth) {
  const y = boxHeight * (stack.length - 1);
  const overhang = generateBox(x, y, z, width, depth, true);
  overhangs.push(overhang);
}

function generateBox(x, y, z, width, depth, falls) {
  let color;
  if (multiplayer) {
    if (stack.length % 2 == 0) {
      color = new THREE.Color(`rgb(${100 + stack.length * 10}, 90, 200)`);
    }
  } else {
    color = new THREE.Color("rgb0,0,0)");
  }
  const geometry = new THREE.BoxGeometry(width, boxHeight, depth);
  const material = new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  scene.add(mesh);

  const shape = new CANNON.Box(
    new CANNON.Vec3(width / 2, boxHeight / 2, depth / 2)
  );
  let mass = falls ? 5 : 0;
  mass *= width / originalBoxSize;
  mass *= depth / originalBoxSize;
  const body = new CANNON.Body({ mass, shape });
  body.position.set(x, y, z);
  world.addBody(body);

  return {
    threejs: mesh,
    cannonjs: body,
    width,
    depth,
  };
}

function cutBox(topLayer, overlap, size, delta) {
  const direction = topLayer.direction;
  const newWidth = direction == "x" ? overlap : topLayer.width;
  const newDepth = direction == "z" ? overlap : topLayer.depth;

  topLayer.width = newWidth;
  topLayer.depth = newDepth;

  topLayer.threejs.scale[direction] = overlap / size;
  topLayer.threejs.position[direction] -= delta / 2;

  topLayer.cannonjs.position[direction] -= delta / 2;

  const shape = new CANNON.Box(
    new CANNON.Vec3(newWidth / 2, boxHeight / 2, newDepth / 2)
  );
  topLayer.cannonjs.shapes = [];
  topLayer.cannonjs.addShape(shape);
}

window.addEventListener("mousedown", eventHandler);
window.addEventListener("touchstart", eventHandler);
window.addEventListener("keydown", function (event) {
  if (event.key == "S" || event.key == "s") {
    event.preventDefault();
    scoreElement.style.display = "block";
    multiplayer = false;
    bgSound.stop();
    startGame();
    return;
  } else if (event.key == "R" || event.key == "r") {
    event.preventDefault();
    bgSound.stop();
    startGame();
    return;
  } else if (event.key == "M" || event.key == "m") {
    scoreElement.style.display = "none";
    multiplayer = true;
    bgSound.stop();
    startGame();
    return;
  } else if (event.key == " ") {
    event.preventDefault();
    eventHandler();
    return;
  }
});

restartButton.addEventListener("click", function () {
  startGame();
  return;
});

function eventHandler() {
  mySound = new sound("./assets/touch.wav");
  mySound.play();
  if (autopilot) startGame();
  else splitBlockAndAddNextOneIfOverlaps();
}

function splitBlockAndAddNextOneIfOverlaps() {
  if (gameEnded) return;

  const topLayer = stack[stack.length - 1];
  const previousLayer = stack[stack.length - 2];

  const direction = topLayer.direction;

  const size = direction == "x" ? topLayer.width : topLayer.depth;
  const delta =
    topLayer.threejs.position[direction] -
    previousLayer.threejs.position[direction];
  const overhangSize = Math.abs(delta);
  const overlap = size - overhangSize;

  if (overlap > 0) {
    cutBox(topLayer, overlap, size, delta);

    const overhangShift = (overlap / 2 + overhangSize / 2) * Math.sign(delta);
    const overhangX =
      direction == "x"
        ? topLayer.threejs.position.x + overhangShift
        : topLayer.threejs.position.x;
    const overhangZ =
      direction == "z"
        ? topLayer.threejs.position.z + overhangShift
        : topLayer.threejs.position.z;
    const overhangWidth = direction == "x" ? overhangSize : topLayer.width;
    const overhangDepth = direction == "z" ? overhangSize : topLayer.depth;

    addOverhang(overhangX, overhangZ, overhangWidth, overhangDepth);

    const nextX = direction == "x" ? topLayer.threejs.position.x : -10;
    const nextZ = direction == "z" ? topLayer.threejs.position.z : -10;
    const newWidth = topLayer.width;
    const newDepth = topLayer.depth;
    const nextDirection = direction == "x" ? "z" : "x";

    if (scoreElement) scoreElement.innerText = stack.length - 1;
    addLayer(nextX, nextZ, newWidth, newDepth, nextDirection);
  } else {
    missedTheSpot();
  }
}

function missedTheSpot() {
  const topLayer = stack[stack.length - 1];

  addOverhang(
    topLayer.threejs.position.x,
    topLayer.threejs.position.z,
    topLayer.width,
    topLayer.depth
  );
  world.remove(topLayer.cannonjs);
  scene.remove(topLayer.threejs);

  gameEnded = true;
  bgSound.stop();
  if (resultsElement && !autopilot) resultsElement.style.display = "flex";
  if (multiplayer) {
    if (resultsElement) resultsElement.style.display = "flex";
    if (scoreElement) scoreElement.style.display = "none";
    mySound = new sound("./assets/win.wav");
    mySound.play();
    resultsElement.style.fontSize = "10em";
    if (stack.length % 2 == 0) {
      resultsElement.innerText = "Player 2 wins!";
    } else {
      resultsElement.innerText = "Player 1 wins!";
    }
  } else if (!multiplayer) {
    resultsElement.innerText =
      "Game Over!" +
      "\n" +
      "Your score is " +
      (stack.length - 2) +
      "\n" +
      "Press R to restart";
    if (stack.length > highscore) {
      localStorage.setItem("highscore", stack.length);
      console.log(localStorage.getItem("highscore"));
      highscore = stack.length - 2;
      highscoreElement.innerText = "Highscore : " + highscore;
    }
  }
}

function animation(time) {
  if (lastTime) {
    const timePassed = time - lastTime;
    const speed = 0.008;

    const topLayer = stack[stack.length - 1];

    const boxShouldMove = !gameEnded;

    if (boxShouldMove) {
      topLayer.threejs.position[topLayer.direction] += speed * timePassed;
      topLayer.cannonjs.position[topLayer.direction] += speed * timePassed;

      if (topLayer.threejs.position[topLayer.direction] > 10) {
        missedTheSpot();
      }
    } else {
    }

    if (camera.position.y < boxHeight * (stack.length - 2) + 4) {
      camera.position.y += speed * timePassed;
    }

    updatePhysics(timePassed);
    renderer.render(scene, camera);
  }
  lastTime = time;
}

function updatePhysics(timePassed) {
  world.step(timePassed / 1000);

  overhangs.forEach((element) => {
    element.threejs.position.copy(element.cannonjs.position);
    element.threejs.quaternion.copy(element.cannonjs.quaternion);
  });
}

window.addEventListener("resize", () => {
  console.log("resize", window.innerWidth, window.innerHeight);
  const aspect = window.innerWidth / window.innerHeight;
  const width = 10;
  const height = width / aspect;

  camera.top = height / 2;
  camera.bottom = height / -2;

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.render(scene, camera);
});
