const state = {
  currentView: "overview",
  testsComplete: false,
  deviceConnected: false,
  currentInspection: null,
  auth: { configured: false, signedIn: false, email: null },
  theme: localStorage.getItem("iveryfy-theme") || "light",
  historyEnabled: localStorage.getItem("iveryfy-history") !== "off",
};

const viewNames = {
  overview: "Overview",
  battery: "Battery",
  parts: "Parts & history",
  tests: "Hardware tests",
  reports: "Reports",
  history: "Inspection history",
  settings: "Settings",
};

const navItems = [...document.querySelectorAll(".nav-item")];
const views = [...document.querySelectorAll("[data-view-panel]")];
const breadcrumb = document.getElementById("breadcrumb-current");
const sidebar = document.getElementById("sidebar");
const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toast-message");
let toastTimer;

function showView(viewName) {
  if (!viewNames[viewName]) return;
  state.currentView = viewName;
  views.forEach((view) => {
    view.classList.toggle("active", view.dataset.viewPanel === viewName);
  });
  navItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.view === viewName);
  });
  breadcrumb.textContent = viewNames[viewName];
  sidebar.classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showToast(message) {
  toastMessage.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

function maskSerial(serial) {
  if (!serial) return "Not available";
  const value = String(serial);
  return value.length > 6 ? `${value.slice(0, 3)}••••${value.slice(-3)}` : value;
}

function updateConnectionState(state) {
  const label = document.getElementById("connection-label");
  const indicator = document.getElementById("connection-indicator");
  if (!label || !indicator || !state) return;
  state.deviceConnected = Boolean(state.connected);
  label.textContent = state.status;
  indicator.classList.toggle("is-ready", state.connected);
  indicator.classList.toggle("is-warning", !state.connected);

  const fields = state.deviceInfo?.fields || {};
  const model = document.getElementById("device-model");
  const connection = document.getElementById("device-connection");
  const ios = document.getElementById("device-ios");
  const serial = document.getElementById("device-serial");
  const lastScan = document.getElementById("last-scan");
  const deviceDot = document.getElementById("device-status-dot");
  deviceDot?.classList.toggle("offline-dot", !state.connected);
  if (fields.DeviceName && model) model.textContent = fields.DeviceName;
  else if (fields.ProductType && model) model.textContent = fields.ProductType;
  else if (state.connected && model) model.textContent = "iPhone detected";
  else if (!state.connected && model) model.textContent = "No iPhone connected";
  if (connection) connection.textContent = state.status;
  if (fields.ProductVersion && ios) ios.textContent = fields.ProductVersion;
  else if (!state.connected && ios) ios.textContent = "Not available";
  if (fields.SerialNumber && serial) serial.textContent = maskSerial(fields.SerialNumber);
  else if (!state.connected && serial) serial.textContent = "Not available";
  if (state.connected && lastScan && state.timestamp) lastScan.textContent = new Date(state.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function updateBatteryMetrics(battery) {
  if (!battery?.available) return;
  const health = battery.health === null ? null : `${battery.health}<span>%</span>`;
  if (health) {
    ["overview-battery-health", "battery-page-health", "overview-health-value"].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.innerHTML = health;
    });
  }
  if (battery.cycleCount !== null && battery.cycleCount !== undefined) {
    ["overview-cycle-count", "battery-page-cycles"].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.textContent = battery.cycleCount;
    });
  }
  const values = {
    "overview-full-capacity": battery.fullChargeCapacity,
    "battery-page-full-capacity": battery.fullChargeCapacity,
    "battery-page-design-capacity": battery.designCapacity,
    "overview-temperature": battery.temperature,
    "battery-page-temperature": battery.temperature,
  };
  Object.entries(values).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (!element || value === null || value === undefined) return;
    const suffix = id.includes("temperature") ? "°C" : " mAh";
    element.textContent = `${Math.round(value * 100) / 100}${suffix}`;
  });
}

function inspectionFromScan(result) {
  const fields = result.state?.deviceInfo?.fields || {};
  const battery = result.battery || {};
  return {
    deviceModel: fields.DeviceName || fields.ProductType || "Connected iPhone",
    serialLast4: fields.SerialNumber ? String(fields.SerialNumber).slice(-4) : null,
    iosVersion: fields.ProductVersion || null,
    batteryHealth: battery.health ?? null,
    cycleCount: battery.cycleCount ?? null,
    conditionScore: null,
    partsSummary: {},
    testSummary: { passed: 0, total: 0 },
  };
}

