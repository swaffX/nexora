// Hit Detection System using Raycasting
import * as THREE from 'three';

export class HitDetector {
  constructor(camera) {
    this.camera = camera;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(0, 0); // Always center (crosshair position)
    
    // Performance optimization
    this.raycaster.params.Points.threshold = 0.1;
  }
  
  /**
   * Check if click hits any target
   * @param {Array} targets - Array of target objects
   * @returns {Object|null} Hit target or null
   */
  checkHit(targets) {
    if (!targets || targets.length === 0) return null;
    
    // Set raycaster from camera center (where crosshair is)
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Get target meshes
    const meshes = targets
      .filter(t => t.isActive && t.mesh.visible)
      .map(t => t.mesh);
    
    if (meshes.length === 0) return null;
    
    // Check intersections
    const intersects = this.raycaster.intersectObjects(meshes, false);
    
    if (intersects.length > 0) {
      // Find the target object from the mesh
      const hitMesh = intersects[0].object;
      const hitTarget = targets.find(t => t.mesh === hitMesh);
      
      if (hitTarget) {
        return {
          target: hitTarget,
          point: intersects[0].point,
          distance: intersects[0].distance,
          face: intersects[0].face
        };
      }
    }
    
    return null;
  }
  
  /**
   * Check if a specific target is hit
   * @param {Object} target - Target object
   * @returns {boolean} True if hit
   */
  isTargetHit(target) {
    if (!target || !target.isActive || !target.mesh.visible) return false;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(target.mesh, false);
    
    return intersects.length > 0;
  }
  
  /**
   * Check if crosshair is currently on target (for tracking)
   * @param {Object} target - Target object
   * @returns {boolean} True if crosshair is on target
   */
  isTrackingTarget(target) {
    return this.isTargetHit(target);
  }
  
  /**
   * Get hit precision (distance from center)
   * @param {Object} hitInfo - Hit information from checkHit
   * @param {Object} target - Target object
   * @returns {number} Distance from center (0-1, 0 = perfect center)
   */
  getHitPrecision(hitInfo, target) {
    if (!hitInfo || !target) return 1;
    
    const hitPoint = hitInfo.point;
    const targetCenter = target.position;
    const targetRadius = target.size * 0.5;
    
    const distanceFromCenter = hitPoint.distanceTo(targetCenter);
    const precision = distanceFromCenter / targetRadius;
    
    return Math.min(1, precision);
  }
  
  /**
   * Check if hit is center-mass (within 25% of radius)
   * @param {Object} hitInfo - Hit information from checkHit
   * @param {Object} target - Target object
   * @returns {boolean} True if center hit
   */
  isCenterHit(hitInfo, target) {
    const precision = this.getHitPrecision(hitInfo, target);
    return precision < 0.25;
  }
  
  /**
   * Optimize raycaster for performance
   * @param {number} far - Maximum raycast distance
   */
  setMaxDistance(far) {
    this.raycaster.far = far;
  }
  
  dispose() {
    // Clean up
    this.raycaster = null;
    this.camera = null;
  }
}
