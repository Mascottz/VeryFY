const fs = require('fs');
const path = require('path');
const { normalizeBatteryRecord } = require('../electron/diagnostics-adapter.cjs');

const fixturePath = path.join(__dirname, '..', 'fixtures', 'iphone-13-pro-battery.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const result = normalizeBatteryRecord(fixture, 'fixture');

const required = ['health', 'designCapacity', 'fullChargeCapacity', 'cycleCount', 'temperature'];
const missing = required.filter((key) => result[key] === null || result[key] === undefined);
if (missing.length) {
  throw new Error(`Missing normalized fields: ${missing.join(', ')}`);
}
if (result.health !== 87 || result.cycleCount !== 643) {
  throw new Error(`Unexpected fixture result: ${JSON.stringify(result)}`);
}

console.log(JSON.stringify(result));
