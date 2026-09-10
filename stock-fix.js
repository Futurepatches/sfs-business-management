/* SFS STOCK FIELD COMPATIBILITY FIX
   Backend uses "Current Stock" while older frontend renderers use currentStock.
   Normalize both names at the API boundary. */
(function(){
  'use strict';
  var originalApi=window.api;
  if(typeof originalApi!=='function') return;
  window.api=async function(action,data){
    var r=await originalApi(action,data||{});
    if(r && Array.isArray(r.products)){
      r.products.forEach(function(p){
        if(p && p.currentStock===undefined) p.currentStock=p['Current Stock'] ?? p['TOTAL STOCK'] ?? p['Total Stock'] ?? 0;
      });
    }
    return r;
  };
})();