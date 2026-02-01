const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { dbInit, dbApi } = require("../shared/db");

let dataDir;

function resolvePortableDataDir() {
  // Optional override for debugging / power users:
  // LAPDASH_DATA_DIR="/some/path" npm start
  if (process.env.LAPDASH_DATA_DIR) return process.env.LAPDASH_DATA_DIR;

  // Always store data under project root ./data
  return path.join(app.getAppPath(), "data");
}

function ensureWritableDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const testFile = path.join(dir, ".write_test");
  fs.writeFileSync(testFile, "ok");
  fs.unlinkSync(testFile);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 820,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#f6f6f6",
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Prevent silent failures
  win.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.error("did-fail-load:", code, desc, url);
    dialog.showErrorBox("Load failed", `${code} ${desc}\n${url}`);
  });

  win.webContents.on("render-process-gone", (_e, details) => {
    console.error("render-process-gone:", details);
    dialog.showErrorBox("Renderer crashed", JSON.stringify(details, null, 2));
  });

  win.loadFile(path.join(__dirname, "../renderer/index.html"));

  // Uncomment for debugging:
  // win.webContents.openDevTools({ mode: "detach" });
}

app.whenReady().then(() => {
  dataDir = resolvePortableDataDir();
  ensureWritableDir(dataDir);
  dbInit(dataDir);

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

/**
 * IPC: DB API
 */
ipcMain.handle("db:listCircuits", () => dbApi.listCircuits());
ipcMain.handle("db:listGroupsForCircuit", (_e, circuitName) =>
  dbApi.listGroupsForCircuit(circuitName)
);
ipcMain.handle("db:getCircuit", (_e, circuitName) =>
  dbApi.getCircuit(circuitName)
);
ipcMain.handle("db:getWorldRecord", (_e, circuitName, groupName) =>
  dbApi.getWorldRecord(circuitName, groupName)
);
ipcMain.handle("db:listBestRecords", (_e, circuitName, groupName, limit = 10) =>
  dbApi.listBestRecords(circuitName, groupName, limit)
);
ipcMain.handle("db:insertBestRecord", (_e, payload) =>
  dbApi.insertBestRecord(payload)
);

ipcMain.handle("file:saveCurrentPaceMarkdown", (_e, payload) => {
  const { markdown = "", circuitName = "", groupName = "" } = payload || {};
  const safe = (value) =>
    String(value || "unknown")
      .replace(/[^a-z0-9_-]+/gi, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `current_pace_${safe(circuitName)}_${safe(groupName)}_${stamp}.md`;
  const outPath = path.join(dataDir, filename);
  fs.writeFileSync(outPath, String(markdown), "utf8");
  return { path: outPath, filename };
});
