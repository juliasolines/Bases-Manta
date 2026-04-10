import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// 1. Setup Scene & Coastal Fog
const scene = new THREE.Scene();
const fogColor = new THREE.Color(0xd7f5f2); 
scene.background = fogColor;
scene.fog = new THREE.FogExp2(fogColor, 0.003); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
}
document.body.appendChild(renderer.domElement);

// --- LIGHTING ---
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
hemiLight.position.set(0, 200, 0);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
dirLight.position.set(100, 100, 50);
scene.add(dirLight);

// --- AUDIO SETUP ---
const listener = new THREE.AudioListener();
camera.add(listener);
const audioLoader = new THREE.AudioLoader();

const windSound = new THREE.Audio(listener);
audioLoader.load(
    'wind.mp3', 
    function(buffer) {
        windSound.setBuffer(buffer);
        windSound.setLoop(true);
        windSound.setVolume(0.3);
        windSound.play(); // THE FIX: Queue play immediately upon loading
    },
    undefined,
    function(err) { console.error("ERROR: Could not find 'wind.mp3'"); }
);

// 2. Terrain Generation
function getTerrainHeight(x, z) {
    return Math.sin(x * 0.02) * 4 + 
           Math.cos(z * 0.02) * 4 + 
           Math.sin(x * 0.05 + z * 0.05) * 2;
}

function createSandTexture() {
    const size = 256; 
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;

    const c1 = new THREE.Color('#e1c577'); 
    const c2 = new THREE.Color('#e1c577'); 
    const c3 = new THREE.Color('#e1c577'); 

    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            let splotchNoise = Math.sin(x * 0.05) + Math.cos(y * 0.05) + Math.sin((x + y) * 0.03);
            
            let finalColor;
            if (splotchNoise < -0.5) {
                finalColor = c2; 
            } else if (splotchNoise > 0.5) {
                finalColor = c3; 
            } else {
                finalColor = c1; 
            }

            const grainAmount = 0.12; 
            const grain = (Math.random() - 0.5) * grainAmount; 

            const i = (x + y * size) * 4;
            data[i]     = Math.max(0, Math.min(1, finalColor.r + grain)) * 255;
            data[i + 1] = Math.max(0, Math.min(1, finalColor.g + grain)) * 255;
            data[i + 2] = Math.max(0, Math.min(1, finalColor.b + grain)) * 255;
            data[i + 3] = 255; 
        }
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(40, 40); 
    return texture;
}

const terrainSize = 1000;
const terrainGeometry = new THREE.PlaneGeometry(terrainSize, terrainSize, 150, 150);

const terrainMaterial = new THREE.MeshLambertMaterial({ 
    map: createSandTexture(), 
    side: THREE.DoubleSide 
}); 

const vertices = terrainGeometry.attributes.position.array;
for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i];
    const y = vertices[i + 1]; 
    vertices[i + 2] = getTerrainHeight(x, -y); 
}
terrainGeometry.computeVertexNormals();

const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
terrain.rotation.x = -Math.PI / 2; 
scene.add(terrain);

// 3. Scatter Flora & Elements
const textureLoader = new THREE.TextureLoader();
const allPlants = []; // NEW: A master list of every piece of flora

