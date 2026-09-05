/* SFS ERP backend extensions. Safe add-on: does not alter source inventory. */
function getReports_(p, s) {
  p = p || {};
  var mode = String(p.mode || '').toLowerCase();
  var tx = readObjects_(getOrCreate_('StockTransactions'));
  var inv = readObjects_(getOrCreate_('Invoices'));

  if (mode === 'price') {
    var model = String(p.model || '').trim();
    var prices = typeof SFS_PRICE_LIST_SERVER !== 'undefined' ? SFS_PRICE_LIST_SERVER : {};
    var key = Object.keys(prices).find(function(k){ return String(k).trim().toLowerCase() === model.toLowerCase(); });
    return key === undefined ? {ok:true,matched:false,model:model} : {ok:true,matched:true,model:model,rate:Number(prices[key])};
  }

  if (mode === 'docs') {
    var type = String(p.type || 'DC').toUpperCase();
    if (type === 'DC') {
      return {ok:true,documents:readObjects_(getOrCreate_('DeliveryChallans')).map(function(x){
        var items=[]; try{items=JSON.parse(x['Items JSON']||'[]')}catch(e){}
        return {no:x['DC No.'],date:x.Date,customer:x.Customer,customerId:x['Customer ID'],po:x['PO No.'],poDate:x['PO Date'],stn:x.STN,ntn:x.NTN,address:x.Address,items:items,totalQty:x['Total Qty'],status:x.Status,createdBy:x['Created By']};
      }).reverse()};
    }
    return {ok:true,documents:inv.map(function(x){
      var items=[]; try{items=JSON.parse(x['Items JSON']||'[]')}catch(e){}
      var sub=Number(x.Subtotal||0); return {no:x['Invoice No.'],date:x.Date,customer:x.Customer,customerId:x['Customer ID']||'',po:x['PO No.'],poDate:x['PO Date'],dc:x['DC No.'],dcDate:x['DC Date'],stn:x.STN,ntn:x.NTN,items:items,subtotal:sub,gst:sub*.18,grandTotal:sub*1.18,status:x.Status,createdBy:x['Created By']};
    }).reverse()};
  }

  if (mode === 'document') {
    var type2=String(p.type||'DC').toUpperCase(), no=String(p.no||'');
    if(type2==='DC'){
      var dcs=readObjects_(getOrCreate_('DeliveryChallans')).filter(function(x){return String(x['DC No.'])===no;});
      if(!dcs.length)return {ok:false,error:'Delivery Challan not found'};
      var d=dcs[0], items=[]; try{items=JSON.parse(d['Items JSON']||'[]')}catch(e){}
      return {ok:true,document:{no:d['DC No.'],date:d.Date,customer:d.Customer,customerId:d['Customer ID'],po:d['PO No.'],poDate:d['PO Date'],stn:d.STN,ntn:d.NTN,address:d.Address,items:items,totalQty:d['Total Qty'],status:d.Status}};
    }
    var iv=inv.filter(function(x){return String(x['Invoice No.'])===no;});
    if(!iv.length)return {ok:false,error:'Invoice not found'};
    var q=iv[0], its=[]; try{its=JSON.parse(q['Items JSON']||'[]')}catch(e){}
    var ss=Number(q.Subtotal||0); return {ok:true,document:{no:q['Invoice No.'],date:q.Date,customer:q.Customer,po:q['PO No.'],poDate:q['PO Date'],dc:q['DC No.'],dcDate:q['DC Date'],stn:q.STN,ntn:q.NTN,items:its,subtotal:ss,gst:ss*.18,grandTotal:ss*1.18}};
  }

  var year=String(p.year||new Date().getFullYear());
  var sales=inv.filter(function(x){return String(x.Date).slice(0,4)===year;});
  var cats={}; CATS.forEach(function(c){cats[c]=0;});
  sales.forEach(function(x){var items=[];try{items=JSON.parse(x['Items JSON']||'[]')}catch(e){};items.forEach(function(i){var r=product_(i.model),c=r?r.Category:'Others';cats[c]=(cats[c]||0)+toNum_(i.qty)*toNum_(i.rate);});});
  return {ok:true,sales:sales.map(function(x){return {date:x.Date,invoice:x['Invoice No.'],customer:x.Customer,total:x.Subtotal};}),categorySales:cats,movements:tx.slice(-500).reverse()};
}

