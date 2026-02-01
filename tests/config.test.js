import { describe, it, expect } from 'vitest';
import {
  PRESETS,
  DEFAULT_CONFIG,
  CATEGORIES,
  applyPreset,
  clampThreshold,
  clampResetPeriod,
  clampAlertDuration,
  parseApps,
  mergeConfig,
  validateConfig,
  getEnabledApps,
} from '../lib/config.js';

describe('PRESETS', () => {
  it('has aggressive preset', () => {
    expect(PRESETS.aggressive).toEqual({
      threshold: 30,
      resetAfterSeconds: 20,
      alertMessage: 'Voice! Now!',
    });
  });

  it('has relaxed preset', () => {
    expect(PRESETS.relaxed).toEqual({
      threshold: 100,
      resetAfterSeconds: 60,
      alertMessage: 'Consider using voice input',
    });
  });

  it('has zen preset with voice', () => {
    expect(PRESETS.zen).toEqual({
      threshold: 25,
      resetAfterSeconds: 15,
      alertMessage: 'Breathe. Speak.',
      voice: { enabled: true },
    });
  });
});

describe('CATEGORIES', () => {
  it('has devTools category with apps', () => {
    expect(CATEGORIES.devTools).toBeDefined();
    expect(CATEGORIES.devTools.name).toBe('Dev Tools');
    expect(CATEGORIES.devTools.apps).toContain('Code');
    expect(CATEGORIES.devTools.apps).toContain('Cursor');
    expect(CATEGORIES.devTools.apps.length).toBeGreaterThan(10);
  });

  it('has communication category with apps', () => {
    expect(CATEGORIES.communication).toBeDefined();
    expect(CATEGORIES.communication.name).toBe('Communication');
    expect(CATEGORIES.communication.apps).toContain('Slack');
    expect(CATEGORIES.communication.apps).toContain('Discord');
    expect(CATEGORIES.communication.apps.length).toBeGreaterThan(5);
  });

  it('has aiApps category with apps', () => {
    expect(CATEGORIES.aiApps).toBeDefined();
    expect(CATEGORIES.aiApps.name).toBe('AI Apps');
    expect(CATEGORIES.aiApps.apps).toContain('Claude');
    expect(CATEGORIES.aiApps.apps).toContain('ChatGPT');
    expect(CATEGORIES.aiApps.apps).toContain('Perplexity');
    expect(CATEGORIES.aiApps.apps.length).toBeGreaterThan(5);
  });

  it('loads categories from JSON file (single source of truth)', () => {
    // All categories should have required fields
    for (const [id, category] of Object.entries(CATEGORIES)) {
      expect(category.name).toBeDefined();
      expect(category.description).toBeDefined();
      expect(Array.isArray(category.apps)).toBe(true);
      expect(category.apps.length).toBeGreaterThan(0);
    }
  });
});

describe('getEnabledApps', () => {
  it('returns empty array when no categories enabled', () => {
    const config = {
      categories: {
        devTools: { enabled: false },
        communication: { enabled: false },
        aiApps: { enabled: false }
      },
      customApps: { enabled: false, apps: [] }
    };
    expect(getEnabledApps(config)).toEqual([]);
  });

  it('returns devTools apps when devTools enabled', () => {
    const config = {
      categories: {
        devTools: { enabled: true },
        communication: { enabled: false },
        aiApps: { enabled: false }
      },
      customApps: { enabled: false, apps: [] }
    };
    const apps = getEnabledApps(config);
    expect(apps).toContain('Code');
    expect(apps).toContain('Cursor');
    expect(apps).not.toContain('Slack');
    expect(apps).not.toContain('Claude');
  });

  it('returns communication apps when communication enabled', () => {
    const config = {
      categories: {
        devTools: { enabled: false },
        communication: { enabled: true },
        aiApps: { enabled: false }
      },
      customApps: { enabled: false, apps: [] }
    };
    const apps = getEnabledApps(config);
    expect(apps).toContain('Slack');
    expect(apps).toContain('Discord');
    expect(apps).not.toContain('Code');
    expect(apps).not.toContain('Claude');
  });

  it('returns aiApps when aiApps enabled', () => {
    const config = {
      categories: {
        devTools: { enabled: false },
        communication: { enabled: false },
        aiApps: { enabled: true }
      },
      customApps: { enabled: false, apps: [] }
    };
    const apps = getEnabledApps(config);
    expect(apps).toContain('Claude');
    expect(apps).toContain('ChatGPT');
    expect(apps).toContain('Perplexity');
    expect(apps).not.toContain('Code');
    expect(apps).not.toContain('Slack');
  });

  it('includes custom apps when enabled', () => {
    const config = {
      categories: {
        devTools: { enabled: false },
        communication: { enabled: false }
      },
      customApps: { enabled: true, apps: ['MyApp', 'CustomEditor'] }
    };
    const apps = getEnabledApps(config);
    expect(apps).toContain('MyApp');
    expect(apps).toContain('CustomEditor');
  });

  it('deduplicates apps', () => {
    const config = {
      categories: {
        devTools: { enabled: true },
        communication: { enabled: false }
      },
      customApps: { enabled: true, apps: ['Code', 'NewApp'] }
    };
    const apps = getEnabledApps(config);
    const codeCount = apps.filter(a => a === 'Code').length;
    expect(codeCount).toBe(1);
    expect(apps).toContain('NewApp');
  });

  it('handles missing categories gracefully', () => {
    const config = { customApps: { enabled: true, apps: ['App1'] } };
    const apps = getEnabledApps(config);
    expect(apps).toEqual(['App1']);
  });

  it('handles missing customApps gracefully', () => {
    const config = { categories: { devTools: { enabled: true } } };
    const apps = getEnabledApps(config);
    expect(apps).toContain('Code');
  });
});

