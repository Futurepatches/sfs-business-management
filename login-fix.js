/* SFS LOGIN FIX — use the main API transport; do not override it with broken JSONP */
(function(){
  'use strict';
  const SFS_API='https://script.google.com/macros/s/AKfycbxL0yc-sfBcxnyuD1eYk4AlYY1xEoyMjjFLLAP_7XQPnVud-Otyndoj46ydPVYSKE02OQ/exec';
  window.SFS_CONFIG=window.SFS_CONFIG||{};
  window.SFS_CONFIG.API_URL=SFS_API;
  /* app.js owns login(). This file only keeps the canonical backend URL. */
})();