/*
SFS BUSINESS MANAGEMENT - GOOGLE APPS SCRIPT BACKEND
-----------------------------------------------------
Create a NEW Google Sheet for the new software. Do NOT use the
original live inventory sheet as the writable database.

1) Extensions -> Apps Script
2) Paste this file as Code.gs
3) Set API_TOKEN below to a private value
4) Run setupDatabase() once and authorize
5) Deploy -> New deployment -> Web app
   Execute as: Me
   Who has access: Anyone with the link (or your preferred restricted setting)
6) Put the /exec URL into SFS Settings.

The backend creates these tabs:
Products, Stock Movement, Inward, Delivery Challans, Invoices,
Customers, Suppliers, Users & Roles, Categories, Source Stock,
Source Imports, Source Returns.

It can pull the existing LIVE source using the published CSV URLs below.
*/

const API_TOKEN = 'CHANGE_THIS_TOKEN';

const SOURCE = {
  stock: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSS4E1DvaV4RzuMHMENiroSR4WYZjT0usnqAgUwX-W44ADM-sB1Gz8lYNvK51-WP88BYi4lYLxwZaU3/pub?gid=1719776219&single=true&output=csv',
  imports: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSS4E1DvaV4RzuMHMENiroSR4WYZjT0usnqAgUwX-W44ADM-sB1Gz8lYNvK51-WP88BYi4lYLxwZaU3/pub?gid=1389271409&single=true&output=csv',
  returns: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSS4E1DvaV4RzuMHMENiroSR4WYZjT0usnqAgUwX-W44ADM-sB1Gz8lYNvK51-WP88BYi4lYLxwZaU3/pub?gid=1032386368&single=true&output=csv'
};

const HEADERS = {
  'Products':['Product ID','Model / Part No.','Description','Category','Brand','Unit','Location','Cost Price','Sale Price','Current Stock','Product Image','Remarks','Status'],
  'Inward':['Inward ID','Date','Product ID','Model / Part No.','Quantity','Source Type','Supplier','Supplier Reference','Purchase Cost','Remarks','Created By'],
  'Stock Movement':['Transaction ID','Date/Time','Type','Product ID','Model / Part No.','Quantity','Source / Destination','Reference Type','Reference No.','Created By'],
  'Delivery Challans':['DC No.','Date','Customer ID','Customer Name','Delivery Address','PO #','PO Date','STN','NTN','Product ID','Model / Part No.','Description','Quantity','Unit','Created By'],
  'Invoices':['Invoice No.','Date','Customer ID','Customer Name','PO #','PO Date','DC No.','DC Date','STN','NTN','Product ID','Model / Part No.','Description','Quantity','Rate / Unit','Amount','Created By'],
  'Customers':['Customer ID','Customer Name','Contact Person','Phone','Email','Address','NTN/Tax ID','Remarks','Status'],
  'Suppliers':['Supplier ID','Supplier Name','Contact Person','Phone','Email','Address','NTN/Tax ID','Remarks','Status'],
  'Users & Roles':['User ID','Name','Username','Role','Password','Status'],
  'Categories':['Category ID','Category Name']
};

function setupDatabase(){
  const ss=SpreadsheetApp.getActive();
  Object.keys(HEADERS).forEach(name=>{
    let sh=ss.getSheetByName(name)||ss.insertSheet(name);
    sh.clear();
    sh.getRange(1,1,1,HEADERS[name].length).setValues([HEADERS[name]]);
    sh.setFrozenRows(1);
  });
  const cats=[['CAT-01','Airline Equipment'],['CAT-02','Valves'],['CAT-03','Cylinder'],['CAT-04','Fittings/Tubing'],['CAT-05','Others']];
  ss.getSheetByName('Categories').getRange(2,1,cats.length,2).setValues(cats);
  syncSourceData();
}

function parseCsv(text){return Utilities.parseCsv(text);}
function fetchSource(url){return parseCsv(UrlFetchApp.fetch(url,{muteHttpExceptions:true}).getContentText());}

function syncSourceData(){
  const ss=SpreadsheetApp.getActive();
  const stock=fetchSource(SOURCE.stock), imp=fetchSource(SOURCE.imports), ret=fetchSource(SOURCE.returns);
  writeSource('Source Stock',stock); writeSource('Source Imports',imp); writeSource('Source Returns',ret);
  // Import current product master from live source, preserving image URL.
  const sh=ss.getSheetByName('Products');
  const existing=sh.getDataRange().getValues();
  const byModel={};
  existing.slice(1).forEach(r=>{if(r[1])byModel[String(r[1])]=r});
  const rows=[];
  stock.slice(1).forEach((r,i)=>{
    if(!r[0])return;
    const old=byModel[String(r[0])]||[];
    rows.push([
      old[0]||('P-'+String(i+1).padStart(5,'0')), r[0]||'', r[2]||'', old[3]||'',
      old[4]||'', old[5]||'Pcs', r[1]||'', r[7]||'', old[8]||'', r[6]||0,
      r[4]||'', old[11]||'', 'Active'
    ]);
  });
  if(rows.length){if(sh.getLastRow()>1)sh.getRange(2,1,sh.getLastRow()-1,HEADERS.Products.length).clearContent();sh.getRange(2,1,rows.length,HEADERS.Products.length).setValues(rows);}
}

