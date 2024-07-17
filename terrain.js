import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import SimplexNoise from 'https://cdn.jsdelivr.net/npm/simplex-noise@3.0.0/dist/esm/simplex-noise.js';
import { Water } from 'https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/objects/Water2.js';

const noise = new SimplexNoise(Math.random());
let terrainMesh, water, grassGroup;
let sceneRef;

export function createTerrain(scene) {
    sceneRef = scene;
    if (!scene) {
        console.error('Scene is undefined. Terrain cannot be created.');
        return;
    }
    console.log('Creating terrain with scene:', scene);

    const size = 200;
    const segments = 200;
    const geometry = new THREE.PlaneGeometry(size, size, segments - 1, segments - 1);
    geometry.rotateX(-Math.PI / 2);

    // Modify the vertices based on Perlin noise
    const vertices = geometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const z = vertices[i + 2];
        const y = (noise.noise2D(x / 10, z / 10) + 1) / 2; // Normalize noise to [0, 1]
        vertices[i + 1] = y;
    }

    // Add warm ambient lighting from below the terrain
    const warmAmbientLight = new THREE.AmbientLight(0xffaa66, 2); // Warm light
    warmAmbientLight.position.set(0, -50, 0); // Position below the terrain
    scene.add(warmAmbientLight);

    // Apply colors based on height
    const colors = [];
    for (let i = 0; i < vertices.length; i += 3) {
        const y = vertices[i + 1];
        if (y >= 0.4 && y <= 1) {
            colors.push(0.569, 0.502, 0.502); // #E8EBEE
        } else if (y >= 0 && y <= 0.3) {
            colors.push(0.678, 0.725, 0.761); // #ADB9C2
        } else {
            colors.push(0.863, 0.878, 0.894); // #DCE0E5
        }
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.MeshLambertMaterial({
        vertexColors: true,
        transparent: true, // Enable transparency
        opacity: 0.9 // Set default opacity (can be adjusted)
    });
    terrainMesh = new THREE.Mesh(geometry, material);

    // Ensure terrain is added to the scene
    if (terrainMesh instanceof THREE.Object3D) {
        console.log('Adding terrain to scene:', terrainMesh);
        scene.add(terrainMesh);
    } else {
        console.error('Terrain is not an instance of THREE.Object3D');
    }

    // Add water (pond)
    addWater(scene);

    // Add grass
    addGrass(scene);
}


export function getTerrainHeightAt(x, z) {
    if (!terrainMesh) {
        console.error('Terrain mesh is not initialized.');
        return 0;
    }

    const vertices = terrainMesh.geometry.attributes.position.array;
    const size = terrainMesh.geometry.parameters.width;
    const segments = terrainMesh.geometry.parameters.widthSegments;
    const halfSize = size / 2;

    // Find the closest vertex indices
    const ix = Math.floor(((x + halfSize) / size) * (segments - 1));
    const iz = Math.floor(((z + halfSize) / size) * (segments - 1));

    const x1 = ix * size / (segments - 1) - halfSize;
    const x2 = (ix + 1) * size / (segments - 1) - halfSize;
    const z1 = iz * size / (segments - 1) - halfSize;
    const z2 = (iz + 1) * size / (segments - 1) - halfSize;

    const y11 = vertices[(iz * segments + ix) * 3 + 1];
    const y12 = vertices[(iz * segments + (ix + 1)) * 3 + 1];
    const y21 = vertices[((iz + 1) * segments + ix) * 3 + 1];
    const y22 = vertices[((iz + 1) * segments + (ix + 1)) * 3 + 1];

    // Bilinear interpolation
    const t = (x - x1) / (x2 - x1);
    const u = (z - z1) / (z2 - z1);

    const height = (1 - t) * ((1 - u) * y11 + u * y21) + t * ((1 - u) * y12 + u * y22);
    console.log(`Height at (${x}, ${z}): ${height}`);
    return height;
}

