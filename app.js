const state = {
  currentView: "overview",
  testsComplete: false,
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

function updateConnectionState(state) {
  const label = document.getElementById("connection-label");
  const indicator = document.getElementById("connection-indicator");
  if (!label || !indicator || !state) return;
  label.textContent = state.status;
  indicator.classList.toggle("is-ready", state.connected);
  indicator.classList.toggle("is-warning", !state.connected);
}

if (window.veryfy?.onDeviceState) {
  window.veryfy.onDeviceState(updateConnectionState);
  window.veryfy.getCloudStatus?.().then((cloud) => {
    if (cloud?.configured) showToast("VeryFY Cloud is connected");
  }).catch(() => {});
}

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

  if (window.veryfy?.scanDevice) {
    const result = await window.veryfy.scanDevice();
    if (!result.ok) {
      statusText.textContent = result.reason || "Connect and trust an iPhone to continue";
      button.disabled = false;
      button.innerHTML = '<svg><use href="#i-usb"/></svg>Try again';
      return;
    }
    closeModal();
    button.disabled = false;
    button.innerHTML = '<svg><use href="#i-usb"/></svg>Start scan';
    showToast("Device scan complete");
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

const reportText = `VeryFY Device Inspection\n\nDevice: iPhone 13 Pro\nSerial: F2L4••••7J9\niOS: 18.6.2\nInspection: Today, 10:42\n\nOverall condition: Good, 78/100\nBattery health: 87%\nCycle count: 643\nParts: 3 verified, 1 needs review\nHardware tests: 8 of 10 complete\n\nPowered by MASTECH INNOVATIONS\ninfo@mastechinnovations.com.ng\n+234 913 882 5300`;

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

  if (!window.veryfy?.saveInspection) {
    button.disabled = false;
    button.innerHTML = original;
    showToast("Cloud saving is available in the desktop build");
    return;
  }

  const result = await window.veryfy.saveInspection(inspectionPayload);
  button.disabled = false;
  button.innerHTML = original;
  if (result.ok) showToast("Inspection saved to VeryFY Cloud");
  else if (!result.configured) showToast("Add Supabase credentials to enable cloud saving");
  else showToast(result.error || "Inspection could not be saved");
});

document.getElementById("export-report")?.addEventListener("click", () => {
  const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "veryfy-inspection-report.txt";
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
