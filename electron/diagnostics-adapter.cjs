const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const plist = require('plist');

const execFileAsync = promisify(execFile);

function binaryCandidates(tool) {
  const names = process.platform === 'win32' ? [`${tool}.exe`, tool] : [tool];
  const roots = [
    process.env.IVERYFY_IDEVICE_BIN,
    path.join(process.resourcesPath || '', 'bin', process.platform, process.arch),
    path.join(__dirname, '..', 'bin', process.platform, process.arch),
  ].filter(Boolean);
  return [
    ...roots.flatMap((root) => names.map((name) => path.join(root, name))),
    ...names,
  ];
}

async function runDiagnostics(udid) {
  for (const candidate of binaryCandidates('idevicediagnostics')) {
    try {
      const result = await execFileAsync(candidate, ['-u', udid, 'ioregentry', 'AppleSmartBattery'], {
        windowsHide: true,
        timeout: 8000,
      });
      return { binary: candidate, stdout: result.stdout || '' };
    } catch (error) {
      if (error && error.code === 'ENOENT') continue;
    }
  }
  return null;
}

function findValue(source, names) {
  if (!source || typeof source !== 'object') return undefined;
  for (const name of names) {
    if (source[name] !== undefined) return source[name];
  }
  for (const value of Object.values(source)) {
    if (value && typeof value === 'object') {
      const found = findValue(value, names);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function numeric(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function booleanValue(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return ['true', 'yes', '1'].includes(value.toLowerCase());
  return null;
}

function normalizeBatteryRecord(record, source = 'native diagnostics') {
  const designCapacity = numeric(findValue(record, ['DesignCapacity', 'AppleDesignCapacity']));
  const fullChargeCapacity = numeric(findValue(record, ['AppleRawMaxCapacity', 'FullChargeCapacity', 'NominalChargeCapacity']));
  const currentCapacity = numeric(findValue(record, ['AppleRawCurrentCapacity', 'CurrentCapacity']));
  const cycleCount = numeric(findValue(record, ['CycleCount', 'BatteryCycleCount']));
  const temperatureRaw = numeric(findValue(record, ['Temperature', 'BatteryTemperature']));
  const voltage = numeric(findValue(record, ['Voltage', 'BatteryVoltage']));
  const maximumCapacity = designCapacity && fullChargeCapacity
    ? Math.round((fullChargeCapacity / designCapacity) * 100)
    : null;

  return {
    available: Boolean(designCapacity || fullChargeCapacity || cycleCount),
    source,
    health: maximumCapacity === null ? null : Math.min(100, Math.max(0, maximumCapacity)),
    designCapacity,
    fullChargeCapacity,
    currentCapacity,
    cycleCount,
    temperature: temperatureRaw === null ? null : temperatureRaw > 200 ? temperatureRaw / 100 : temperatureRaw,
    voltage,
    charging: booleanValue(findValue(record, ['IsCharging', 'Charging', 'ExternalConnected'])),
  };
}

class NativeDiagnosticsAdapter {
  async readBattery(udid) {
    if (!udid) return { available: false, reason: 'No trusted device identifier is available.' };
    const result = await runDiagnostics(udid);
    if (!result) return { available: false, reason: 'idevicediagnostics is not available.' };

    try {
      const parsed = plist.parse(result.stdout);
      return { ...normalizeBatteryRecord(parsed), binary: result.binary };
    } catch (error) {
      return { available: false, reason: 'Battery diagnostics could not be parsed.', error: error.message };
    }
  }
}

module.exports = {
  NativeDiagnosticsAdapter,
  normalizeBatteryRecord,
};