/* Price list is copied from the approved 2K26 exact Model -> Rate file at build time. */
var SFS_PRICE_LIST_SERVER = {
  'GP-6310':6066.993419125327,'CM-600':24939.13067029283,'G-6240':28022.46577048357,'G-6250':29417.94070806989,
  'GP-6100':6485.635900401225,'G-7290':32939.85364578778,'G-7230':21776.05414509714,'G-7399':54888.68087839561,
  'GL-6240':27630.40376420932,'G-6233':18779.10558866174,'G-6244':40920.64126503149,'G-6230':17895.30479485707,
  'GP-6400-1':425.2876000263099,'GP-6400-2':671.1569937915201,'GP-6400-5':1196.121375073996,'G-6990-01':3834.233518987199,
  'HZE2Z500':25583.7071890827,'AM-5000A':33737.2671890827,'CM-9413A':31238.70324568254,'CM-9410A':29245.16762055922,
  'CM-9602A':30746.964588148,'CM-9620':42914.17610915482,'CM-9403A':21908.95652010537,'CM-9680':49665.61754057249,
  'CM-9585':31590.89453945433,'CM-580':23390.818188878,'CM-500':15011.32325717865,'CM-420':15044.54885093071,
  'CM-9500':20878.96311379164,'CM-418R':16832.08579479129,'CM-430':23404.10823894753,'CM-9520':22560.17835764514,
  'EL22F250':23091.78765767854,'EL22F230':0,'EL22986':19641.4657275375,'EL22988':19641.4657275375,'EL22F355':41033.60828378849,
  'CL-9300':29929.61485185155,'CL-9303A':29770.13200184168,'CM-412A':17170.98685106226,'CM-9430E':33903.39586459739,
  'CM-9420':21955.47235135824,'CM-9590':31677.28108320967,'CM-419R':16459.95914476827,'CM-413A':24985.6465015457,
  'CM-585':24168.29689524513,'CM-411A':26048.86550161148,'CM-620':36920.27977728403,'CM-423':16798.86020103924,
  'CM-9430':32275.34177074667,'CM-425E':21815.92485759962,'CM-9423':26334.60560787915,'EL18F255':29059.1042955477,
  'AI-3526':9794.90503810595,'AI-3513':4498.745394028308,'AI-3511Q':4498.745394028308,'AI-3610':3621.589718974044,
  'AI-3570':4425.649087773787,'AI-9400':10605.609609438,'AC-8990-05':2671.337737665258,'AC-8990-09':524.9643812824761,
  'DA-0124':4910.742756553796,'DC-0310':6292.927456639303,'DA-0051':4910.742756553796,'DA-0106':4631.64776903653,
  'DA-0058':6292.927456639303,'DA-0108':4784.485500295985,'DB-0510':5641.705819099016,'DB-0610':8519.042238027017,
  'DB-0502':5229.708456573528,'DB-0507':5229.708456573528,'DB-0607':5887.575212864226,'DB-0509':5395.836425333806,
  'DL-0124':2883.981537678413,'DL-0051':2883.981537678413,'DL-0106':2883.981537678413,'DL-0108':2883.981537678413,
  'DD-051':4824.356212798451,'DD-060':6086.92885037656,'DD-040':4824.356212798451,'AC-7500':30414.70852063158,
  'AC-7100':17715.88658859597,'AC-8520':48509.36687800098,'AC-8120':24394.23093275911,'AC-8740':37757.56473983581,
  'AC-N8500':40349.16105249613,'AC-7120':19842.32458872752,'AC-8100':22513.66232639278,'AC-8500':36302.28373349579,
  'AC-N8520':52562.88931575175,'AC-9100':52064.50540947089,'KLK401050BM':27033.96411233317,'KLK401080BM':44785.18151139533,
  'KL2001250450M':225046.2563165644,'CL-300':23324.36681394293,'CL-118R':15170.80610718852,'CL-103A':12898.17549454753,
  'CL-104A':16705.82853853348,'CL-302A':23324.36681394293,'CL-200':13376.62404457753,'CL-120A':14127.52246337398,
  'CL-9200':20088.19398249272,'CL-9113A':29896.38925809949,'CL-100A':15556.22299471237,'CL-9103A':20779.28633253548,
  'CL-9301':29929.61485185155,'KL2000500050M':47322.27770317025,'KD2000500025M':56383.8325972381,'KD2000500125M':64331.39462272977,
  'KL2000500600M':79367.23385199733,'KL2000500100M':50231.93649582598,'KL2000500200M':56064.8668783843,'KL2000500300M':61886.25672732852,
  'KD2000500160M':68345.04634797806,'YF210151S':38402.51018842041,'YF210251S':73278.57881144251
};
