import "./style.css";
import { checkAuth, doLogin, generate } from "./api";

const grid = document.getElementById("image-grid")!;
const emptyState = document.getElementById("empty-state")!;
const promptInput = document.getElementById("prompt-input") as HTMLInputElement;
const submitBtn = document.getElementById("submit-btn")!;
const fileInput = document.getElementById("file-input") as HTMLInputElement;
const fileBtn = document.getElementById("file-btn")!;
const fileCount = document.getElementById("file-count")!;
const authBanner = document.getElementById("auth-banner")!;
const loginBtn = document.getElementById("login-btn")!;
const toast = document.getElementById("toast")!;

let generating = false;

// Check auth on load
checkAuthStatus();

// Submit on Enter
promptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleGenerate();
  }
});

// Wire up buttons
submitBtn.addEventListener("click", handleGenerate);
loginBtn.addEventListener("click", handleLogin);
fileBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", onFilesChanged);

function onFilesChanged() {
  const count = fileInput.files?.length ?? 0;
  fileBtn.classList.toggle("has-files", count > 0);
  fileCount.textContent = String(count);
}

async function checkAuthStatus() {
  try {
    const data = await checkAuth();
    authBanner.classList.toggle("visible", !data.authenticated);
  } catch {
    // Server may be down
  }
}

async function handleLogin() {
  loginBtn.setAttribute("disabled", "");
  loginBtn.textContent = "Opening browser...";
  try {
    const data = await doLogin();
    if (data.success) {
      authBanner.classList.remove("visible");
    } else {
      showToast(data.error || "Login failed");
    }
  } catch {
    showToast("Login request failed");
  } finally {
    loginBtn.removeAttribute("disabled");
    loginBtn.textContent = "Login with Google";
  }
}

async function handleGenerate() {
  const prompt = promptInput.value.trim();
  if (!prompt || generating) return;

  generating = true;
  submitBtn.setAttribute("disabled", "");
  submitBtn.innerHTML = '<div class="spinner"></div>';

  try {
    const data = await generate(prompt, fileInput.files);

    if (!data.images || data.images.length === 0) {
      showToast("No images returned");
      return;
    }

    // Hide empty state
    emptyState.style.display = "none";

    // Add images to grid (newest first)
    for (const img of data.images) {
      const blob = base64ToBlob(img.base64, img.mime);
      const url = URL.createObjectURL(blob);

      const tile = document.createElement("div");
      tile.className = "tile";
      tile.addEventListener("click", () => window.open(url, "_blank"));

      const imgEl = document.createElement("img");
      imgEl.src = url;
      imgEl.alt = img.filename;

      const overlay = document.createElement("div");
      overlay.className = "overlay";
      const dims = img.dimensions
        ? ` \u2022 ${img.dimensions[0]}\u00D7${img.dimensions[1]}`
        : "";
      overlay.textContent = `${img.filename}${dims}`;

      tile.appendChild(imgEl);
      tile.appendChild(overlay);
      grid.prepend(tile);
    }

    // Clear inputs
    promptInput.value = "";
    fileInput.value = "";
    onFilesChanged();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Request failed";
    showToast(message);
    checkAuthStatus();
  } finally {
    generating = false;
    submitBtn.removeAttribute("disabled");
    submitBtn.innerHTML = "&#10148;";
  }
}

function base64ToBlob(b64: string, mime: string): Blob {
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function showToast(msg: string) {
  toast.textContent = msg;
  toast.classList.add("visible");
  setTimeout(() => toast.classList.remove("visible"), 5000);
}