describe('applyPreset', () => {
  it('applies aggressive preset', () => {
    const config = { enabled: true, threshold: 50 };
    const result = applyPreset(config, 'aggressive');
    expect(result.threshold).toBe(30);
    expect(result.resetAfterSeconds).toBe(20);
    expect(result.alertMessage).toBe('Voice! Now!');
    expect(result.enabled).toBe(true);
  });

  it('applies relaxed preset', () => {
    const config = { enabled: true };
    const result = applyPreset(config, 'relaxed');
    expect(result.threshold).toBe(100);
    expect(result.resetAfterSeconds).toBe(60);
  });

  it('applies zen preset with voice', () => {
    const config = { enabled: true };
    const result = applyPreset(config, 'zen');
    expect(result.threshold).toBe(25);
    expect(result.voice).toEqual({ enabled: true });
  });

  it('is case insensitive', () => {
    const config = {};
    expect(applyPreset(config, 'AGGRESSIVE').threshold).toBe(30);
    expect(applyPreset(config, 'Relaxed').threshold).toBe(100);
  });

  it('throws on unknown preset', () => {
    expect(() => applyPreset({}, 'unknown')).toThrow('Unknown preset: unknown');
  });

  it('includes available presets in error message', () => {
    expect(() => applyPreset({}, 'invalid')).toThrow('aggressive, relaxed, zen');
  });
});

describe('clampThreshold', () => {
  it('clamps below minimum to 10', () => {
    expect(clampThreshold(5)).toBe(10);
    expect(clampThreshold(0)).toBe(10);
    expect(clampThreshold(-100)).toBe(10);
  });

  it('clamps above maximum to 500', () => {
    expect(clampThreshold(999)).toBe(500);
    expect(clampThreshold(501)).toBe(500);
    expect(clampThreshold(10000)).toBe(500);
  });

  it('passes valid values through', () => {
    expect(clampThreshold(10)).toBe(10);
    expect(clampThreshold(50)).toBe(50);
    expect(clampThreshold(100)).toBe(100);
    expect(clampThreshold(500)).toBe(500);
  });

  it('handles NaN by returning default', () => {
    expect(clampThreshold(NaN)).toBe(50);
    expect(clampThreshold('abc')).toBe(50);
    expect(clampThreshold(undefined)).toBe(50);
  });

  it('accepts custom default value', () => {
    expect(clampThreshold(NaN, 75)).toBe(75);
    expect(clampThreshold('invalid', 100)).toBe(100);
  });

  it('parses string numbers', () => {
    expect(clampThreshold('50')).toBe(50);
    expect(clampThreshold('100')).toBe(100);
  });
});

describe('clampResetPeriod', () => {
  it('clamps below minimum to 5', () => {
    expect(clampResetPeriod(1)).toBe(5);
    expect(clampResetPeriod(0)).toBe(5);
  });

  it('clamps above maximum to 300', () => {
    expect(clampResetPeriod(999)).toBe(300);
    expect(clampResetPeriod(301)).toBe(300);
  });

  it('passes valid values through', () => {
    expect(clampResetPeriod(30)).toBe(30);
    expect(clampResetPeriod(60)).toBe(60);
  });

  it('handles NaN by returning default', () => {
    expect(clampResetPeriod(NaN)).toBe(30);
  });
});

describe('clampAlertDuration', () => {
  it('clamps below minimum to 0.5', () => {
    expect(clampAlertDuration(0.1)).toBe(0.5);
    expect(clampAlertDuration(0)).toBe(0.5);
  });

  it('clamps above maximum to 10', () => {
    expect(clampAlertDuration(15)).toBe(10);
    expect(clampAlertDuration(100)).toBe(10);
  });

  it('passes valid values through', () => {
    expect(clampAlertDuration(2)).toBe(2);
    expect(clampAlertDuration(5.5)).toBe(5.5);
  });

  it('handles NaN by returning default', () => {
    expect(clampAlertDuration(NaN)).toBe(2);
  });
});

