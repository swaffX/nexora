// Device detection utilities

export function isMobileDevice() {
  // Check user agent
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  
  // Mobile device patterns
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  
  // Check touch support
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Check screen size (mobile typically < 768px)
  const isSmallScreen = window.innerWidth < 768;
  
  return mobileRegex.test(userAgent) || (hasTouch && isSmallScreen);
}

export function isTablet() {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  return /iPad|Android/i.test(userAgent) && window.innerWidth >= 768;
}

export function isDesktop() {
  return !isMobileDevice() && !isTablet();
}

export function getDeviceType() {
  if (isMobileDevice()) return 'mobile';
  if (isTablet()) return 'tablet';
  return 'desktop';
}

export function checkWebGLSupport() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    return !!gl;
  } catch (e) {
    return false;
  }
}

export function getDeviceInfo() {
  return {
    type: getDeviceType(),
    isMobile: isMobileDevice(),
    isTablet: isTablet(),
    isDesktop: isDesktop(),
    hasWebGL: checkWebGLSupport(),
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    pixelRatio: window.devicePixelRatio || 1
  };
}