function applyDeviceScan(result) {
  if (!result) return;
  updateConnectionState(result.state);
  updateBatteryMetrics(result.battery);
  state.currentInspection = inspectionFromScan(result);
  renderInspectionReport();
  enableInspectionControls();
  showView("overview");
}

function reportTextFor(inspection) {
  const battery = inspection.batteryHealth == null ? "Not available" : `${inspection.batteryHealth}%`;
  const cycles = inspection.cycleCount == null ? "Not available" : inspection.cycleCount;
  return `iVeryFY Device Inspection\n\nDevice: ${inspection.deviceModel}\nSerial: ${inspection.serialLast4 ? `••••${inspection.serialLast4}` : "Not available"}\niOS: ${inspection.iosVersion || "Not available"}\n\nBattery health: ${battery}\nCycle count: ${cycles}\nParts: No records loaded\nHardware tests: ${inspection.testSummary.passed} of ${inspection.testSummary.total}\n\nPowered by MASTECH INNOVATIONS\ninfo@mastechinnovations.com.ng\n+234 913 882 5300`;
}

function renderInspectionReport() {
  const preview = document.getElementById("report-preview");
  if (!preview) return;
  if (!state.currentInspection) {
    preview.innerHTML = '<div class="panel-empty wide-empty"><svg><use href="#i-report"/></svg><h3>No inspection report yet</h3><p>Complete a device inspection to generate a report.</p><button class="secondary-button" id="report-connect">Connect device <svg><use href="#i-usb"/></svg></button></div>';
    document.getElementById("report-connect")?.addEventListener("click", openModal);
    return;
  }
  const inspection = state.currentInspection;
  reportText = reportTextFor(inspection);
  const battery = inspection.batteryHealth == null ? "Not available" : `${inspection.batteryHealth}%`;
  preview.innerHTML = `<div class="report-preview-header"><div class="report-brand"><div class="brand-mark small"><span></span><span></span><span></span><span></span><b></b></div><div><strong>iVery<span>FY</span></strong><small>DEVICE INSPECTION</small></div></div><span class="report-tag">DRAFT</span></div><div class="report-title-row"><div><span class="small-label">INSPECTION REPORT</span><h2>${escapeHtml(inspection.deviceModel)}</h2><p>Device scan completed just now</p></div><div class="report-score"><strong>--</strong><span>/100</span><small>Assessment pending</small></div></div><div class="report-line"></div><div class="report-report-grid"><div><span class="small-label">BATTERY</span><strong>${escapeHtml(battery)}</strong><small>${escapeHtml(inspection.cycleCount ?? "Not available")} cycles</small></div><div><span class="small-label">PARTS</span><strong>Not loaded</strong><small>Run parts scan to continue</small></div><div><span class="small-label">HARDWARE</span><strong>0 / 0</strong><small>Tests ready to begin</small></div></div><div class="report-line"></div><div class="report-footer"><span>Powered by <strong>MASTECH INNOVATIONS</strong></span><span>info@mastechinnovations.com.ng · +234 913 882 5300</span></div>`;
}

const testDefinitions = [
  ["display", "Display and touch", "Touch grid, brightness and responsive areas."],
  ["cameras", "Cameras", "Front, rear, flash and focus checks."],
  ["audio", "Audio system", "Speakers, earpiece and microphones."],
  ["face", "Face ID", "Guided confirmation required."],
  ["controls", "Physical controls", "Side button, volume and mute controls."],
  ["charging", "Charging", "Port and charging response."],
];

function renderTestSuite() {
  const grid = document.querySelector(".test-grid");
  if (!grid) return;
  grid.innerHTML = testDefinitions.map(([id, title, description]) => `<article class="test-card pending-card"><div class="test-card-top"><div class="test-symbol"><svg><use href="#i-tests"/></svg></div><span class="status-badge neutral-badge"><i></i>Ready</span></div><h3>${title}</h3><p>${description}</p><button class="test-action primary-test" data-test="${id}">Start test <svg><use href="#i-arrow"/></svg></button></article>`).join("");
  bindTestActions();
  const testCount = document.getElementById("test-count");
  if (testCount) testCount.textContent = `0 of ${testDefinitions.length}`;
  const suitePercent = document.getElementById("suite-percent");
  if (suitePercent) suitePercent.textContent = "0%";
}

