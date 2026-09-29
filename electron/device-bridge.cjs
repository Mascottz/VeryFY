const os = require('os');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

function binaryCandidates() {
  const names = process.platform === 'win32'
    ? ['idevice_id.exe', 'idevice_id']
    : ['idevice_id'];

  const roots = [
    process.env.VERYFY_IDEVICE_BIN,
    path.join(process.resourcesPath || '', 'bin', process.platform, process.arch),
    path.join(__dirname, '..', 'bin', process.platform, process.arch),
  ].filter(Boolean);

  return [
    ...roots.flatMap((root) => names.map((name) => path.join(root, name))),
    ...names,
  ];
}

async function runFirstAvailable(args = []) {
  for (const candidate of binaryCandidates()) {
    try {
      const result = await execFileAsync(candidate, args, { windowsHide: true, timeout: 3500 });
      return { binary: candidate, stdout: result.stdout || '' };
    } catch (error) {
      if (error && error.code === 'ENOENT') continue;
    }
  }
  return null;
}

async function getAppleServiceState() {
  if (process.platform !== 'win32') {
    return { checked: false, installed: false, message: 'Windows Apple support is only checked in the Windows build.' };
  }

  try {
    const result = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-Command',
      '$service = Get-Service -Name "Apple Mobile Device Service" -ErrorAction SilentlyContinue; if ($null -eq $service) { "missing" } else { $service.Status.ToString() }',
    ], { windowsHide: true, timeout: 5000 });
    const status = (result.stdout || '').trim().toLowerCase();
    return {
      checked: true,
      installed: status !== '' && status !== 'missing',
      running: status === 'running',
      status: status || 'missing',
    };
  } catch (error) {
    return { checked: true, installed: false, running: false, status: 'unknown', error: error.message };
  }
}

async function getAppleUsbState() {
  if (process.platform !== 'win32') {
    return { checked: false, detected: false, message: 'Windows USB device checks are only used in the Windows build.' };
  }

  try {
    const result = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-Command',
      '$devices = Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue | Where-Object { $_.InstanceId -match "VID_05AC" -or $_.FriendlyName -match "Apple Mobile|iPhone|Apple Device" }; if ($devices) { $devices | Select-Object -First 12 FriendlyName,Status,InstanceId | ConvertTo-Json -Compress } else { "[]" }',
    ], { windowsHide: true, timeout: 7000 });
    const value = (result.stdout || '').trim();
    const parsed = value ? JSON.parse(value) : [];
    const devices = Array.isArray(parsed) ? parsed : [parsed];
    return { checked: true, detected: devices.length > 0, devices };
  } catch (error) {
    return { checked: true, detected: false, devices: [], error: error.message };
  }
}

async function listTrustedDevices() {
  const result = await runFirstAvailable(['-l']);
  if (!result) return { available: false, udids: [] };
  const udids = result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return { available: true, udids, binary: result.binary };
}

class DeviceBridge {
  constructor() {
    this.timer = null;
    this.lastKey = '';
    this.onState = null;
  }

  async readState() {
    const [appleService, appleUsb, trusted] = await Promise.all([
      getAppleServiceState(),
      getAppleUsbState(),
      listTrustedDevices(),
    ]);

    const connected = trusted.udids.length > 0 || appleUsb.detected;
    let status = 'No device connected';
    if (connected && trusted.udids.length > 0) status = 'Connected and ready';
    else if (connected) status = 'iPhone detected, trust approval required';

    return {
      platform: process.platform,
      connected,
      status,
      deviceCount: Math.max(trusted.udids.length, appleUsb.devices?.length || 0),
      udids: trusted.udids,
      appleService,
      appleUsb,
      trustedAvailable: trusted.available,
      timestamp: new Date().toISOString(),
    };
  }

  async checkPrerequisites() {
    const appleService = await getAppleServiceState();
    const trusted = await listTrustedDevices();
    return {
      platform: process.platform,
      appleService,
      communicationBinaryAvailable: trusted.available,
      driverReady: appleService.installed || trusted.available,
      recommendations: [
        ...(!appleService.installed && process.platform === 'win32' ? ['Install Apple Devices from the Microsoft Store.'] : []),
        ...(!trusted.available ? ['Add the VeryFY iPhone communication binaries before production packaging.'] : []),
      ],
    };
  }

  start(onState) {
    this.onState = onState;
    const tick = async () => {
      const next = await this.readState();
      const key = JSON.stringify({ connected: next.connected, status: next.status, count: next.deviceCount });
      if (key !== this.lastKey) {
        this.lastKey = key;
        this.onState?.(next);
      }
    };
    tick();
    this.timer = setInterval(tick, 1600);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async scan() {
    const state = await this.readState();
    if (!state.connected) return { ok: false, state, reason: 'No trusted iPhone is connected.' };
    return {
      ok: true,
      state,
      diagnostics: {
        available: state.trustedAvailable,
        message: state.trustedAvailable ? 'Device communication is ready.' : 'Trusted device communication binary is not bundled yet.',
      },
    };
  }
}

module.exports = { DeviceBridge };
