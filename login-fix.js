/* SFS LOGIN FIX — Apps Script JSONP using the backend's supported `data` payload */
(function(){
  'use strict';

  const SFS_API='https://script.google.com/macros/s/AKfycbxL0yc-sfBcxnyuD1eYk4AlYY1xEoyMjjFLLAP_7XQPnVud-Otyndoj46ydPVYSKE02OQ/exec';
  window.SFS_CONFIG=window.SFS_CONFIG||{};
  window.SFS_CONFIG.API_URL=SFS_API;

  function request(action,data){
    return new Promise(function(resolve){
      const cb='sfs_cb_'+Date.now()+'_'+Math.random().toString(36).slice(2);
      const script=document.createElement('script');
      let finished=false;

      function finish(result){
        if(finished)return;
        finished=true;
        try{delete window[cb]}catch(e){window[cb]=undefined;}
        if(script.parentNode)script.parentNode.removeChild(script);
        resolve(result||{ok:false,error:'Empty server response'});
      }

      window[cb]=finish;
      script.onerror=function(){finish({ok:false,error:'Cannot reach Apps Script backend. Please check Web App deployment access.'});};

      // The deployed Code.gs reads p.data and JSON.parse(decodeURIComponent(p.data)).
      const payload=encodeURIComponent(JSON.stringify(data||{}));
      script.src=SFS_API+'?action='+encodeURIComponent(action)+'&data='+payload+'&callback='+encodeURIComponent(cb);
      document.head.appendChild(script);

      setTimeout(function(){
        if(!finished)finish({ok:false,error:'Apps Script connection timed out.'});
      },15000);
    });
  }

  window.login=async function(){
    const username=(document.getElementById('loginUser')?.value||'').trim();
    const password=document.getElementById('loginPass')?.value||'';
    const error=document.getElementById('loginError');

    if(!username||!password){
      if(error)error.textContent='Username and password are required.';
      return false;
    }

    if(error)error.textContent='Connecting…';
    const result=await request('login',{username:username,password:password});

    if(!result||!result.ok){
      if(error)error.textContent=(result&&result.error)||'Login failed.';
      return false;
    }

    sessionStorage.setItem('sfsSession',result.session||'');
    sessionStorage.setItem('sfsUser',JSON.stringify(result.user||{}));
    localStorage.setItem('sfsApiUrl',SFS_API);
    localStorage.setItem('sfsSession',result.session||'');
    localStorage.setItem('sfsUser',JSON.stringify(result.user||{}));

    window.location.reload();
    return true;
  };
})();