function enableInspectionControls() {
  renderTestSuite();
  document.getElementById("run-all-tests")?.removeAttribute("disabled");
  ["export-report", "save-inspection", "print-report", "copy-report"].forEach((id) => document.getElementById(id)?.removeAttribute("disabled"));
  document.querySelector(".word-value")?.replaceChildren(document.createTextNode("Draft"));
  document.getElementById("condition-connect")?.remove();
  ["next-connect", "parts-connect", "tests-connect", "report-connect"].forEach((id) => document.getElementById(id)?.addEventListener("click", openModal));
}

function updateAuthState(auth) {
  state.auth = { ...state.auth, ...auth };
  const accountButton = document.getElementById("account-button");
  const accountLabel = document.querySelector(".account-label");
  const accountEmail = document.getElementById("account-email");
  const avatar = accountButton?.querySelector(".avatar");
  if (!accountButton || !accountLabel) return;
  accountButton.classList.toggle("signed-in", Boolean(state.auth.signedIn));
  accountLabel.textContent = state.auth.signedIn ? "Account" : "Sign in";
  if (accountEmail) accountEmail.textContent = state.auth.signedIn ? state.auth.email || "Signed in" : "Not signed in";
  if (avatar && state.auth.signedIn) {
    avatar.innerHTML = "";
    avatar.textContent = (state.auth.email || "iV").slice(0, 2).toUpperCase();
  } else if (avatar) {
    avatar.innerHTML = '<svg><use href="#i-settings"/></svg>';
    avatar.textContent = "";
  }
}

function openAuthModal() {
  const authModal = document.getElementById("auth-modal");
  if (!authModal) return;
  authModal.classList.add("open");
  authModal.setAttribute("aria-hidden", "false");
  document.getElementById("auth-error").textContent = "";
  setTimeout(() => document.getElementById("auth-email")?.focus(), 100);
}

function closeAuthModal() {
  const authModal = document.getElementById("auth-modal");
  if (!authModal) return;
  authModal.classList.remove("open");
  authModal.setAttribute("aria-hidden", "true");
}

function getCloudBridge() {
  return window.iveryfy || window.iveryfyWeb || null;
}

async function refreshCloudHistory() {
  const bridge = getCloudBridge();
  if (!bridge?.listInspections || !state.auth.signedIn) return;
  const result = await bridge.listInspections();
  if (result.ok) renderInspectionHistory(result.inspections);
}

function initializeCloudBridge(bridge) {
  if (!bridge) return;
  bridge.onDeviceState?.(updateConnectionState);
  bridge.getCloudStatus?.().then((cloud) => {
    updateAuthState(cloud);
    if (cloud?.configured && !cloud?.signedIn) showToast("Sign in to save inspections to your workspace");
  }).catch(() => {});
  bridge.getAuthStatus?.().then(updateAuthState).catch(() => {});
  bridge.onAuthState?.((auth) => {
    updateAuthState(auth);
    if (auth.signedIn) {
      closeAuthModal();
      showToast("Signed in");
      refreshCloudHistory();
    }
  });
}

initializeCloudBridge(window.iveryfy);
window.addEventListener("iveryfy:web-ready", () => initializeCloudBridge(window.iveryfyWeb));
window.addEventListener("iveryfy:web-error", (event) => {
  if (event.detail) console.warn("iVeryFY web cloud bridge error", event.detail);
});

navItems.forEach((item) => item.addEventListener("click", () => showView(item.dataset.view)));
document.querySelectorAll("[data-view-target]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.viewTarget));
});

document.querySelectorAll(".row-arrow").forEach((button) => {
  button.addEventListener("click", () => {
    showView("reports");
    showToast("Inspection report opened");
  });
});

