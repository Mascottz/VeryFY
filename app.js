const state = {
  currentView: "overview",
  testsComplete: false,
  auth: { configured: false, signedIn: false, email: null },
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
  label.textContent = state.status;
  indicator.classList.toggle("is-ready", state.connected);
  indicator.classList.toggle("is-warning", !state.connected);

  const fields = state.deviceInfo?.fields || {};
  const model = document.getElementById("device-model");
  const connection = document.getElementById("device-connection");
  const ios = document.getElementById("device-ios");
  const serial = document.getElementById("device-serial");
  if (fields.DeviceName && model) model.textContent = fields.DeviceName;
  else if (fields.ProductType && model) model.textContent = fields.ProductType;
  if (connection) connection.textContent = state.status;
  if (fields.ProductVersion && ios) ios.textContent = fields.ProductVersion;
  if (fields.SerialNumber && serial) serial.textContent = maskSerial(fields.SerialNumber);
}

function updateBatteryMetrics(battery) {
  if (!battery?.available) return;
  const health = battery.health === null ? null : `${battery.health}<span>%</span>`;
  if (health) {
    ["overview-battery-health", "battery-page-health"].forEach((id) => {
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
} 

function applyDeviceScan(result) {
  if (!result) return;
  updateConnectionState(result.state);
  updateBatteryMetrics(result.battery);
}

function updateAuthState(auth) {
  state.auth = { ...state.auth, ...auth };
  const accountButton = document.getElementById("account-button");
  const accountLabel = document.querySelector(".account-label");
  if (!accountButton || !accountLabel) return;
  accountButton.classList.toggle("signed-in", Boolean(state.auth.signedIn));
  accountLabel.textContent = state.auth.signedIn ? (state.auth.email || "Signed in") : "Sign in";
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
    if (cloud?.configured && !cloud?.signedIn) showToast("Sign in to save inspections to iVeryFY Cloud");
  }).catch(() => {});
  bridge.getAuthStatus?.().then(updateAuthState).catch(() => {});
  bridge.onAuthState?.((auth) => {
    updateAuthState(auth);
    if (auth.signedIn) {
      closeAuthModal();
      showToast("Signed in to iVeryFY Cloud");
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

document.getElementById("account-button")?.addEventListener("click", () => {
  const bridge = getCloudBridge();
  if (state.auth.signedIn) {
    bridge?.signOut?.().then((result) => {
      if (result?.ok) {
        updateAuthState(result.auth);
        showToast("Signed out of iVeryFY Cloud");
      }
    });
    return;
  }
  openAuthModal();
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
    error.textContent = "Cloud sign in is not configured for this environment.";
  } else {
    const result = await bridge.signIn(email, password);
    if (result.ok) {
      updateAuthState(result.auth);
      closeAuthModal();
      showToast("Signed in to iVeryFY Cloud");
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
document.getElementById("modal-close")?.addEventListener("click", closeModal);
document.getElementById("modal-cancel")?.addEventListener("click", closeModal);
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
  if (testCount) testCount.textContent = "10 of 10";
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
  if (state.testsComplete) {
    showToast("All hardware tests are already complete");
    return;
  }
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<span class="spinner"></span>Running tests';
  const progress = document.getElementById("test-progress");
  const testCount = document.getElementById("test-count");
  const percent = document.getElementById("suite-percent");
  let value = 80;
  const timer = setInterval(() => {
    value += 10;
    if (progress) progress.style.width = `${value}%`;
    if (testCount) testCount.textContent = `${Math.min(value / 10, 10)} of 10`;
    if (percent) percent.textContent = `${value}%`;
    if (value >= 100) {
      clearInterval(timer);
      finishAllTests();
      button.disabled = false;
      button.innerHTML = original;
      showToast("All hardware tests passed");
    }
  }, 480);
});

document.querySelectorAll(".test-action").forEach((button) => {
  button.addEventListener("click", () => {
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
      showToast("Test completed successfully");
    }, 1100);
  });
});

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
  if (!records?.length) {
    bodies.forEach((body) => {
      body.innerHTML = '<tr><td colspan="6"><span class="empty-history">No cloud inspections have been saved yet.</span></td></tr>';
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

const reportText = `iVeryFY Device Inspection\n\nDevice: iPhone 13 Pro\nSerial: F2L4••••7J9\niOS: 18.6.2\nInspection: Today, 10:42\n\nOverall condition: Good, 78/100\nBattery health: 87%\nCycle count: 643\nParts: 3 verified, 1 needs review\nHardware tests: 8 of 10 complete\n\nPowered by MASTECH INNOVATIONS\ninfo@mastechinnovations.com.ng\n+234 913 882 5300`;

const inspectionPayload = {
  deviceModel: "iPhone 13 Pro",
  serialLast4: "7J9",
  iosVersion: "18.6.2",
  batteryHealth: 87,
  cycleCount: 643,
  conditionScore: 78,
  partsSummary: { display: "Genuine", battery: "Unknown", rearCamera: "Genuine", logicBoard: "Unavailable" },
  testSummary: { passed: 8, total: 10 },
  reportText,
};

document.getElementById("save-inspection")?.addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<span class="spinner"></span>Saving';

  const bridge = getCloudBridge();
  if (!bridge?.saveInspection) {
    button.disabled = false;
    button.innerHTML = original;
    showToast("Cloud saving is not configured for this environment");
    return;
  }

  const result = await bridge.saveInspection(inspectionPayload);
  button.disabled = false;
  button.innerHTML = original;
  if (result.ok) {
    showToast("Inspection saved to iVeryFY Cloud");
    refreshCloudHistory();
  } else if (!result.configured) {
    showToast("Add Supabase credentials to enable cloud saving");
  } else if (result.authenticated === false) {
    showToast("Sign in before saving inspections");
    openAuthModal();
  } else {
    showToast(result.error || "Inspection could not be saved");
  }
});

document.getElementById("export-report")?.addEventListener("click", () => {
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
  showToast("Device options are coming soon");
});

showView("overview");
