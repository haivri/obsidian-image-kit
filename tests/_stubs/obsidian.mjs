// Minimal stand-ins so pure modules that import types (and a few runtime
// symbols) from 'obsidian' can be bundled for node --test.
export class TFile {}
export class Notice { constructor(message) { this.message = message; } }
export class Plugin {}
export class PluginSettingTab {}
export class Setting {}
export const Platform = { isMobile: false, isDesktopApp: true };
export function setIcon() {}