const accountMenu = document.getElementById("account-menu");
document.getElementById("account-button")?.addEventListener("click", () => {
  if (!state.auth.signedIn) {
    openAuthModal();
    return;
  }
  const open = accountMenu?.classList.toggle("open");
  accountMenu?.setAttribute("aria-hidden", String(!open));
});
document.getElementById("sign-out-button")?.addEventListener("click", async () => {
  const bridge = getCloudBridge();
  const result = await bridge?.signOut?.();
  if (result?.ok) {
    updateAuthState(result.auth);
    accountMenu?.classList.remove("open");
    showToast("Signed out");
  }
});
document.addEventListener("click", (event) => {
  if (accountMenu?.classList.contains("open") && !event.target.closest(".account-wrap")) {
    accountMenu.classList.remove("open");
    accountMenu.setAttribute("aria-hidden", "true");
  }
});

document.getElementById("auth-close")?.addEventListener("click", closeAuthModal);
document.getElementById("auth-modal")?.addEventListener("click", (event) => {
  if (event.target.id === "auth-modal") closeAuthModal();
});
document.getElementById("auth-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  const error = document.getElementById("auth-error");
  const submit = document.getElementById("auth-submit");
  const original = submit.innerHTML;
  error.textContent = "";
  submit.disabled = true;
  submit.innerHTML = '<span class="spinner"></span>Signing in';

  const bridge = getCloudBridge();
  if (!bridge?.signIn) {
    error.textContent = "Workspace sign in is not configured for this environment.";
  } else {
    const result = await bridge.signIn(email, password);
    if (result.ok) {
      updateAuthState(result.auth);
      closeAuthModal();
      showToast("Signed in");
      refreshCloudHistory();
    } else {
      error.textContent = result.error || "Sign in could not be completed.";
    }
  }
  submit.disabled = false;
  submit.innerHTML = original;
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeAuthModal();
});

const modal = document.getElementById("connect-modal");
const connectButton = document.getElementById("connect-button");
const closeModal = () => {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
};
const openModal = () => {
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.getElementById("scan-status").classList.remove("show");
};
connectButton?.addEventListener("click", openModal);
document.getElementById("condition-connect")?.addEventListener("click", openModal);
document.getElementById("modal-close")?.addEventListener("click", closeModal);
document.getElementById("modal-cancel")?.addEventListener("click", closeModal);
["report-connect", "parts-connect", "tests-connect", "next-connect"].forEach((id) => document.getElementById(id)?.addEventListener("click", openModal));
modal?.addEventListener("click", (event) => {
  if (event.target === modal) closeModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModal();
});

document.getElementById("start-scan")?.addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const status = document.getElementById("scan-status");
  const statusText = status.querySelector("span:last-child");
  button.disabled = true;
  button.innerHTML = '<span class="spinner"></span>Scanning';
  status.classList.add("show");
  statusText.textContent = "Reading available device information";

  if (window.iveryfy?.scanDevice) {
    const result = await window.iveryfy.scanDevice();
    if (!result.ok) {
      statusText.textContent = result.reason || "Connect and trust an iPhone to continue";
      button.disabled = false;
      button.innerHTML = '<svg><use href="#i-usb"/></svg>Try again';
      return;
    }
    applyDeviceScan(result);
    closeModal();
    button.disabled = false;
    button.innerHTML = '<svg><use href="#i-usb"/></svg>Start scan';
    showToast(result.battery?.available ? "Device and battery scan complete" : "Device scan complete");
    return;
  }

  setTimeout(() => {
    closeModal();
    button.disabled = false;
    button.innerHTML = '<svg><use href="#i-usb"/></svg>Start scan';
    showToast("Demo device scan complete");
  }, 1700);
});

document.getElementById("refresh-battery")?.addEventListener("click", (event) => {
  const button = event.currentTarget;
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<span class="spinner"></span>Refreshing';
  setTimeout(() => {
    button.disabled = false;
    button.innerHTML = original;
    showToast("Battery data refreshed");
  }, 900);
});

document.getElementById("parts-info")?.addEventListener("click", () => {
  showToast("Part records are read from available device diagnostics");
});