function scatterElements(imageFile, totalAmount, minScale, maxScale, yOffset = 0, flex = 0.05) {
    textureLoader.load(
        imageFile, 
        (texture) => {
            const material = new THREE.MeshLambertMaterial({ 
                map: texture, 
                transparent: true, 
                side: THREE.DoubleSide,
                alphaTest: 0.5 
            });
            
            for (let i = 0; i < totalAmount; i++) {
                const planeGeo = new THREE.PlaneGeometry(15, 15);
                planeGeo.translate(0, 7.5, 0); 
                
                const objGroup = new THREE.Group();
                const plane1 = new THREE.Mesh(planeGeo, material);
                const plane2 = new THREE.Mesh(planeGeo, material);
                plane2.rotation.y = Math.PI / 2;
                
                objGroup.add(plane1);
                objGroup.add(plane2);

                const x = (Math.random() - 0.5) * 800;
                const z = (Math.random() - 0.5) * 800;
                
                if (Math.abs(x) < 180 && Math.abs(z) < 180) continue;

                const scale = minScale + Math.random() * (maxScale - minScale);
                const y = getTerrainHeight(x, z) + yOffset; 
                
                objGroup.position.set(x, y, z);
                objGroup.scale.set(scale, scale, scale);
                
                objGroup.userData = {
                    isPlant: true,
                    windPhase: Math.random() * Math.PI * 2, 
                    baseRotX: (Math.random() - 0.5) * 0.2,
                    baseRotZ: (Math.random() - 0.5) * 0.2,
                    flexibility: flex 
                };

                scene.add(objGroup);
                allPlants.push(objGroup); // THE FIX: Catalog the plant for the drones to target
            }
        },
        undefined,
        (err) => { console.error(`❌ ERROR: Could not find '${imageFile}'`); }
    );
}

scatterElements('mangrove.png', 400, 2.0, 3.0, -2, 0.02);
scatterElements('cactus1.png', 200, 1.0, 1.8, -4, 0.01); 
scatterElements('cactus2.png', 150, 0.8, 1.3, -3, 0.01);
scatterElements('grass.png', 600, 0.5, 1.0, -1, 0.15);


// 4. The Impenetrable Military Bases & The Drone Hive
const bases = []; 
const allDrones = []; 

function createSignTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#635b5bff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#cccccc'; 
    ctx.font = 'bold 50px "Courier New", Courier, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("", canvas.width / 2, canvas.height / 2 - 5);

    return new THREE.CanvasTexture(canvas);
}
const signTexture = createSignTexture();

const droneGeo = new THREE.ConeGeometry(1, 3, 4); 
droneGeo.rotateX(Math.PI / 2); 
const droneMat = new THREE.MeshBasicMaterial({ color: 0x050505 }); 

function spawnDroneSwarm(baseX, baseY, baseZ) {
    for(let i = 0; i < 40; i++) { 
        const drone = new THREE.Mesh(droneGeo, droneMat);
        drone.position.set(baseX, baseY, baseZ);
        
        const patrolX = baseX + (Math.random() - 0.5) * 600;
        const patrolZ = baseZ + (Math.random() - 0.5) * 600;
        const patrolY = baseY + Math.random() * 80 + 30;

        drone.userData = {
            towerPos: new THREE.Vector3(baseX, baseY, baseZ),
            patrolTarget: new THREE.Vector3(patrolX, patrolY, patrolZ),
            jitter: Math.random() * Math.PI * 2, 
            speed: 60 + Math.random() * 40,
            
            // --- NEW: Lethal Strike Variables ---
            isRogue: false,      // Has this drone been assigned a target this cycle?
            targetPlant: null,   // The specific plant it is going to destroy
            hasAttacked: false   // Has the strike been completed?
        };
        
        drone.visible = false; 
        scene.add(drone);
        allDrones.push(drone);
    }
}

