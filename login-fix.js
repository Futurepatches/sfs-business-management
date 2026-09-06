/* SFS LOGIN/API FIX — uses the deployed Apps Script endpoint directly and avoids CORS by using JSONP GET. */
(function(){
  const SFS_API='https://script.google.com/macros/s/AKfycbxL0yc-sfBcxnyuD1eYk4AlYY1xEoyMjjFLLAP_7XQPnVud-Otyndoj46ydPVYSKE02OQ/exec';
  window.SFS_CONFIG=window.SFS_CONFIG||{};
  window.SFS_CONFIG.API_URL=SFS_API;
  if(window.S) window.S.api=SFS_API;

  function sfsJSONP(action,data){
    return new Promise(function(resolve){
      const cb='sfs_login_'+Date.now()+'_'+Math.random().toString(36).slice(2);
      const script=document.createElement('script');
      let finished=false;
      function cleanup(){try{delete window[cb]}catch(e){window[cb]=undefined}if(script.parentNode)script.parentNode.removeChild(script)}
      window[cb]=function(result){if(finished)return;finished=true;cleanup();resolve(result||{ok:false,error:'Empty server response'})};
      script.onerror=function(){if(finished)return;finished=true;cleanup();resolve({ok:false,error:'Cannot reach Apps Script backend. Please check Web App deployment access.'})};
      const q=new URLSearchParams({action:action,callback:cb});
      if(data){Object.keys(data).forEach(k=>q.set(k,String(data[k]??'')))}
      script.src=SFS_API+'?'+q.toString();
      document.head.appendChild(script);
      setTimeout(function(){if(!finished){finished=true;cleanup();resolve({ok:false,error:'Apps Script connection timed out.'})}},12000);
    });
  }

  window.login=async function(){
    const user=(document.getElementById('loginUser')?.value||'').trim();
    const pass=document.getElementById('loginPass')?.value||'';
    const err=document.getElementById('loginError');
    if(!user||!pass){if(err)err.textContent='Username and password are required.';return;}
    if(err)err.textContent='Connecting…';
    const r=await sfsJSONP('login',{username:user,password:pass});
    if(!r||!r.ok){if(err)err.textContent=(r&&r.error)||'Login failed. Backend did not respond.';return;}
    window.S.api=SFS_API;
    window.S.session=r.session;
    window.S.user=r.user;
    sessionStorage.sfsSession=r.session;
    if(typeof window.enter==='function')window.enter();
  };
})();