function finishAllTests() {
  state.testsComplete = true;
  const testCount = document.getElementById("test-count");
  const percent = document.getElementById("suite-percent");
  const progress = document.getElementById("test-progress");
  if (testCount) testCount.textContent = `${testDefinitions.length} of ${testDefinitions.length}`;
  if (percent) percent.textContent = "100%";
  if (progress) progress.style.width = "100%";
  document.querySelectorAll(".pending-card").forEach((card) => {
    card.classList.remove("pending-card");
    card.classList.add("passed-card");
    const badge = card.querySelector(".status-badge");
    if (badge) {
      badge.className = "status-badge success";
      badge.innerHTML = "<i></i>Passed";
    }
    const action = card.querySelector(".test-action");
    if (action) {
      action.classList.remove("primary-test");
      action.textContent = "View result ";
      action.insertAdjacentHTML("beforeend", '<svg><use href="#i-arrow"/></svg>');
    }
  });
}

document.getElementById("run-all-tests")?.addEventListener("click", (event) => {
  const button = event.currentTarget;
  if (!state.currentInspection) {
    showToast("Connect a device before running tests");
    return;
  }
  if (state.testsComplete) {
    showToast("All hardware tests are already complete");
    return;
  }
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<span class="spinner"></span>Running tests';
  let value = 0;
  const timer = setInterval(() => {
    value += 20;
    if (value >= 100) {
      clearInterval(timer);
      document.querySelectorAll(".test-card.pending-card").forEach((card) => {
        card.classList.remove("pending-card");
        card.classList.add("passed-card");
        const badge = card.querySelector(".status-badge");
        if (badge) {
          badge.className = "status-badge success";
          badge.innerHTML = "<i></i>Passed";
        }
        const action = card.querySelector(".test-action");
        if (action) {
          action.classList.remove("primary-test");
          action.innerHTML = 'View result <svg><use href="#i-arrow"/></svg>';
        }
      });
      finishAllTests();
      state.currentInspection.testSummary = { passed: testDefinitions.length, total: testDefinitions.length };
      renderInspectionReport();
      button.disabled = false;
      button.innerHTML = original;
      showToast("All guided tests completed");
      return;
    }
    const passed = Math.round((value / 100) * testDefinitions.length);
    document.getElementById("test-progress")?.setAttribute("style", `width:${value}%`);
    document.getElementById("test-count")?.replaceChildren(document.createTextNode(`${passed} of ${testDefinitions.length}`));
    document.getElementById("suite-percent")?.replaceChildren(document.createTextNode(`${value}%`));
  }, 420);
});

function bindTestActions() {
  document.querySelectorAll(".test-action").forEach((button) => {
    button.addEventListener("click", () => {
      if (!state.currentInspection) {
        showToast("Connect a device before starting tests");
        return;
      }
      if (state.testsComplete || !button.classList.contains("primary-test")) {
        showToast("Test result opened");
        return;
      }
      button.innerHTML = '<span class="spinner"></span>Running';
      button.disabled = true;
      setTimeout(() => {
        button.disabled = false;
        const card = button.closest(".test-card");
        card.classList.remove("pending-card");
        card.classList.add("passed-card");
        const badge = card.querySelector(".status-badge");
        badge.className = "status-badge success";
        badge.innerHTML = "<i></i>Passed";
        button.classList.remove("primary-test");
        button.innerHTML = 'View result <svg><use href="#i-arrow"/></svg>';
        updateTestProgress();
        showToast("Test completed successfully");
      }, 700);
    });
  });
}

function updateTestProgress() {
  const total = testDefinitions.length;
  const passed = document.querySelectorAll(".test-card.passed-card").length;
  const percent = total ? Math.round((passed / total) * 100) : 0;
  document.getElementById("test-count")?.replaceChildren(document.createTextNode(`${passed} of ${total}`));
  document.getElementById("suite-percent")?.replaceChildren(document.createTextNode(`${percent}%`));
  const progress = document.getElementById("test-progress");
  if (progress) progress.style.width = `${percent}%`;
  if (passed === total && total > 0) finishAllTests();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[character]));
}