function createMilitaryBase(x, z, width, depth, height, audioFile) {
    textureLoader.load(
        'concrete.jpg', 
        (baseTexture) => {
            baseTexture.wrapS = THREE.RepeatWrapping;
            baseTexture.wrapT = THREE.RepeatWrapping;
            baseTexture.repeat.set(width / 10, height / 10);

            const baseMaterial = new THREE.MeshLambertMaterial({ map: baseTexture });
            const baseGeometry = new THREE.BoxGeometry(width, height, depth);
            const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
            
            const halfW = width / 2;
            const halfD = depth / 2;
            
            const centerH = getTerrainHeight(x, z);
            const corner1 = getTerrainHeight(x - halfW, z - halfD);
            const corner2 = getTerrainHeight(x + halfW, z - halfD);
            const corner3 = getTerrainHeight(x - halfW, z + halfD);
            const corner4 = getTerrainHeight(x + halfW, z + halfD);
            
            const lowestTerrainPoint = Math.min(centerH, corner1, corner2, corner3, corner4);
            const y = lowestTerrainPoint + (height / 2) - 2; 
            
            baseMesh.position.set(x, y, z);
            scene.add(baseMesh);

            const towerWidth = width * 0.25;
            const towerHeight = height * 0.3; 
            const towerGeo = new THREE.BoxGeometry(towerWidth, towerHeight, towerWidth);
            const towerMesh = new THREE.Mesh(towerGeo, baseMaterial);
            towerMesh.position.set(0, (height / 2) + (towerHeight / 2), 0);
            baseMesh.add(towerMesh); 

            const signGeo = new THREE.PlaneGeometry(width * 0.8, 10);
            const signMat = new THREE.MeshLambertMaterial({ map: signTexture });
            
            const signFront = new THREE.Mesh(signGeo, signMat);
            signFront.position.set(0, height * 0.35, (depth / 2) + 0.5); 
            baseMesh.add(signFront);

            const signBack = new THREE.Mesh(signGeo, signMat);
            signBack.rotation.y = Math.PI; 
            signBack.position.set(0, height * 0.35, -(depth / 2) - 0.5); 
            baseMesh.add(signBack);

            const fenceW = width + 40; 
            const fenceD = depth + 40;
            const fenceH = 15; 
            
            const fenceGeo = new THREE.BoxGeometry(fenceW, fenceH, fenceD, 30, 4, 30);
            const fenceMat = new THREE.MeshBasicMaterial({ 
                color: 0x111111, 
                wireframe: true, 
                transparent: true, 
                opacity: 0.5 
            });
            const fenceMesh = new THREE.Mesh(fenceGeo, fenceMat);
            fenceMesh.position.set(0, (-height / 2) + (fenceH / 2) + 5, 0); 
            baseMesh.add(fenceMesh);

            const sound = new THREE.PositionalAudio(listener);
            audioLoader.load(
                audioFile, 
                function(buffer) {
                    sound.setBuffer(buffer);
                    
                    // --- THE FIX: Linear Falloff Math ---
                    sound.setDistanceModel('linear'); // Forces the sound to drop to exactly 0
                    sound.setRefDistance(70);  // The volume stays at max until you are 70 units away
                    sound.setMaxDistance(300); // The sound drops to absolute silence at 400 units away
                    sound.setRolloffFactor(1); // Standard smooth fade
                    
                    sound.setLoop(true);
                    sound.setVolume(2.0);
                    sound.play(); 
                },
                undefined,
                function(err) { console.error(`❌ ERROR: Could not find '${audioFile}'`); }
            );
            baseMesh.add(sound);

            const towerTopY = y + (height / 2) + towerHeight;
            spawnDroneSwarm(x, towerTopY, z);

            bases.push({
                minX: x - (fenceW / 2) - 2,
                maxX: x + (fenceW / 2) + 2,
                minZ: z - (fenceD / 2) - 2,
                maxZ: z + (fenceD / 2) + 2
            });
        },
        undefined,
        (err) => { console.error("❌ ERROR: Could not find 'concrete.jpg'"); }
    );
}

createMilitaryBase(-80, -50, 120, 90, 45, 'base_drone.mp3'); 
createMilitaryBase(90, 60, 50, 140, 140, 'base_drone.mp3'); 

// 5. Controls & Setup
const controls = new PointerLockControls(camera, document.body);

let titleScreen = document.getElementById('title-screen');
if (!titleScreen) {
    titleScreen = document.createElement('div');
    titleScreen.id = 'title-screen';
    document.body.appendChild(titleScreen); 
}

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const playerSpeed = 60.0;
const playerHeight = 4.0; 

