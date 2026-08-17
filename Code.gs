const SOURCE = {
  stock: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSS4E1DvaV4RzuMHMENiroSR4WYZjT0usnqAgUwX-W44ADM-sB1Gz8lYNvK51-WP88BYi4lYLxwZaU3/pub?gid=1719776219&single=true&output=csv',
  imports: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSS4E1DvaV4RzuMHMENiroSR4WYZjT0usnqAgUwX-W44ADM-sB1Gz8lYNvK51-WP88BYi4lYLxwZaU3/pub?gid=1389271409&single=true&output=csv',
  returns: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSS4E1DvaV4RzuMHMENiroSR4WYZjT0usnqAgUwX-W44ADM-sB1Gz8lYNvK51-WP88BYi4lYLxwZaU3/pub?gid=1032386368&single=true&output=csv'
};
const CATS = ['Airline Equipment','Valves','Cylinder','Fittings/Tubing','Others'];
const SHEETS = {
  Products:['Product ID','Model / Part No.','Description','Category','Brand','Unit','Location','Cost Price','Sale Price','Opening/Source Stock','Current Stock','Product Image','Remarks','Status','Created By','Created At','Updated By','Updated At'],
  Inward:['ID','Date','Source Type','Model / Part No.','Description','Category','Quantity','Purchase Cost','Supplier','Supplier Reference','Remarks','Created By','Created At'],
  StockTransactions:['ID','Date','Type','Model / Part No.','Description','Category','Qty IN','Qty OUT','Party','Reference','Document Type','Created By','Created At','Remarks'],
  DeliveryChallans:['DC No.','Date','Customer','Customer ID','PO No.','PO Date','STN','NTN','Address','Items JSON','Total Qty','Status','Created By','Created At'],
  Invoices:['Invoice No.','Date','Customer','PO No.','PO Date','DC No.','DC Date','STN','NTN','Items JSON','Subtotal','Status','Created By','Created At'],
  Customers:['Customer ID','Name','Contact Person','Phone','Email','Address','City','NTN','STN','Remarks','Status','Created At','Created By'],
  Suppliers:['Supplier ID','Name','Contact Person','Phone','Email','Address','City','NTN','STN','Remarks','Status','Created At','Created By'],
  Users:['User ID','Name','Username','Password Hash','Role','Phone','Email','Status','Created At','Last Login'],
  AuditLog:['ID','DateTime','Username','Name','Action','Document Type','Document No.','Details'],
  Categories:['Category'],
  SourceStock:[], SourceImports:[], SourceReturns:[]
};

