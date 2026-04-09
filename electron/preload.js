const { contextBridge, ipcRenderer } = require('electron');

const validReceiveChannels = [
    'stats-data',
    'distraction-log-update',
    'active-app-update',
    'extension-distraction'
];

contextBridge.exposeInMainWorld('focusGuardian', {
    send(channel, payload) {
        const allowed = [
            'set-focus-mode',
            'get-stats',
            'request-distraction-log',
            'cv-distraction-event',
            'add-distraction'
        ];

        if (!allowed.includes(channel)) return;
        ipcRenderer.send(channel, payload);
    },

    on(channel, callback) {
        if (!validReceiveChannels.includes(channel)) return () => {};

        const listener = (_event, payload) => callback(payload);
        ipcRenderer.on(channel, listener);
        return () => ipcRenderer.removeListener(channel, listener);
    },

    invoke(channel, payload) {
        const allowed = [
            'buy-focus-shield',
            'save-calibration',
            'get-calibration',
            'get-runtime-config'
        ];

        if (!allowed.includes(channel)) {
            return Promise.resolve(null);
        }

        return ipcRenderer.invoke(channel, payload);
    }
});