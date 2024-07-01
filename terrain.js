import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import SimplexNoise from 'https://cdn.jsdelivr.net/npm/simplex-noise@3.0.0/dist/esm/simplex-noise.js';

const noise = new SimplexNoise(Math.random());
let terrainMesh;

export function createTerrain(scene) {
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

    // Apply colors based on height
    const colors = [];
    for (let i = 0; i < vertices.length; i += 3) {
        const y = vertices[i + 1];
        if (y >= 0.4 && y <= 1) {
            colors.push(0.909, 0.921, 0.933); // #E8EBEE
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
        opacity: 0.1 // Set default opacity (can be adjusted)
     });
    terrainMesh = new THREE.Mesh(geometry, material);
    
    // Ensure terrain is added to the scene
    if (terrainMesh instanceof THREE.Object3D) {
        console.log('Adding terrain to scene:', terrainMesh);
        scene.add(terrainMesh);
    } else {
        console.error('Terrain is not an instance of THREE.Object3D');
    }
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