if (titleScreen) {
    titleScreen.addEventListener('click', () => {
        titleScreen.classList.add('hidden');
        
        // THE FIX: The browser natively handles suspended context.
        // Resuming the context here will automatically play any sounds that have
        // '.play()' queued (which we added to the loader).
        if (listener.context.state === 'suspended') {
            listener.context.resume();
        }
        
        setTimeout(() => { controls.lock(); }, 100);
    });
}

document.addEventListener('click', () => {
    if (titleScreen && titleScreen.classList.contains('hidden')) {
        controls.lock();
    }
});

const onKeyDown = function (event) {
    switch (event.code) {
        case 'KeyW': moveForward = true; break;
        case 'KeyA': moveLeft = true; break;
        case 'KeyS': moveBackward = true; break;
        case 'KeyD': moveRight = true; break;
    }
};
const onKeyUp = function (event) {
    switch (event.code) {
        case 'KeyW': moveForward = false; break;
        case 'KeyA': moveLeft = false; break;
        case 'KeyS': moveBackward = false; break;
        case 'KeyD': moveRight = false; break;
    }
};
document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

camera.position.set(0, 20, 250);

// 6. Animation Loop & Physics
const clock = new THREE.Clock();

function checkBaseCollision(newX, newZ) {
    for (let i = 0; i < bases.length; i++) {
        const b = bases[i];
        if (newX > b.minX && newX < b.maxX && newZ > b.minZ && newZ < b.maxZ) {
            return true; 
        }
    }
    return false; 
}

let previousCycle = 0; // Tracks the passage of time to detect new drone deployments

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta(); 
    const elapsedTime = clock.getElapsedTime();

    scene.traverse((object) => {
        if (object.userData && object.userData.isPlant) {
            const windForce = Math.sin(elapsedTime * 2.5 + object.userData.windPhase);
            object.rotation.x = object.userData.baseRotX + (windForce * object.userData.flexibility);
            object.rotation.z = object.userData.baseRotZ + (windForce * object.userData.flexibility * 0.5); 
        }
    });