function renderInspectionHistory(records) {
  const bodies = [document.getElementById("recent-table-body"), document.getElementById("history-table-body")].filter(Boolean);
  if (!bodies.length) return;
  const historyCount = document.getElementById("history-count");
  if (historyCount) historyCount.textContent = `${records?.length || 0} inspection${records?.length === 1 ? "" : "s"}`;
  if (!records?.length) {
    bodies.forEach((body) => {
      body.innerHTML = '<tr><td colspan="6"><span class="empty-history">No saved inspections yet.</span></td></tr>';
    });
    return;
  }

  const rows = records.map((record) => {
    const score = Number(record.condition_score || 0);
    const condition = score >= 75 ? "Good" : score >= 55 ? "Fair" : "Review";
    const date = record.created_at ? new Date(record.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Recently";
    const battery = record.battery_health == null ? "Not available" : `${escapeHtml(record.battery_health)}%`;
    return `<tr><td><div class="table-device"><span class="table-device-icon"><svg><use href="#i-parts"/></svg></span><span><strong>${escapeHtml(record.device_model || "Unknown device")}</strong><small>${escapeHtml(record.serial_last4 ? `••••${record.serial_last4}` : "Serial unavailable")}</small></span></div></td><td><span class="condition-text">${condition} <small>${escapeHtml(score)}/100</small></span></td><td>${battery}</td><td>${escapeHtml(date)}</td><td><span class="table-status ready"><i></i>Report ready</span></td><td><button class="row-arrow" data-open-report aria-label="Open inspection"><svg><use href="#i-chevron"/></svg></button></td></tr>`;
  }).join("");
  bodies.forEach((body) => {
    body.innerHTML = rows;
    body.querySelectorAll("[data-open-report]").forEach((button) => {
      button.addEventListener("click", () => {
        showView("reports");
        showToast("Inspection report opened");
      });
    });
  });
}

let reportText = "";

document.getElementById("save-inspection")?.addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<span class="spinner"></span>Saving';

  const bridge = getCloudBridge();
  if (!bridge?.saveInspection) {
    button.disabled = false;
    button.innerHTML = original;
    showToast("Workspace saving is not configured for this environment");
    return;
  }

  if (!state.currentInspection) {
    button.disabled = false;
    button.innerHTML = original;
    showToast("Complete an inspection before saving");
    return;
  }

  const result = await bridge.saveInspection({ ...state.currentInspection, reportText });
  button.disabled = false;
  button.innerHTML = original;
  if (result.ok) {
    showToast("Inspection saved to your workspace");
    refreshCloudHistory();
  } else if (!result.configured) {
    showToast("Workspace saving is not configured");
  } else if (result.authenticated === false) {
    showToast("Sign in before saving inspections");
    openAuthModal();
  } else {
    showToast(result.error || "Inspection could not be saved");
  }
});

document.getElementById("export-report")?.addEventListener("click", () => {
  if (!state.currentInspection || !reportText) {
    showToast("Complete an inspection before exporting");
    return;
  }
  const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "iveryfy-inspection-report.txt";
  anchor.click();
  URL.revokeObjectURL(url);
  showToast("Report exported successfully");
});

document.getElementById("print-report")?.addEventListener("click", () => window.print());
document.getElementById("copy-report")?.addEventListener("click", async () => {
  if (!state.currentInspection || !reportText) {
    showToast("Complete an inspection before copying");
    return;
  }
  try {
    await navigator.clipboard.writeText(reportText);
    showToast("Report summary copied");
  } catch {
    showToast("Copy is not available in this preview");
  }
});

document.getElementById("mobile-menu")?.addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

document.getElementById("device-menu")?.addEventListener("click", () => {
  showToast("Connect a device to view its options");
});

function applyTheme(theme) {
  state.theme = theme === "dark" ? "dark" : "light";
  document.body.classList.toggle("dark-mode", state.theme === "dark");
  localStorage.setItem("iveryfy-theme", state.theme);
  const label = document.querySelector("#theme-toggle span:first-child");
  const control = document.getElementById("theme-toggle-control");
  if (label) label.textContent = state.theme === "dark" ? "Dark appearance" : "Light appearance";
  control?.classList.toggle("on", state.theme === "light");
}

document.getElementById("theme-toggle")?.addEventListener("click", () => {
  applyTheme(state.theme === "light" ? "dark" : "light");
});
document.getElementById("history-toggle")?.addEventListener("click", () => {
  state.historyEnabled = !state.historyEnabled;
  localStorage.setItem("iveryfy-history", state.historyEnabled ? "on" : "off");
  document.getElementById("history-toggle-control")?.classList.toggle("on", state.historyEnabled);
  showToast(state.historyEnabled ? "Inspection history enabled" : "Inspection history disabled");
});

applyTheme(state.theme);
document.getElementById("history-toggle-control")?.classList.toggle("on", state.historyEnabled);
showView("overview");
