// Valorant Sensitivity Converter for Three.js

/**
 * Converts Valorant sensitivity to Three.js rotation speed
 * @param {number} valorantSens - Valorant sensitivity (0.001 - 5.0)
 * @returns {number} Three.js rotation speed
 */
export function convertSensitivity(valorantSens) {
  // Formula: rotationSpeed = valorantSens × 0.07
  // This provides 1:1 muscle memory transfer from Valorant
  return valorantSens * 0.07;
}

/**
 * Converts Three.js rotation speed back to Valorant sensitivity
 * @param {number} rotationSpeed - Three.js rotation speed
 * @returns {number} Valorant sensitivity
 */
export function convertToValorantSens(rotationSpeed) {
  return rotationSpeed / 0.07;
}

/**
 * Validates Valorant sensitivity value
 * @param {number} sens - Sensitivity value to validate
 * @returns {boolean} True if valid
 */
export function isValidSensitivity(sens) {
  return typeof sens === 'number' && sens >= 0.001 && sens <= 5.0;
}

/**
 * Clamps sensitivity to valid Valorant range
 * @param {number} sens - Sensitivity value
 * @returns {number} Clamped sensitivity
 */
export function clampSensitivity(sens) {
  return Math.max(0.001, Math.min(5.0, sens));
}

/**
 * Calculates 360° distance in pixels for given sensitivity
 * Useful for comparing sensitivities
 * @param {number} valorantSens - Valorant sensitivity
 * @param {number} dpi - Mouse DPI (default: 800)
 * @returns {number} Pixels needed for 360° turn
 */
export function calculate360Distance(valorantSens, dpi = 800) {
  // Valorant uses 0.07 multiplier for sensitivity
  const inGameSens = valorantSens * 0.07;
  const cm360 = 360 / (inGameSens * dpi);
  return cm360 * (dpi / 2.54); // Convert cm to pixels
}
