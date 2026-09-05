/* Bridge newer ERP frontend actions onto the existing stable Apps Script API. */
(function(){
  const baseApi=window.api;
  window.api=async function(action,data){
    if(action==='getPrice') return baseApi('getReports',Object.assign({},data,{mode:'price'}));
    if(action==='getDocumentHistory') return baseApi('getReports',Object.assign({},data,{mode:'docs'}));
    if(action==='getDocument') return baseApi('getReports',Object.assign({},data,{mode:'document'}));
    return baseApi(action,data||{});
  };
})();
