const screens = document.querySelectorAll("[data-screen]");
const tabs = document.querySelectorAll("[data-tab]");
const brandState = document.querySelector("#brand-state");
const toast = document.querySelector(".toast");
const toastMessage = document.querySelector("#toast-message");
const uploadCard = document.querySelector(".upload-card");
const uploadHelp = document.querySelector("#upload-help");
const fileInput = document.querySelector("#model-file");
const chooseFileButton = document.querySelector("#choose-file");
const startPrintButton = document.querySelector("#start-print");
const statusCopy = document.querySelector("#status-copy");
const scanCard = document.querySelector("#scan-card");
const scanTitle = document.querySelector("#scan-title");
const scanCopy = document.querySelector("#scan-copy");

const screenStates = {
  studio: "Ready to print",
  queue: "One print running",
  materials: "Onyx PLA selected",
  care: "One gentle reminder",
};

let toastTimer;
let scanTimer;

window.addEventListener("load", () => {
  window.setTimeout(() => {
    document.body.classList.add("is-loaded");
  }, 900);
});

function showToast(message) {
  window.clearTimeout(toastTimer);
  toastMessage.textContent = message;
  toast.classList.add("is-visible");

  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2800);
}

function setActiveScreen(screenName) {
  screens.forEach((screen) => {
    screen.classList.toggle("is-active", screen.dataset.screen === screenName);
  });

  tabs.forEach((tab) => {
    const isActive = tab.dataset.tab === screenName;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  brandState.textContent = screenStates[screenName];
}

function showScanState(title, copy) {
  window.clearTimeout(scanTimer);
  scanTitle.textContent = title;
  scanCopy.textContent = copy;
  scanCard.hidden = false;

  scanTimer = window.setTimeout(() => {
    scanCard.hidden = true;
  }, 3200);
}

function handleModelFile(file) {
  uploadHelp.textContent = `${file.name} is ready. We will check the model before printing.`;
  statusCopy.textContent =
    "Model loaded. PrintForge will flag simple fixes before the job starts.";
  showScanState(
    "Checking your model",
    "Looking for thin walls, loose edges, and anything that could make the print fail."
  );
  showToast("Model added. The next check will be quick.");
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setActiveScreen(tab.dataset.tab);
  });
});

document.querySelectorAll("[data-quality]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-quality]").forEach((option) => {
      const isSelected = option === button;
      option.classList.toggle("is-selected", isSelected);
      option.setAttribute("aria-pressed", String(isSelected));
    });

    const label = button.textContent.trim();
    document.querySelector("#quality-title").textContent = `${label} quality`;
    showToast(`${label} quality selected.`);
  });
});

document.querySelectorAll("[data-material]").forEach((card) => {
  const button = card.querySelector(".select-button");

  button.addEventListener("click", () => {
    document.querySelectorAll("[data-material]").forEach((material) => {
      const isSelected = material === card;
      material.classList.toggle("is-selected", isSelected);
      material.querySelector(".select-button").textContent = isSelected
        ? "Using"
        : "Use";
      material
        .querySelector(".select-button")
        .setAttribute("aria-pressed", String(isSelected));
    });

    const materialName = card.querySelector(".card-title").textContent;
    brandState.textContent = `${materialName} selected`;
    showToast(`${materialName} is ready for your next print.`);
  });
});

document.querySelectorAll(".setting-row").forEach((row) => {
  row.addEventListener("click", () => {
    const isOn = row.getAttribute("aria-pressed") === "true";
    row.setAttribute("aria-pressed", String(!isOn));
    row.querySelector(".toggle").classList.toggle("is-on", !isOn);

    const settingName = row.querySelector(".card-title").textContent;
    const state = isOn ? "off" : "on";
    showToast(`${settingName} turned ${state}.`);
  });
});

chooseFileButton.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];

  if (!file) {
    return;
  }

  handleModelFile(file);
});

["dragenter", "dragover"].forEach((eventName) => {
  uploadCard.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadCard.classList.add("is-dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  uploadCard.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadCard.classList.remove("is-dragging");
  });
});

uploadCard.addEventListener("drop", (event) => {
  const file = event.dataTransfer.files[0];

  if (!file) {
    return;
  }

  handleModelFile(file);
});

startPrintButton.addEventListener("click", () => {
  statusCopy.textContent =
    "Starting soon. Keep the build plate clear and PrintForge will handle the checks.";
  brandState.textContent = "Preparing print";
  showScanState(
    "Preparing your print",
    "We are checking the printer, material, and first layer before it starts."
  );
  showToast("Preparing your print. We will tell you if anything needs attention.");
});
