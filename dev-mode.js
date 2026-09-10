/* SFS DEVELOPMENT MODE — temporary login bypass while ERP is being completed. */
(function(){
  'use strict';
  sessionStorage.setItem('sfsSession','DEV_MODE');
  sessionStorage.setItem('sfsUser',JSON.stringify({id:'DEV-000001',name:'Administrator',username:'admin',role:'ADMIN',status:'Active'}));
})();