function setupDatabase(){
  Object.keys(SHEETS).forEach(n=>{
    const sh=getOrCreate_(n);
    if(SHEETS[n].length && sh.getLastRow()===0) sh.getRange(1,1,1,SHEETS[n].length).setValues([SHEETS[n]]);
  });
  const cat=getOrCreate_('Categories'); cat.clearContents(); cat.getRange(1,1,CATS.length+1,1).setValues([['Category'],...CATS.map(x=>[x])]);
  ensureAdmin_(); refreshSource_();
  return {ok:true,message:'Database ready. Source sheets refreshed; original live source is read-only.'};
}
function refreshSource_(){
  writeCsv_('SourceStock', SOURCE.stock);
  writeCsv_('SourceImports', SOURCE.imports);
  writeCsv_('SourceReturns', SOURCE.returns);
  syncProductsFromSource_();
}
function writeCsv_(sheetName,url){
  const text=UrlFetchApp.fetch(url,{muteHttpExceptions:true}).getContentText();
  const rows=Utilities.parseCsv(text);
  const sh=getOrCreate_(sheetName); sh.clearContents();
  if(rows.length && rows[0].length) sh.getRange(1,1,rows.length,rows[0].length).setValues(rows);
}
function syncProductsFromSource_(){
  const src=getOrCreate_('SourceStock').getDataRange().getValues(); if(src.length<2)return;
  const h=src[0].map(norm_);
  const idx=(names)=>{for(const n of names){const i=h.indexOf(norm_(n));if(i>=0)return i;}return -1;};
  const im=idx(['model / part no.','model','part no.','part number']);
  const idesc=idx(['description']); const iloc=idx(['location']); const iimg=idx(['image','product image','image url']);
  const istock=idx(['stock','current stock','total stock','qty']); const icost=idx(['cost price','purchase cost','cost']);
  const sh=getOrCreate_('Products'); const existing=readObjects_(sh); const byModel={}; existing.forEach(x=>{if(x['Model / Part No.'])byModel[String(x['Model / Part No.'])]=x;});
  const out=[SHEETS.Products];
  for(let r=1;r<src.length;r++){
    const model=String(src[r][im]??'').trim(); if(!model)continue;
    const old=byModel[model]||{}; const row=[]; const sourceStock=toNum_(istock>=0?src[r][istock]:0);
    const image=iimg>=0?src[r][iimg]:'';
    row.push(old['Product ID']||('P-'+String(r).padStart(6,'0')),model,idesc>=0?src[r][idesc]:'',old['Category']||'Others',old['Brand']||'',old['Unit']||'Pcs',iloc>=0?src[r][iloc]:'',icost>=0?src[r][icost]:'',old['Sale Price']||'',sourceStock,sourceStock,image||old['Product Image']||'',old['Remarks']||'',old['Status']||'Active',old['Created By']||'SYSTEM',old['Created At']||new Date(),old['Updated By']||'SYSTEM',old['Updated At']||new Date());
    out.push(row);
  }
  sh.clearContents(); sh.getRange(1,1,out.length,SHEETS.Products.length).setValues(out);
}
function doGet(){return json_({ok:true,service:'SFS Business Management API',time:new Date().toISOString()});}
function doPost(e){try{const p=JSON.parse(e.postData.contents||'{}'); const action=p.action||''; if(action==='login')return json_(login_(p)); const session=auth_(p.session); if(!session)return json_({ok:false,error:'Unauthorized'});
  switch(action){
    case 'bootstrap': return json_(bootstrap_(session));
    case 'setupDatabase': return json_(isAdmin_(session)?setupDatabase():{ok:false,error:'Admin only'});
    case 'refreshSource': return json_(isAdmin_(session)?(refreshSource_(),{ok:true}):{ok:false,error:'Admin only'});
    case 'saveProduct': return json_(saveProduct_(p,session));
    case 'saveInward': return json_(saveInward_(p,session));
    case 'saveDC': return json_(saveDC_(p,session));
    case 'saveInvoice': return json_(saveInvoice_(p,session));
    case 'saveCustomer': return json_(saveParty_(p,session,'Customer'));
    case 'saveSupplier': return json_(saveParty_(p,session,'Supplier'));
    case 'getLedger': return json_(getLedger_(p,session));
    case 'getReports': return json_(getReports_(p,session));
    case 'listUsers': return json_(isAdmin_(session)?listUsers_():{ok:false,error:'Admin only'});
    case 'saveUser': return json_(isAdmin_(session)?saveUser_(p,session):{ok:false,error:'Admin only'});
    case 'disableUser': return json_(isAdmin_(session)?disableUser_(p,session):{ok:false,error:'Admin only'});
    case 'changePassword': return json_(changePassword_(p,session));
    case 'logout': CacheService.getScriptCache().remove('SFS_SESS_'+p.session); return json_({ok:true});
    default:return json_({ok:false,error:'Unknown action'});
  }
}catch(err){return json_({ok:false,error:String(err&&err.message||err)});}}
function login_(p){const sh=getOrCreate_('Users'); const rows=readObjects_(sh); const u=rows.find(x=>String(x.Username).toLowerCase()===String(p.username||'').trim().toLowerCase()&&x.Status==='Active'); if(!u||!checkHash_(String(p.password||''),String(u['Password Hash']||'')))return {ok:false,error:'Invalid username or password'}; const token=Utilities.getUuid(); CacheService.getScriptCache().put('SFS_SESS_'+token,JSON.stringify({userId:u['User ID'],username:u.Username,name:u.Name,role:u.Role}),21600); updateById_(sh,'Username',u.Username,{ 'Last Login':new Date() }); audit_({username:u.Username,name:u.Name,action:'Login'}); return {ok:true,session:token,user:{id:u['User ID'],name:u.Name,username:u.Username,role:u.Role}};}
function auth_(token){if(!token)return null; const x=CacheService.getScriptCache().get('SFS_SESS_'+token); return x?JSON.parse(x):null;}
function isAdmin_(s){return s&&s.role==='ADMIN';}
function bootstrap_(s){const products=readObjects_(getOrCreate_('Products')); const tx=readObjects_(getOrCreate_('StockTransactions')); const customers=readObjects_(getOrCreate_('Customers')).filter(x=>x.Status!=='Disabled'); const suppliers=readObjects_(getOrCreate_('Suppliers')).filter(x=>x.Status!=='Disabled'); const p=products.map(x=>({...x,currentStock:calcStock_(x['Model / Part No.'],x['Current Stock'],tx)})); return {ok:true,user:s,categories:CATS,products:p,customers,suppliers,transactions:tx.slice(-300).reverse()};}
function calcStock_(model,sourceStock,tx){let n=toNum_(sourceStock); tx.filter(x=>String(x['Model / Part No.'])===String(model)).forEach(x=>{n+=toNum_(x['Qty IN'])-toNum_(x['Qty OUT']);}); return n;}
function saveProduct_(p,s){if(!p.model)return {ok:false,error:'Model / Part No. required'}; const sh=getOrCreate_('Products'); const rows=readObjects_(sh); const i=rows.findIndex(x=>String(x['Model / Part No.'])===String(p.model)); if(i>=0&&!isAdmin_(s))return {ok:false,error:'Only admin can edit an existing product'}; const now=new Date(); const obj={ 'Product ID':i>=0?rows[i]['Product ID']:'P-'+Utilities.getUuid().slice(0,8), 'Model / Part No.':p.model,'Description':p.description||'','Category':CATS.includes(p.category)?p.category:'Others','Brand':p.brand||'','Unit':p.unit||'Pcs','Location':p.location||'','Cost Price':p.costPrice||'','Sale Price':p.salePrice||'','Opening/Source Stock':i>=0?rows[i]['Opening/Source Stock']:toNum_(p.openingStock),'Current Stock':i>=0?rows[i]['Current Stock']:toNum_(p.openingStock),'Product Image':p.imageUrl|| (i>=0?rows[i]['Product Image']:''),'Remarks':p.remarks||'','Status':'Active','Created By':i>=0?rows[i]['Created By']:s.username,'Created At':i>=0?rows[i]['Created At']:now,'Updated By':s.username,'Updated At':now}; if(p.imageBase64){obj['Product Image']=saveImage_(p.model,p.imageBase64,p.imageName||'product.jpg');} writeObject_(sh,obj,i); audit_({username:s.username,name:s.name,action:i>=0?'Product Edited':'Product Added',details:p.model}); return {ok:true,product:obj};}
function saveInward_(p,s){const qty=toNum_(p.quantity); if(qty<=0)return {ok:false,error:'Quantity must be greater than zero'}; const r=product_(p.model); if(!r)return {ok:false,error:'Product not found. Add the product first.'}; const id='IN-'+Utilities.getUuid().slice(0,8),now=new Date(); append_('Inward',{ID:id,Date:p.date||now, 'Source Type':p.sourceType||'Local Purchase','Model / Part No.':p.model,Description:r['Description'],Category:r['Category'],Quantity:qty,'Purchase Cost':p.purchaseCost||'',Supplier:p.supplier||'','Supplier Reference':p.supplierReference||'',Remarks:p.remarks||'','Created By':s.username,'Created At':now}); append_('StockTransactions',{ID:'TX-'+Utilities.getUuid().slice(0,8),Date:p.date||now,Type:'IN','Model / Part No.':p.model,Description:r['Description'],Category:r['Category'],'Qty IN':qty,'Qty OUT':0,Party:p.supplier||'',Reference:p.supplierReference||id,'Document Type':'Inward','Created By':s.username,'Created At':now,Remarks:p.remarks||''}); audit_({username:s.username,name:s.name,action:'Inward Created',details:id+' / '+p.model+' / '+qty}); return {ok:true,id,stock:calcStock_(p.model,r['Current Stock'],readObjects_(getOrCreate_('StockTransactions')))};}
function saveDC_(p,s){if(!p.items||!p.items.length)return {ok:false,error:'Add at least one item'}; for(const x of p.items){const r=product_(x.model);if(!r)return {ok:false,error:'Product not found: '+x.model};const available=calcStock_(x.model,r['Current Stock'],readObjects_(getOrCreate_('StockTransactions')));if(toNum_(x.qty)>available)return {ok:false,error:'Insufficient stock for '+x.model+'. Available: '+available};}
  const now=new Date(); const items=JSON.stringify(p.items); append_('DeliveryChallans',{'DC No.':p.no||nextNo_('DC-'),'Date':p.date||now,Customer:p.customer||'','Customer ID':p.customerId||'','PO No.':p.po||'','PO Date':p.poDate||'','STN':p.stn||'','NTN':p.ntn||'',Address:p.address||'', 'Items JSON':items,'Total Qty':p.items.reduce((a,x)=>a+toNum_(x.qty),0),Status:'Saved','Created By':s.username,'Created At':now}); p.items.forEach(x=>{const r=product_(x.model);append_('StockTransactions',{ID:'TX-'+Utilities.getUuid().slice(0,8),Date:p.date||now,Type:'OUT','Model / Part No.':x.model,Description:r['Description'],Category:r['Category'],'Qty IN':0,'Qty OUT':toNum_(x.qty),Party:p.customer||'',Reference:p.no||'','Document Type':'Delivery Challan','Created By':s.username,'Created At':now,Remarks:''});}); audit_({username:s.username,name:s.name,action:'Delivery Challan Created',details:p.no||''}); return {ok:true,no:p.no};}
