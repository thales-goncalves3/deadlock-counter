const { contextBridge, ipcRenderer } = require('electron');

const call = async (name, arg) => {
  const r = await ipcRenderer.invoke(name, arg);
  if (!r.ok) throw new Error(r.error);
  return r.data;
};

contextBridge.exposeInMainWorld('dc', {
  assets: () => call('assets'),
  analyze: (q) => call('analyze', q),
  prefetch: (heroId) => call('prefetch', heroId),
  detect: () => call('detect'),
  getCfg: () => call('cfg:get'),
  setCfg: (patch) => call('cfg:set', patch),
  setMode: (m) => call('mode', m),
  quit: () => call('quit'),
  onMode: (fn) => ipcRenderer.on('mode', (_e, m) => fn(m)),
});