function writeSource(name,data){
  const ss=SpreadsheetApp.getActive(); let sh=ss.getSheetByName(name)||ss.insertSheet(name); sh.clear();
  if(data.length && data[0].length) sh.getRange(1,1,data.length,data[0].length).setValues(data);
  sh.setFrozenRows(1);
}

function doPost(e){
  try{
    const p=JSON.parse(e.postData.contents||'{}');
    if(p.token!==API_TOKEN) return out({ok:false,error:'Unauthorized'});
    if(p.action==='product') return out(saveProduct(p));
    if(p.action==='inward') return out(saveInward(p));
    if(p.action==='dc') return out(saveDC(p));
    if(p.action==='invoice') return out(saveInvoice(p));
    return out({ok:false,error:'Unknown action'});
  }catch(err){return out({ok:false,error:String(err)})}
}
function out(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)}

function nextId(prefix,sheet,col){
  const sh=SpreadsheetApp.getActive().getSheetByName(sheet), n=Math.max(0,sh.getLastRow()-1)+1;
  return prefix+String(n).padStart(6,'0');
}
function findProduct(model){
  const sh=SpreadsheetApp.getActive().getSheetByName('Products'), v=sh.getDataRange().getValues();
  for(let i=1;i<v.length;i++) if(String(v[i][1])===String(model)) return {row:i+1,data:v[i]};
  return null;
}
function saveProduct(p){
  const sh=SpreadsheetApp.getActive().getSheetByName('Products'), id=nextId('P-', 'Products',1);
  sh.appendRow([id,p.model,p.description,p.category,p.brand,p.unit||'Pcs',p.location,p.costPrice||'',p.salePrice||'',0,p.image||'',p.remarks||'','Active']);
  return {ok:true,id:id};
}
function saveInward(p){
  const id=nextId('IN-','Inward',1), prod=findProduct(p.model); if(!prod)throw Error('Product not found: '+p.model);
  SpreadsheetApp.getActive().getSheetByName('Inward').appendRow([id,p.date,prod.data[0],p.model,Number(p.qty||0),p.sourceType,p.supplier,p.supplierReference,p.purchaseCost,p.remarks,p.user||'Staff']);
  postMovement('IN',prod,Number(p.qty||0),p.supplier,'Inward',id,p.user);
  return {ok:true,id:id};
}
function postMovement(type,prod,qty,party,refType,refNo,user){
  const sh=SpreadsheetApp.getActive().getSheetByName('Stock Movement');
  const signed=type==='OUT'?-Math.abs(qty):Math.abs(qty);
  sh.appendRow([nextId('TX-','Stock Movement',1),new Date(),type,prod.data[0],prod.data[1],signed,party,refType,refNo,user||'Staff']);
  const psh=SpreadsheetApp.getActive().getSheetByName('Products'), row=prod.row;
  const cur=Number(psh.getRange(row,10).getValue()||0); psh.getRange(row,10).setValue(cur+signed);
}
function saveDC(p){
  const id=p.no||nextId('DC-','Delivery Challans',1), sh=SpreadsheetApp.getActive().getSheetByName('Delivery Challans');
  (p.items||[]).forEach(it=>{const prod=findProduct(it.model);if(!prod)throw Error('Product not found: '+it.model);postMovement('OUT',prod,Number(it.qty||0),p.customer,'DC',id,p.user);sh.appendRow([id,p.date,p.customerId,p.customer,p.address,p.po,p.poDate,p.stn,p.ntn,prod.data[0],it.model,it.desc||prod.data[2],Number(it.qty||0),it.unit||'nos',p.user||'Staff']);});
  return {ok:true,id:id};
}
function saveInvoice(p){
  const id=p.no||nextId('INV-','Invoices',1), sh=SpreadsheetApp.getActive().getSheetByName('Invoices');
  (p.items||[]).forEach(it=>{const prod=findProduct(it.model);if(!prod)throw Error('Product not found: '+it.model);sh.appendRow([id,p.date,p.customerId||'',p.customer,p.po,p.poDate,p.dc,p.dcDate,p.stn,p.ntn,prod.data[0],it.model,it.desc||prod.data[2],Number(it.qty||0),Number(it.rate||0),Number(it.qty||0)*Number(it.rate||0),p.user||'Staff']);});
  return {ok:true,id:id};
}