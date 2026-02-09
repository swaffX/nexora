// First-Person Camera Controller with Pointer Lock API
import * as THREE from 'three';

export class CameraController {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    
    // Rotation state
    this.rotation = { x: 0, y: 0 }; // Euler angles (pitch, yaw)
    this.sensitivity = 0.5; // Valorant sensitivity (will be converted)
    
    // Pointer lock state
    this.isLocked = false;
    
    // Rotation limits
    this.minPolarAngle = 0.01; // Prevent looking straight up
    this.maxPolarAngle = Math.PI - 0.01; // Prevent looking straight down
    
    // Bind methods
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handlePointerLockChange = this.handlePointerLockChange.bind(this);
    this.handlePointerLockError = this.handlePointerLockError.bind(this);
    
    // Setup event listeners
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Pointer lock events
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    document.addEventListener('pointerlockerror', this.handlePointerLockError);
  }
  
  lockPointer() {
    this.domElement.requestPointerLock();
  }
  
  unlockPointer() {
    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    }
  }
  
  handlePointerLockChange() {
    this.isLocked = document.pointerLockElement === this.domElement;
    
    if (this.isLocked) {
      document.addEventListener('mousemove', this.handleMouseMove);
    } else {
      document.removeEventListener('mousemove', this.handleMouseMove);
    }
  }
  
  handlePointerLockError() {
    console.error('Pointer lock error');
  }
  
  handleMouseMove(event) {
    if (!this.isLocked) return;
    
    // Convert Valorant sensitivity to Three.js rotation speed
    // Formula: rotationSpeed = valorantSens × 0.07
    const rotationSpeed = this.sensitivity * 0.07;
    
    // Update rotation based on mouse movement
    this.rotation.y -= event.movementX * rotationSpeed * 0.002;
    this.rotation.x -= event.movementY * rotationSpeed * 0.002;
    
    // Clamp vertical rotation to prevent gimbal lock
    this.rotation.x = Math.max(
      -Math.PI / 2 + this.minPolarAngle,
      Math.min(Math.PI / 2 - this.minPolarAngle, this.rotation.x)
    );
  }
  
  updateCamera() {
    // Apply rotation to camera using Euler angles
    this.camera.rotation.order = 'YXZ'; // Yaw-Pitch-Roll order
    this.camera.rotation.y = this.rotation.y;
    this.camera.rotation.x = this.rotation.x;
  }
  
  setSensitivity(valorantSens) {
    // Valorant sensitivity range: 0.001 - 5.0
    this.sensitivity = Math.max(0.001, Math.min(5.0, valorantSens));
  }
  
  getSensitivity() {
    return this.sensitivity;
  }
  
  reset() {
    this.rotation.x = 0;
    this.rotation.y = 0;
    this.updateCamera();
  }
  
  dispose() {
    // Clean up event listeners
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    document.removeEventListener('pointerlockerror', this.handlePointerLockError);
    document.removeEventListener('mousemove', this.handleMouseMove);
    
    this.unlockPointer();
  }
}
