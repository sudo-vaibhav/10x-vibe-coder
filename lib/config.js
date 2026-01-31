/**
 * VoiceNudge Configuration Utilities
 * Pure functions for config manipulation
 */

export const PRESETS = {
  aggressive: {
    threshold: 30,
    resetAfterSeconds: 20,
    alertMessage: 'Voice! Now!'
  },
  relaxed: {
    threshold: 100,
    resetAfterSeconds: 60,
    alertMessage: 'Consider using voice input'
  },
  zen: {
    threshold: 25,
    resetAfterSeconds: 15,
    alertMessage: 'Breathe. Speak.',
    voice: { enabled: true }
  },
};

export const DEFAULT_APPS = [
  'Code',
  'Cursor',
  'Zed',
  'Conductor',
  'Terminal',
  'iTerm2',
  'Warp'
];

export const DEFAULT_CONFIG = {
  enabled: true,
  threshold: 50,
  resetAfterSeconds: 30,
  alertDurationSeconds: 2,
  alertMessage: 'Use your voice!',
  voice: { enabled: false },
  monitoredApps: DEFAULT_APPS,
  menuBar: { showCount: false, icon: 'V' },
};

/**
 * Apply a preset to a config object
 * @param {object} config - Base config
 * @param {string} presetName - Name of preset (aggressive, relaxed, zen)
 * @returns {object} Config with preset applied
 * @throws {Error} If preset name is unknown
 */
export function applyPreset(config, presetName) {
  const preset = PRESETS[presetName.toLowerCase()];
  if (!preset) {
    throw new Error(`Unknown preset: ${presetName}. Available: ${Object.keys(PRESETS).join(', ')}`);
  }
  return { ...config, ...preset };
}

/**
 * Clamp threshold value between 10 and 500
 * @param {number} value - Threshold value
 * @param {number} defaultValue - Default if NaN (default: 50)
 * @returns {number} Clamped threshold
 */
export function clampThreshold(value, defaultValue = 50) {
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    return defaultValue;
  }
  return Math.max(10, Math.min(500, num));
}

/**
 * Clamp reset period between 5 and 300 seconds
 * @param {number} value - Reset period in seconds
 * @param {number} defaultValue - Default if NaN (default: 30)
 * @returns {number} Clamped reset period
 */
export function clampResetPeriod(value, defaultValue = 30) {
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    return defaultValue;
  }
  return Math.max(5, Math.min(300, num));
}

/**
 * Clamp alert duration between 0.5 and 10 seconds
 * @param {number} value - Alert duration in seconds
 * @param {number} defaultValue - Default if NaN (default: 2)
 * @returns {number} Clamped alert duration
 */
export function clampAlertDuration(value, defaultValue = 2) {
  const num = parseFloat(value);
  if (isNaN(num)) {
    return defaultValue;
  }
  return Math.max(0.5, Math.min(10, num));
}

/**
 * Parse comma-separated apps string into array
 * @param {string} appsString - Comma-separated app names
 * @returns {string[]} Array of trimmed app names
 */
export function parseApps(appsString) {
  if (!appsString || typeof appsString !== 'string') {
    return [];
  }
  return appsString
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Merge config with defaults
 * @param {object} defaults - Default config
 * @param {object} overrides - Override values
 * @returns {object} Merged config
 */
export function mergeConfig(defaults, overrides) {
  const result = { ...defaults };

  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined && value !== null) {
      if (typeof value === 'object' && !Array.isArray(value) && typeof result[key] === 'object') {
        result[key] = { ...result[key], ...value };
      } else {
        result[key] = value;
      }
    }
  }

  return result;
}

/**
 * Validate config object
 * @param {object} config - Config to validate
 * @returns {{ valid: boolean, errors: string[] }} Validation result
 */
export function validateConfig(config) {
  const errors = [];

  if (typeof config !== 'object' || config === null) {
    return { valid: false, errors: ['Config must be an object'] };
  }

  if (typeof config.threshold !== 'number' || config.threshold < 10 || config.threshold > 500) {
    errors.push('threshold must be a number between 10 and 500');
  }

  if (typeof config.resetAfterSeconds !== 'number' || config.resetAfterSeconds < 5 || config.resetAfterSeconds > 300) {
    errors.push('resetAfterSeconds must be a number between 5 and 300');
  }

  if (typeof config.alertDurationSeconds !== 'number' || config.alertDurationSeconds < 0.5 || config.alertDurationSeconds > 10) {
    errors.push('alertDurationSeconds must be a number between 0.5 and 10');
  }

  if (typeof config.alertMessage !== 'string' || config.alertMessage.length === 0) {
    errors.push('alertMessage must be a non-empty string');
  }

  if (!Array.isArray(config.monitoredApps)) {
    errors.push('monitoredApps must be an array');
  }

  if (typeof config.enabled !== 'boolean') {
    errors.push('enabled must be a boolean');
  }

  return { valid: errors.length === 0, errors };
}
