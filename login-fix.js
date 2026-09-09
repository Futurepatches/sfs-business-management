/* SFS LOGIN FIX — reliable JSONP login + session handoff */
(function(){
  'use strict';
  const SFS_API=(window.SFS_CONFIG&&window.SFS_CONFIG.API_URL)||'https://script.google.com/macros/s/AKfycbxL0yc-sfBcxnyuD1eYk4AlYY1xEoyMjjFLLAP_7XQPnVud-Otyndoj46ydPVYSKE02OQ/exec';
  window.SFS_CONFIG=window.SFS_CONFIG||{};
  window.SFS_CONFIG.API_URL=SFS_API;

  function jsonp(action,data){
    return new Promise(function(resolve){
      const cb='sfs_cb_'+Date.now()+'_'+Math.random().toString(36).slice(2);
      const script=document.createElement('script');
      let done=false;
      function finish(result){
        if(done)return; done=true;
        try{delete window[cb]}catch(e){window[cb]=undefined}
        if(script.parentNode)script.parentNode.removeChild(script);
        resolve(result||{ok:false,error:'Empty server response'});
      }
      window[cb]=finish;
      script.onerror=function(){finish({ok:false,error:'Unable to connect to the SFS server.'})};
      const q=new URLSearchParams();
      q.set('action',action); q.set('callback',cb);
      Object.keys(data||{}).forEach(function(k){q.set(k,String(data[k]??''))});
      script.src=SFS_API+'?'+q.toString();
      document.head.appendChild(script);
      setTimeout(function(){if(!done)finish({ok:false,error:'Server connection timed out.'})},15000);
    });
  }

  window.login=async function(){
    const username=(document.getElementById('loginUser')?.value||'').trim();
    const password=document.getElementById('loginPass')?.value||'';
    const error=document.getElementById('loginError');
    if(!username||!password){if(error)error.textContent='Username and password are required.';return false;}
    if(error)error.textContent='Signing in…';
    const result=await jsonp('login',{username:username,password:password});
    if(!result||!result.ok){if(error)error.textContent=result?.error||'Login failed.';return false;}

    sessionStorage.setItem('sfsSession',result.session||'');
    sessionStorage.setItem('sfsUser',JSON.stringify(result.user||{}));
    localStorage.setItem('sfsApiUrl',SFS_API);
    localStorage.setItem('sfsSession',result.session||'');
    localStorage.setItem('sfsUser',JSON.stringify(result.user||{}));

    // app.js owns the actual state. Reloading lets its normal init path
    // consume the persisted session instead of trying to modify its lexical `S`.
    window.location.reload();
    return true;
  };
})();
