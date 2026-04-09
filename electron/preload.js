// Preload script if strict contextIsolation is needed. 
// For this MVP, we set contextIsolation: false to directly use ipcRenderer in ui code for simplicity.
window.addEventListener('DOMContentLoaded', () => {
    console.log('Preload loaded');
});