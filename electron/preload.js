const { contextBridge, ipcRenderer } = require("electron");
const { parseMs, fmtMs } = require("../shared/time");

contextBridge.exposeInMainWorld("api", {
  // time helpers
  parseMs: (s) => parseMs(s),
  fmtMs: (ms) => fmtMs(ms),

  // db
  listCircuits: () => ipcRenderer.invoke("db:listCircuits"),
  listGroupsForCircuit: (circuitName) =>
    ipcRenderer.invoke("db:listGroupsForCircuit", circuitName),
  getCircuit: (circuitName) => ipcRenderer.invoke("db:getCircuit", circuitName),
  getWorldRecord: (circuitName, groupName) =>
    ipcRenderer.invoke("db:getWorldRecord", circuitName, groupName),
  listBestRecords: (circuitName, groupName, limit) =>
    ipcRenderer.invoke("db:listBestRecords", circuitName, groupName, limit),
  insertBestRecord: (payload) => ipcRenderer.invoke("db:insertBestRecord", payload),
  saveCurrentPaceMarkdown: (payload) =>
    ipcRenderer.invoke("file:saveCurrentPaceMarkdown", payload),
  getDataDir: () => ipcRenderer.invoke("app:getDataDir")
});