describe('parseApps', () => {
  it('splits comma-separated apps', () => {
    expect(parseApps('Code,Cursor,Zed')).toEqual(['Code', 'Cursor', 'Zed']);
  });

  it('trims whitespace', () => {
    expect(parseApps('Code, Cursor, Zed')).toEqual(['Code', 'Cursor', 'Zed']);
    expect(parseApps('  Code  ,  Cursor  ')).toEqual(['Code', 'Cursor']);
  });

  it('handles empty string', () => {
    expect(parseApps('')).toEqual([]);
  });

  it('handles null and undefined', () => {
    expect(parseApps(null)).toEqual([]);
    expect(parseApps(undefined)).toEqual([]);
  });

  it('filters out empty entries', () => {
    expect(parseApps('Code,,Cursor')).toEqual(['Code', 'Cursor']);
    expect(parseApps('Code,  ,Cursor')).toEqual(['Code', 'Cursor']);
  });

  it('handles single app', () => {
    expect(parseApps('Code')).toEqual(['Code']);
  });
});

describe('mergeConfig', () => {
  it('merges simple values', () => {
    const defaults = { a: 1, b: 2 };
    const overrides = { b: 3, c: 4 };
    expect(mergeConfig(defaults, overrides)).toEqual({ a: 1, b: 3, c: 4 });
  });

  it('merges nested objects', () => {
    const defaults = { voice: { enabled: false } };
    const overrides = { voice: { enabled: true } };
    expect(mergeConfig(defaults, overrides)).toEqual({
      voice: { enabled: true },
    });
  });

  it('ignores null and undefined values', () => {
    const defaults = { a: 1, b: 2 };
    const overrides = { a: null, b: undefined };
    expect(mergeConfig(defaults, overrides)).toEqual({ a: 1, b: 2 });
  });

  it('replaces arrays', () => {
    const defaults = { apps: ['a', 'b'] };
    const overrides = { apps: ['c'] };
    expect(mergeConfig(defaults, overrides)).toEqual({ apps: ['c'] });
  });

  it('does not mutate inputs', () => {
    const defaults = { a: 1 };
    const overrides = { b: 2 };
    const result = mergeConfig(defaults, overrides);
    expect(defaults).toEqual({ a: 1 });
    expect(overrides).toEqual({ b: 2 });
    expect(result).toEqual({ a: 1, b: 2 });
  });
});

describe('validateConfig', () => {
  it('validates complete config', () => {
    const result = validateConfig(DEFAULT_CONFIG);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects non-object config', () => {
    expect(validateConfig(null).valid).toBe(false);
    expect(validateConfig('string').valid).toBe(false);
    expect(validateConfig(123).valid).toBe(false);
  });

  it('rejects invalid threshold', () => {
    const config = { ...DEFAULT_CONFIG, threshold: 5 };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('threshold must be a number between 10 and 500');
  });

  it('rejects threshold above max', () => {
    const config = { ...DEFAULT_CONFIG, threshold: 1000 };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
  });

  it('rejects invalid resetAfterSeconds', () => {
    const config = { ...DEFAULT_CONFIG, resetAfterSeconds: 1 };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('resetAfterSeconds must be a number between 5 and 300');
  });

  it('rejects invalid alertDurationSeconds', () => {
    const config = { ...DEFAULT_CONFIG, alertDurationSeconds: 0.1 };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
  });

  it('rejects empty alertMessage', () => {
    const config = { ...DEFAULT_CONFIG, alertMessage: '' };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('alertMessage must be a non-empty string');
  });

  it('rejects non-array customApps.apps', () => {
    const config = { ...DEFAULT_CONFIG, customApps: { enabled: true, apps: 'Code' } };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('customApps.apps must be an array');
  });

  it('rejects non-boolean customApps.enabled', () => {
    const config = { ...DEFAULT_CONFIG, customApps: { enabled: 'yes', apps: [] } };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('customApps.enabled must be a boolean');
  });

  it('rejects non-boolean category enabled', () => {
    const config = { ...DEFAULT_CONFIG, categories: { devTools: { enabled: 'yes' } } };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('categories.devTools.enabled must be a boolean');
  });

  it('rejects non-boolean enabled', () => {
    const config = { ...DEFAULT_CONFIG, enabled: 'true' };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('enabled must be a boolean');
  });

  it('collects multiple errors', () => {
    const config = {
      threshold: 5,
      resetAfterSeconds: 1,
      alertDurationSeconds: 0,
      alertMessage: '',
      customApps: { enabled: 'yes', apps: 'not-array' },
      enabled: 'yes',
    };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});
