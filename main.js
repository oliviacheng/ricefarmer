import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/loaders/GLTFLoader.js';
import { Sky } from 'https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/objects/Sky.js';
import { createTerrain, getTerrainHeightAt } from './terrain.js';

let scene, camera, renderer, player, idleAction, walkAction, mixer, clock;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
const rotationSpeed = 0.02;
const movementSpeed = 0.08;
let direction = new THREE.Vector3();
const objects = [];
let isColliding = false;
let collidingObject = null;
const terrainHalfSize = 100; // Half of the terrain size
let breathingInterval;
let canMove = true;
let sun = new THREE.Vector3();

const breathingTextElement = document.getElementById('breathingText');
const countdownTextElement = document.getElementById('countdownText');
const breatheoutTextElement = document.getElementById('breatheoutText');

init();
animate();

function init() {
    console.log('Initializing scene');

    // Set up document click event to start game
    document.addEventListener('click', startGame);

    // Scene
    scene = new THREE.Scene();
    console.log('Scene initialized:', scene);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.5, 1000);
    camera.position.set(0, 0, 0);
    scene.add(camera);

    // Renderer
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0xffffff); // Set background color to white
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.5;
    document.body.appendChild(renderer.domElement);

    // Initialize and create terrain
    console.log('Creating terrain');
    createTerrain(scene);

    // Initialize clock
    clock = new THREE.Clock();

    // Initialize sky and update the sun position
    initSky();

    // Load player model
    const loader = new GLTFLoader();
    loader.load('/public/poly3d.net - Idle.glb', function(gltf) {
        player = gltf.scene;
        player.position.set(0, -5, 0);
        scene.add(player);

        mixer = new THREE.AnimationMixer(player);
        idleAction = mixer.clipAction(gltf.animations[0]);
        idleAction.play();

        console.log('Idle animation loaded and playing.');

        loader.load('public/poly3d.net - Run Forward.glb', function(gltf) {
            walkAction = mixer.clipAction(gltf.animations[0]);
            walkAction.enabled = false;
            console.log('Walk animation loaded.');
        });

        // Align player to face the sun
        alignPlayerToSun();
    });

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0x404040); // Soft white light
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(100, 100, 100);
    scene.add(directionalLight);

    // Create spinning cube
    const boxGeometry = new THREE.BoxGeometry();
    const boxMaterial = new THREE.MeshLambertMaterial({ color: Math.random() * 0xffffff });
    const box = new THREE.Mesh(boxGeometry, boxMaterial);
    box.position.x = -5;
    box.position.y = 1.5;
    box.position.z = -1;
    scene.add(box);
    objects.push(box);

    // Keyboard controls
    document.addEventListener('keydown', onKeyDown, false);
    document.addEventListener('keyup', onKeyUp, false);

    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);

    // Event listener for Enter key in the input box
    document.getElementById('textInput').addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            submitText();
        }
    });
}

function initSky() {
    // Add Sky
    const sky = new Sky();
    sky.scale.setScalar(1000000);
    scene.add(sky);

    const effectController = {
        turbidity: 10,
        rayleigh: 3,
        mieCoefficient: 0.005,
        mieDirectionalG: 0.7,
        elevation: 2,
        azimuth: 180,
        exposure: renderer.toneMappingExposure
    };

    function updateSky() {
        const uniforms = sky.material.uniforms;
        uniforms['turbidity'].value = effectController.turbidity;
        uniforms['rayleigh'].value = effectController.rayleigh;
        uniforms['mieCoefficient'].value = effectController.mieCoefficient;
        uniforms['mieDirectionalG'].value = effectController.mieDirectionalG;

        const phi = THREE.MathUtils.degToRad(90 - effectController.elevation);
        const theta = THREE.MathUtils.degToRad(effectController.azimuth);

        sun.setFromSphericalCoords(1, phi, theta);

        uniforms['sunPosition'].value.copy(sun);

        renderer.toneMappingExposure = effectController.exposure;
        renderer.render(scene, camera);
    }

    updateSky();
}

function alignPlayerToSun() {
    if (player) {
        const directionToSun = new THREE.Vector3();
        directionToSun.subVectors(sun, player.position).normalize();
        
        // Calculate the angle to rotate the player to face the sun
        const angle = Math.atan2(directionToSun.x, directionToSun.z);
        player.rotation.y = angle;
    }
}

function onKeyDown(event) {
    if (!canMove) return; // Disable movement when the player cannot move

    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = true;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = true;
            break;
    }
    switchAnimation();
}

function onKeyUp(event) {
    if (!canMove) return; // Disable movement when the player cannot move

    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = false;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = false;
            break;
    }
    switchAnimation();
}