function saveInvoice_(p,s){if(!p.items||!p.items.length)return {ok:false,error:'Add at least one item'}; const now=new Date(); const subtotal=p.items.reduce((a,x)=>a+toNum_(x.qty)*toNum_(x.rate),0); append_('Invoices',{'Invoice No.':p.no||nextNo_('INV-'),'Date':p.date||now,Customer:p.customer||'','PO No.':p.po||'','PO Date':p.poDate||'','DC No.':p.dc||'','DC Date':p.dcDate||'','STN':p.stn||'','NTN':p.ntn||'','Items JSON':JSON.stringify(p.items),Subtotal:subtotal,Status:'Saved','Created By':s.username,'Created At':now}); audit_({username:s.username,name:s.name,action:'Invoice Created',details:p.no||''}); return {ok:true,no:p.no,subtotal};}
function saveParty_(p,s,type){const sh=getOrCreate_(type==='Customer'?'Customers':'Suppliers'); const idField=type==='Customer'?'Customer ID':'Supplier ID'; const id=p.id||((type==='Customer'?'C-':'S-')+Utilities.getUuid().slice(0,8)); const obj={}; obj[idField]=id; obj.Name=p.name||'';obj['Contact Person']=p.contact||'';obj.Phone=p.phone||'';obj.Email=p.email||'';obj.Address=p.address||'';obj.City=p.city||'';obj.NTN=p.ntn||'';obj.STN=p.stn||'';obj.Remarks=p.remarks||'';obj.Status='Active';obj['Created At']=new Date();obj['Created By']=s.username;append_(type==='Customer'?'Customers':'Suppliers',obj);audit_({username:s.username,name:s.name,action:type+' Added',details:id});return {ok:true,id};}
function getLedger_(p,s){const isC=p.type==='Customer';const name=p.name||''; const inv=readObjects_(getOrCreate_('Invoices')).filter(x=>String(x.Customer)===name);const inward=readObjects_(getOrCreate_('Inward')).filter(x=>String(x.Supplier)===name);return {ok:true,transactions:isC?inv.map(x=>({date:x.Date,type:'Invoice',ref:x['Invoice No.'],debit:toNum_(x.Subtotal),credit:0,remarks:'Invoice'})):inward.map(x=>({date:x.Date,type:'Purchase/Inward',ref:x.ID,debit:toNum_(x.Quantity)*toNum_(x['Purchase Cost']),credit:0,remarks:x['Supplier Reference']||''}))};}
function getReports_(p,s){const tx=readObjects_(getOrCreate_('StockTransactions'));const inv=readObjects_(getOrCreate_('Invoices'));const year=String(p.year||new Date().getFullYear());const sales=inv.filter(x=>String(x.Date).slice(0,4)===year);const cats={};CATS.forEach(c=>cats[c]=0);sales.forEach(x=>{try{JSON.parse(x['Items JSON']||'[]').forEach(i=>{const r=product_(i.model);const c=r?r.Category:'Others';cats[c]=(cats[c]||0)+toNum_(i.qty)*toNum_(i.rate);});}catch(e){}});return {ok:true,sales:sales.map(x=>({date:x.Date,invoice:x['Invoice No.'],customer:x.Customer,total:x.Subtotal})),categorySales:cats,movements:tx.slice(-500).reverse()};}
function listUsers_(){return {ok:true,users:readObjects_(getOrCreate_('Users')).map(x=>({'User ID':x['User ID'],Name:x.Name,Username:x.Username,Role:x.Role,Phone:x.Phone,Email:x.Email,Status:x.Status,'Created At':x['Created At'],'Last Login':x['Last Login']}))};}
function saveUser_(p,s){if(!p.username||!p.password||!p.name)return {ok:false,error:'Name, username and password are required'};const sh=getOrCreate_('Users');const rows=readObjects_(sh);if(rows.some(x=>String(x.Username).toLowerCase()===String(p.username).toLowerCase()))return {ok:false,error:'Username already exists'};append_('Users',{'User ID':'U-'+Utilities.getUuid().slice(0,8),Name:p.name,Username:p.username,'Password Hash':hash_(p.password),Role:p.role==='ADMIN'?'ADMIN':'STAFF',Phone:p.phone||'',Email:p.email||'',Status:'Active','Created At':new Date(),'Last Login':''});audit_({username:s.username,name:s.name,action:'User Created',details:p.username});return {ok:true};}
function disableUser_(p,s){updateById_(getOrCreate_('Users'),'Username',p.username,{Status:p.status==='Active'?'Disabled':'Active'});audit_({username:s.username,name:s.name,action:'User Status Changed',details:p.username});return {ok:true};}
function changePassword_(p,s){const sh=getOrCreate_('Users');const rows=readObjects_(sh);const u=rows.find(x=>x.Username===s.username);if(!u||!checkHash_(p.currentPassword||'',u['Password Hash']))return {ok:false,error:'Current password is incorrect'};updateById_(sh,'Username',s.username,{'Password Hash':hash_(p.newPassword||'')});return {ok:true};}
function ensureAdmin_(){const sh=getOrCreate_('Users');const rows=readObjects_(sh);if(!rows.length)append_('Users',{'User ID':'U-ADMIN',Name:'Administrator',Username:'admin','Password Hash':hash_('admin123'),Role:'ADMIN',Phone:'',Email:'',Status:'Active','Created At':new Date(),'Last Login':''});}
function saveImage_(model,data,name){const folder=getOrCreateFolder_('SFS Product Images');const bytes=Utilities.base64Decode(String(data).split(',').pop());const blob=Utilities.newBlob(bytes,MimeType.JPEG,name||model+'.jpg');const file=folder.createFile(blob);file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);return 'https://drive.google.com/uc?export=view&id='+file.getId();}
function getOrCreateFolder_(name){const it=DriveApp.getFoldersByName(name);return it.hasNext()?it.next():DriveApp.createFolder(name);}
function getOrCreate_(name){const ss=SpreadsheetApp.getActive();let sh=ss.getSheetByName(name);if(!sh)sh=ss.insertSheet(name);if(SHEETS[name]&&SHEETS[name].length&&sh.getLastRow()===0)sh.getRange(1,1,1,SHEETS[name].length).setValues([SHEETS[name]]);return sh;}
function append_(sheet,obj){const sh=getOrCreate_(sheet);const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];sh.appendRow(headers.map(h=>obj[h]===undefined?'':obj[h]));}
function writeObject_(sh,obj,index){const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];const row=headers.map(h=>obj[h]===undefined?'':obj[h]);if(index>=0)sh.getRange(index+2,1,1,row.length).setValues([row]);else sh.appendRow(row);}
function readObjects_(sh){if(sh.getLastRow()<2)return [];const h=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];return sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).getValues().map(r=>Object.fromEntries(h.map((x,i)=>[x,r[i]])));}
function product_(model){return readObjects_(getOrCreate_('Products')).find(x=>String(x['Model / Part No.'])===String(model));}
function updateById_(sh,key,value,changes){const h=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];const rows=sh.getRange(2,1,Math.max(0,sh.getLastRow()-1),sh.getLastColumn()).getValues();for(let i=0;i<rows.length;i++){if(String(rows[i][h.indexOf(key)])===String(value)){Object.keys(changes).forEach(k=>rows[i][h.indexOf(k)]=changes[k]);sh.getRange(i+2,1,1,rows[i].length).setValues([rows[i]]);return;}}}
function audit_(x){append_('AuditLog',{ID:'AUD-'+Utilities.getUuid().slice(0,8),DateTime:new Date(),Username:x.username||'',Name:x.name||'',Action:x.action||'', 'Document Type':x.documentType||'','Document No.':x.documentNo||'',Details:x.details||''});}
function nextNo_(prefix){return prefix+Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyyMMdd-HHmmss');}
function norm_(s){return String(s||'').trim().toLowerCase().replace(/\s+/g,' ');}
function toNum_(v){const n=parseFloat(String(v??'').replace(/,/g,''));return isNaN(n)?0:n;}
function hash_(s){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(s),Utilities.Charset.UTF_8).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');}
function checkHash_(s,h){return hash_(s)===h;}
function json_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}
