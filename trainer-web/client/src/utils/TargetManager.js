// Target Management System with Object Pooling
import * as THREE from 'three';

export class TargetManager {
  constructor(scene, poolSize = 50) {
    this.scene = scene;
    this.poolSize = poolSize;
    
    // Target pools
    this.targetPool = [];
    this.activeTargets = [];
    
    // Target materials
    this.materials = {
      default: new THREE.MeshStandardMaterial({
        color: 0xff4444,
        emissive: 0xff0000,
        emissiveIntensity: 0.3,
        metalness: 0.5,
        roughness: 0.5
      }),
      hit: new THREE.MeshStandardMaterial({
        color: 0x44ff44,
        emissive: 0x00ff00,
        emissiveIntensity: 0.8,
        metalness: 0.5,
        roughness: 0.5
      })
    };
    
    // Initialize pool
    this.initializePool();
  }
  
  initializePool() {
    for (let i = 0; i < this.poolSize; i++) {
      const target = this.createTarget();
      target.visible = false;
      this.targetPool.push(target);
      this.scene.add(target.mesh);
    }
  }
  
  createTarget() {
    const geometry = new THREE.SphereGeometry(0.5, 32, 32);
    const mesh = new THREE.Mesh(geometry, this.materials.default.clone());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    return {
      mesh,
      position: new THREE.Vector3(),
      size: 1.0,
      spawnTime: 0,
      isActive: false,
      userData: {}
    };
  }
  
  spawnTarget(position, size = 1.0, userData = {}) {
    // Get target from pool
    const target = this.getTarget();
    if (!target) {
      console.warn('Target pool exhausted');
      return null;
    }
    
    // Configure target
    target.position.copy(position);
    target.size = size;
    target.spawnTime = Date.now();
    target.isActive = true;
    target.userData = userData;
    
    // Update mesh
    target.mesh.position.copy(position);
    target.mesh.scale.setScalar(size);
    target.mesh.visible = true;
    target.mesh.material = this.materials.default.clone();
    
    // Add to active targets
    this.activeTargets.push(target);
    
    return target;
  }
  
  despawnTarget(target) {
    if (!target || !target.isActive) return;
    
    // Mark as inactive
    target.isActive = false;
    target.mesh.visible = false;
    
    // Remove from active targets
    const index = this.activeTargets.indexOf(target);
    if (index > -1) {
      this.activeTargets.splice(index, 1);
    }
    
    // Return to pool
    this.returnTarget(target);
  }
  
  getTarget() {
    // Try to get from pool
    if (this.targetPool.length > 0) {
      return this.targetPool.pop();
    }
    
    // Pool exhausted, create new target
    const target = this.createTarget();
    this.scene.add(target.mesh);
    return target;
  }
  
  returnTarget(target) {
    // Reset target properties
    target.position.set(0, 0, 0);
    target.size = 1.0;
    target.spawnTime = 0;
    target.isActive = false;
    target.userData = {};
    target.mesh.visible = false;
    
    // Return to pool
    this.targetPool.push(target);
  }
  
  flashHit(target) {
    if (!target || !target.mesh) return;
    
    // Flash green on hit
    target.mesh.material = this.materials.hit.clone();
    
    setTimeout(() => {
      if (target.isActive) {
        target.mesh.material = this.materials.default.clone();
      }
    }, 100);
  }
  
  clearAllTargets() {
    // Despawn all active targets
    const targets = [...this.activeTargets];
    targets.forEach(target => this.despawnTarget(target));
  }
  
  getActiveTargets() {
    return this.activeTargets.filter(t => t.isActive);
  }
  
  getTargetCount() {
    return this.activeTargets.length;
  }
  
  dispose() {
    // Clean up all targets
    this.clearAllTargets();
    
    // Dispose geometries and materials
    this.targetPool.forEach(target => {
      target.mesh.geometry.dispose();
      target.mesh.material.dispose();
      this.scene.remove(target.mesh);
    });
    
    this.materials.default.dispose();
    this.materials.hit.dispose();
    
    this.targetPool = [];
    this.activeTargets = [];
  }
}