function switchAnimation() {
    if (mixer) {
        console.log('Switching animation.');
        if (moveForward || moveBackward || moveLeft || moveRight) {
            if (idleAction && idleAction.isRunning()) {
                console.log('Fading out idle animation.');
                idleAction.fadeOut(0.5);
                idleAction.stop();
            }
            if (walkAction && !walkAction.isRunning()) {
                console.log('Starting walk animation.');
                walkAction.enabled = true;
                walkAction.reset();
                walkAction.fadeIn(0.5);
                walkAction.play();
            }
        } else {
            if (walkAction && walkAction.isRunning()) {
                console.log('Fading out walk animation.');
                walkAction.fadeOut(0.5);
                walkAction.stop();
            }
            if (idleAction && !idleAction.isRunning()) {
                console.log('Starting idle animation.');
                idleAction.reset();
                idleAction.fadeIn(0.5);
                idleAction.play();
            }
        }
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function showInputBox() {
    const inputBox = document.getElementById('textInputBox');
    inputBox.style.display = 'block';
    inputBox.querySelector('input').focus(); // Focus on the input box immediately
}

function hideInputBox() {
    const inputBox = document.getElementById('textInputBox');
    inputBox.style.display = 'none';
}

function displaySubmittedText(text) {
    const textDisplay = document.createElement('div');
    textDisplay.innerText = text;
    textDisplay.className = 'submittedText';
    document.body.appendChild(textDisplay);

    setTimeout(() => {
        textDisplay.remove();
        if (collidingObject) {
            scene.remove(collidingObject);
            objects.splice(objects.indexOf(collidingObject), 1); // Remove from objects array
            collidingObject = null;
            isColliding = false; 
            canMove = true; // Allow movement again
        }
    }, 10000); // Display for 10 seconds
}

function submitText() {
    const inputText = document.getElementById('textInput').value;
    hideInputBox(); // Hide the input box immediately
    console.log("Submitted text: " + inputText);
    displaySubmittedText(inputText);
    startCountUp();
}

function inputBoxVisible() {
    return document.getElementById('textInputBox').style.display === 'block';
}

function checkCollision() {
    const playerBox = new THREE.Box3().setFromObject(player);
    for (let i = 0; i < objects.length; i++) {
        const objectBox = new THREE.Box3().setFromObject(objects[i]);
        if (playerBox.intersectsBox(objectBox)) {
            if (!isColliding && !inputBoxVisible()) {
                isColliding = true;
                collidingObject = objects[i];
                showInputBox();
                canMove = false; // Disable movement when the input box is shown

                // Stop all movement
                moveForward = false;
                moveBackward = false;
                moveLeft = false;
                moveRight = false;
                
                // Switch to idle animation
                switchAnimation();
            }
            return;
        }
    }
}

function startCountUp() {
    // Display text elements
    breathingTextElement.style.display = 'block';
    countdownTextElement.style.display = 'block';
    breatheoutTextElement.style.display = 'none';

    let countup = 0;
    countdownTextElement.innerText = countup;

    breathingInterval = setInterval(() => {
        countup++;
        countdownTextElement.innerText = countup;
        if (countup === 3) { // Adjust the countup limit as needed
            clearInterval(breathingInterval);
            breathingTextElement.style.display = 'none';
            breatheoutTextElement.style.display = 'block';
            setTimeout(startCountDown, 2000);
        }
    }, 1000);
}

function startCountDown() {
    let countdown = 3;
    countdownTextElement.innerText = countdown;
    countdownTextElement.style.display = 'block';

    breathingInterval = setInterval(() => {
        countdown--;
        countdownTextElement.innerText = countdown;
        if (countdown === 0) {
            clearInterval(breathingInterval);
            breatheoutTextElement.style.display = 'none';
            countdownTextElement.style.display = 'none';
            canMove = true; // Allow movement after the exercise
        }
    }, 1000);
}

function startGame() {
    // Hide the start screen
    const startScreen = document.getElementById('startScreen');
    startScreen.style.display = 'none';

    // Remove the event listener to prevent it from firing multiple times
    document.removeEventListener('click', startGame);

    animate();
}

function animate() {
    requestAnimationFrame(animate);

    if (!player) {
        // Wait until the player is loaded before animating
        return;
    }

    const delta = clock.getDelta();

    if (mixer) {
        mixer.update(delta);
    }

    if (canMove) {
        // Calculate the forward and right vectors based on the player's rotation
        const forward = new THREE.Vector3(Math.sin(player.rotation.y), 0, Math.cos(player.rotation.y));
        const right = new THREE.Vector3(Math.cos(player.rotation.y), 0, -Math.sin(player.rotation.y));

        // Calculate the movement direction
        direction.set(0, 0, 0);
        if (moveForward) direction.add(forward);
        if (moveBackward) direction.sub(forward);
        if (moveLeft) direction.sub(right);
        if (moveRight) direction.add(right);

        // Normalize direction vector and apply movement speed
        direction.normalize().multiplyScalar(movementSpeed);

        // Calculate the new position
        const newX = player.position.x + direction.x;
        const newZ = player.position.z + direction.z;

        // Check boundaries and update position
        if (newX >= -terrainHalfSize && newX <= terrainHalfSize) {
            player.position.x = newX;
        }

        if (newZ >= -terrainHalfSize && newZ <= terrainHalfSize) {
            player.position.z = newZ;
        }

        // Rotate the player for turning
        if (moveLeft) {
            player.rotation.y += rotationSpeed;
        }
        if (moveRight) {
            player.rotation.y -= rotationSpeed;
        }

        // Update player position based on terrain height
        const terrainHeight = getTerrainHeightAt(player.position.x, player.position.z);
        player.position.y = terrainHeight + 1; // Adjust to be slightly above the terrain

        // Update camera position relative to player (for first-person view)
        const offset = new THREE.Vector3(0, 1, -5).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.rotation.y);
        camera.position.copy(player.position).add(offset);
        camera.lookAt(player.position.x, player.position.y + 1.6, player.position.z);
    }

    // Check for collisions
    checkCollision();

    // Rotate the cubes
    objects.forEach(obj => {
        obj.rotation.x += 0.01;
        obj.rotation.y += 0.01;
    });

    renderer.render(scene, camera);
}
