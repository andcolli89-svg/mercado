'use strict';
(function () {
  function bridge() { return window.Android || null; }
  function status() {
    const node = document.getElementById('calibrationStatus');
    if (!node) return;
    try {
      const data = JSON.parse(bridge()?.getAutomationCalibration?.() || '{}');
      const group = data.group ? '✅ Grupo salvo' : '❌ Grupo não calibrado';
      const send = data.send ? '✅ Seta salva' : '❌ Seta não calibrada';
      node.textContent = `${group} • ${send}`;
    } catch (_) {
      node.textContent = 'Não foi possível verificar a calibração.';
    }
  }
  function start(mode) {
    bridge()?.startAutomationCalibration?.(mode);
    const node = document.getElementById('calibrationStatus');
    if (node) node.textContent = mode === 'send'
      ? 'Abra o WhatsApp Business e toque uma vez na seta preta.'
      : 'Abra o WhatsApp Business e toque uma vez no grupo desejado.';
  }
  document.addEventListener('click', event => {
    if (event.target.closest?.('#calibrateGroupBtn')) start('group');
    if (event.target.closest?.('#calibrateSendBtn')) start('send');
    if (event.target.closest?.('#clearCalibrationBtn')) {
      bridge()?.clearAutomationCalibration?.();
      setTimeout(status, 250);
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) setTimeout(status, 400);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', status);
  else status();
})();
