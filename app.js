// ======================= MAINTENANCE MODE =======================

const MAINTENANCE_MODE = false;

function showMaintenance() {
  document.body.innerHTML = `
    <div style="
      min-height:100vh;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:40px 20px;
      background:#0b0f19;
      color:#fff;
      font-family:Ubuntu, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      text-align:center;
    ">
      <div style="max-width:640px;">
        <div style="font-size:42px; line-height:1; margin-bottom:14px;">🛠️</div>
        <h2 style="margin:0 0 12px 0; font-size:28px;">Идут технические работы</h2>
        <p style="margin:0; font-size:18px; opacity:.9; line-height:1.5;">
          Сейчас сервис временно недоступен. Пожалуйста, попробуйте повторить позже.
        </p>
        <button onclick="location.reload()" style="
          margin-top:26px;
          padding:14px 22px;
          font-size:16px;
          border-radius:10px;
          border:none;
          cursor:pointer;
        ">Обновить</button>
      </div>
    </div>
  `;
}

if (MAINTENANCE_MODE) {
  showMaintenance();
  throw new Error("Maintenance mode enabled");
}

// ======================= APP =======================

console.log("app-vk.js loaded");
console.log("window.vkBridge =", window.vkBridge);

const WEBHOOK_URL = "https://webhooks.fut.ru/ft-dispather/requests";
const STAGE_NAME = "Таблица (вид) - ТЗ";

let platformUserId = null;
const uploadState = { 1: false, 2: false, 3: false };
const selectedFiles = { 1: null, 2: null, 3: null };

const screens = {
  welcome: document.getElementById("welcomeScreen"),
  upload1: document.getElementById("uploadScreen1"),
  upload2: document.getElementById("uploadScreen2"),
  upload3: document.getElementById("uploadScreen3"),
  result: document.getElementById("resultScreen"),
};

function showScreen(id) {
  Object.values(screens).forEach((s) => s?.classList.add("hidden"));
  screens[id]?.classList.remove("hidden");
}

function showError(msg) {
  document.body.innerHTML = `<div style="padding:50px;text-align:center;color:white;">
    <h2>Ошибка</h2>
    <p style="font-size:18px;margin:30px 0;">${msg}</p>
    <button onclick="location.reload()" style="padding:15px 30px;font-size:17px;">Обновить</button>
  </div>`;
}

async function initVKApp() {
  const bridge = window.vkBridge;

  if (!bridge) {
    throw new Error("VK Bridge не найден. Откройте мини-апп из VK.");
  }

  await bridge.send("VKWebAppInit");
  const vkUser = await bridge.send("VKWebAppGetUserInfo");

  platformUserId = vkUser?.id || null;

  if (!platformUserId) {
    throw new Error("Не удалось получить VK user id.");
  }

  console.log("VK initialized", platformUserId);
  showScreen("welcome");
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initVKApp();
  } catch (err) {
    console.error("Init error:", err);
    showError(err.message || "Ошибка приложения");
  }
});

async function sendFiles() {
  const form = new FormData();

  form.append("params[vk_id]", String(platformUserId || ""));
  form.append("params[stage_name]", STAGE_NAME);
  form.append("params[deadline_tz_1]", new Date().toISOString());

  if (selectedFiles[1]) form.append("params[file_1]", selectedFiles[1]);
  if (selectedFiles[2]) form.append("params[file_2]", selectedFiles[2]);
  if (selectedFiles[3]) form.append("params[file_3]", selectedFiles[3]);

  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error("Ошибка отправки: " + res.status + " " + text);
  }

  return res;
}

async function showProgress(barId, statusId) {
  const bar = document.getElementById(barId);
  const status = document.getElementById(statusId);
  let p = 0;

  return new Promise((resolve) => {
    const int = setInterval(() => {
      p += 15 + Math.random() * 25;

      if (p >= 100) {
        p = 100;
        clearInterval(int);
        status.textContent = "Готово!";
        resolve();
      }

      bar.style.width = p + "%";
      status.textContent = `Загрузка ${Math.round(p)}%`;
    }, 100);
  });
}

document.getElementById("startUpload")?.addEventListener("click", () => {
  showScreen("upload1");
});

async function handleUpload(num, nextScreen = null) {
  if (uploadState[num]) {
    console.log(`Загрузка #${num} уже идёт — повторный клик игнорируем`);
    return;
  }

  const input = document.getElementById(`fileInput${num}`);
  const err = document.getElementById(`error${num}`);
  const btn = document.getElementById(`submitFile${num}`);
  const file = input?.files?.[0];

  err?.classList.add("hidden");

  if (!file) {
    err.textContent = "Выберите файл";
    err.classList.remove("hidden");
    return;
  }

  if (file.size > 15 * 1024 * 1024) {
    err.textContent = "Файл больше 15 МБ";
    err.classList.remove("hidden");
    return;
  }

  uploadState[num] = true;

  if (btn) {
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.textContent = "Сохраняем...";
  }

  try {
    selectedFiles[num] = file;

    await showProgress(`progress${num}`, `status${num}`);

    if (nextScreen) {
      showScreen(nextScreen);
    } else {
      await sendFiles();
      showScreen("result");
    }
  } catch (e) {
    console.error(e);
    err.textContent = e.message || "Ошибка загрузки";
    err.classList.remove("hidden");
  } finally {
    uploadState[num] = false;

    if (btn) {
      btn.disabled = false;
      if (btn.dataset.originalText) {
        btn.textContent = btn.dataset.originalText;
      }
    }
  }
}

document.getElementById("submitFile1")?.addEventListener("click", () =>
  handleUpload(1, "upload2")
);

document.getElementById("submitFile2")?.addEventListener("click", () =>
  handleUpload(2, "upload3")
);

document.getElementById("submitFile3")?.addEventListener("click", () =>
  handleUpload(3)
);

document.getElementById("skipFile2")?.addEventListener("click", () =>
  showScreen("upload3")
);

document.getElementById("skipFile3")?.addEventListener("click", async () => {
  const err = document.getElementById("error3");

  try {
    err?.classList.add("hidden");
    await sendFiles();
    showScreen("result");
  } catch (e) {
    console.error(e);
    if (err) {
      err.textContent = e.message || "Ошибка отправки";
      err.classList.remove("hidden");
    }
  }
});

document.getElementById("closeApp")?.addEventListener("click", () => {
  if (window.vkBridge) {
    window.vkBridge.send("VKWebAppClose", { status: "success" });
  }
});