// --- THE HIVE MIND LOGIC ---
    const swarmCycle = elapsedTime % 40;

    // DETECT NEW CYCLE
    if (swarmCycle < previousCycle) {
        
        allDrones.forEach(d => {
            if (d.userData.isStalker) return; // Stalkers ignore the recall order

            d.userData.isRogue = false;
            d.userData.targetPlant = null;
            d.userData.hasAttacked = false;
            
            d.position.copy(d.userData.towerPos);
            
            d.userData.patrolTarget.set(
                d.userData.towerPos.x + (Math.random() - 0.5) * 600,
                d.userData.towerPos.y + Math.random() * 80 + 30,
                d.userData.towerPos.z + (Math.random() - 0.5) * 600
            );
        });

        const availableDrones = allDrones.filter(d => !d.userData.isStalker);

        if (availableDrones.length > 0) {
            const newStalker = availableDrones[Math.floor(Math.random() * availableDrones.length)];
            newStalker.userData.isStalker = true;
            newStalker.userData.isRogue = false; 
        }

        const numRogues = Math.floor(Math.random() * 4) + 2;
        for (let i = 0; i < numRogues; i++) {
            const dronePool = allDrones.filter(d => !d.userData.isStalker);
            const randomDrone = dronePool[Math.floor(Math.random() * dronePool.length)];
            
            const livingPlants = allPlants.filter(p => p.visible);
            
            if (livingPlants.length > 0 && randomDrone) {
                const targetPlant = livingPlants[Math.floor(Math.random() * livingPlants.length)];
                randomDrone.userData.isRogue = true;
                randomDrone.userData.targetPlant = targetPlant;
            }
        }
    }
    previousCycle = swarmCycle; 

    // MOVE THE SWARM
    allDrones.forEach(drone => {
        const data = drone.userData;
        let target = new THREE.Vector3();

        // BEHAVIOR BRANCHING
        if (data.isStalker) {
            // --- THE SURVEILLANCE STALKER (HIGH, SLOW, OMINOUS) ---
            drone.visible = true; 
            
            target.copy(camera.position);
            // Push them WAY up into the fog (150 units high)
            target.y += 150; 
            
            // Wide, incredibly slow tracking circles
            target.x += Math.sin(elapsedTime * 0.2 + data.jitter) * 80;
            target.z += Math.cos(elapsedTime * 0.2 + data.jitter) * 80;

            // Give them a slow, relentless cruising speed
            data.speed = 25; 
            
        } else if (swarmCycle < 10) {
            // --- THE NORMAL SWARM (PHASE 1: ATTACK & PATROL) ---
            drone.visible = true; 

            if (data.isRogue && data.targetPlant && !data.hasAttacked) {
                target.copy(data.targetPlant.position);
                
                // Slower, more deliberate targeting (removed the aggressive twitch)
                target.x += Math.sin(elapsedTime * 3) * 2;
                target.z += Math.cos(elapsedTime * 3) * 2;

                const distToPlant = drone.position.distanceTo(data.targetPlant.position);
                if (distToPlant < 5) {
                    data.targetPlant.visible = false; 
                    data.hasAttacked = true; 
                }
            } else {
                target.copy(data.patrolTarget);
                // Sweeping, smooth patrol curves
                target.x += Math.sin(elapsedTime * 0.5 + data.jitter) * 150;
                target.y += Math.cos(elapsedTime * 0.8 + data.jitter) * 30;
                target.z += Math.sin(elapsedTime * 0.6 + data.jitter) * 150;
            }
        } else {
            // --- THE NORMAL SWARM (PHASE 2: RETURN TO TOWER) ---
            target.copy(data.towerPos);
            // Smooth, spiraling descent into the tower
            target.x += Math.sin(elapsedTime * 2 + data.jitter) * 10;
            target.z += Math.cos(elapsedTime * 2 + data.jitter) * 10;
        }

        const directionToTarget = new THREE.Vector3().subVectors(target, drone.position);
        const distance = directionToTarget.length();

        if (!data.isStalker && swarmCycle >= 10 && distance < 15) {
            drone.visible = false; 
        } else if (drone.visible) {
            
            directionToTarget.normalize();
            
            // --- THE FIX: BUTTERY SMOOTH GIMBAL GLIDE ---
            // Removed all the high-frequency vibration. Replaced with a tiny, slow bob.
            directionToTarget.y += Math.cos(elapsedTime * 1.5 + data.jitter) * 0.02;
            directionToTarget.normalize();

            // Slerp creates the cinematic, stabilized drone rotation
            const targetRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), directionToTarget);
            drone.quaternion.slerp(targetRotation, 3 * delta); 

            drone.position.add(directionToTarget.multiplyScalar(data.speed * delta));
        }
    });
    // ---------------------------

    if (controls.isLocked === true) {
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        if (moveForward || moveBackward) velocity.z -= direction.z * playerSpeed * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * playerSpeed * delta;

        velocity.x -= velocity.x * 10.0 * delta; 
        velocity.z -= velocity.z * 10.0 * delta;

        const right = new THREE.Vector3();
        right.setFromMatrixColumn(camera.matrix, 0);
        right.y = 0;
        right.normalize();

        const forward = new THREE.Vector3();
        forward.crossVectors(camera.up, right);
        forward.y = 0;
        forward.normalize();

        const distRight = -velocity.x * delta;
        const distForward = -velocity.z * delta;

        const targetX = camera.position.x + (right.x * distRight) + (forward.x * distForward);
        const targetZ = camera.position.z + (right.z * distRight) + (forward.z * distForward);

        if (!checkBaseCollision(targetX, camera.position.z)) {
            camera.position.x = targetX;
        }
        if (!checkBaseCollision(camera.position.x, targetZ)) {
            camera.position.z = targetZ;
        }

        const currentTerrainHeight = getTerrainHeight(camera.position.x, camera.position.z);
        camera.position.y += (currentTerrainHeight + playerHeight - camera.position.y) * 0.1;
    }

    renderer.render(scene, camera);
}
animate();