function addWater(scene) {
    const size = 50;
    const segments = 50;

    const waterGeometry = new THREE.PlaneGeometry(size, size, segments, segments);
    waterGeometry.rotateX(-Math.PI / 2);

    // Modify the water vertices to match the terrain
    const waterVertices = waterGeometry.attributes.position.array;
    for (let i = 0; i < waterVertices.length; i += 3) {
        const x = waterVertices[i];
        const z = waterVertices[i + 2];
        waterVertices[i + 1] = getTerrainHeightAt(x, z);
    }

    waterGeometry.attributes.position.needsUpdate = true;

    water = new Water(waterGeometry, {
        color: '#8fbcd4', // Change color to a less reflective, more matte appearance
        scale: 1, // Adjust the scale for less intense reflections
        flowDirection: new THREE.Vector2(0.5, 0.5), // Adjust the flow direction for less uniform reflections
        textureWidth: 512,
        textureHeight: 512,
        reflectivity: 0.3, // Further reduce reflectivity
        alpha: 0.9 // Increase transparency
    });

    water.position.y = 0.2; // Adjust position if necessary
    scene.add(water);

    console.log('Water added to scene:', water);
}

function addGrass(scene) {
    grassGroup = new THREE.Group();
    const pondSize = 50; // Size of the pond (same as the water geometry)
    const grassSpacing = 5; // Spacing between grass bunches
    const rowSpacing = 5; // Spacing between rows

    for (let i = -pondSize / 2; i <= pondSize / 2; i += rowSpacing) {
        for (let j = -pondSize / 2; j <= pondSize / 2; j += grassSpacing) {
            const grassBunch = createGrassBunch();
            grassBunch.position.set(i, 0, j);
            grassGroup.add(grassBunch);
        }
    }

    grassGroup.position.y = 1; // Position the grass on top of the pond
    scene.add(grassGroup);
    console.log('Grass added to scene:', grassGroup);
}

export function getGrassBunches() {
    return grassGroup ? grassGroup.children : [];
}

export function removeGrassBunch(bunch) {
    if (grassGroup && bunch) {
        grassGroup.remove(bunch);
    }
}

function createGrassBunch() {
    const grassBunch = new THREE.Group();
    const bunchSize = THREE.MathUtils.randInt(5, 7); // Increased number of blades for a fuller bunch

    for (let i = 0; i < bunchSize; i++) {
        const blade = createGrassBlade();
        blade.position.set(THREE.MathUtils.randFloatSpread(0.5), 0, THREE.MathUtils.randFloatSpread(0.5)); // Tightly bunched at the bottom
        grassBunch.add(blade);
    }

    return grassBunch;
}

function createGrassBlade() {
    const bottomRadius = 0.1;
    const topRadius = 0.01;
    const height = THREE.MathUtils.randFloat(4, 6); // Random height for variation
    const radialSegments = 8;

    // Create a geometry for a grass blade
    const bladeGeometry = new THREE.CylinderGeometry(topRadius, bottomRadius, height, radialSegments);

    // Calculate colors for the gradient
    const color1 = new THREE.Color(0x0b6623); // Dark forest green
    const color2 = new THREE.Color(0x32cd32); // Light lime green

    const numVertices = bladeGeometry.attributes.position.count;
    const colors = [];
    for (let i = 0; i < numVertices; i++) {
        const t = bladeGeometry.attributes.position.getY(i) / height;
        const color = color1.clone().lerp(color2, t); // Create a gradient
        colors.push(color.r, color.g, color.b);
    }

    bladeGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.MeshLambertMaterial({
        vertexColors: true,
        emissive: 0x000000 // Default emissive color
    });

    // Create a mesh for the grass blade
    const blade = new THREE.Mesh(bladeGeometry, material);

    // Apply a slight random rotation to the blade
    blade.rotation.x = THREE.MathUtils.degToRad(THREE.MathUtils.randFloat(-10, 10));
    blade.rotation.z = THREE.MathUtils.degToRad(THREE.MathUtils.randFloat(-10, 10));

    return blade;
}
