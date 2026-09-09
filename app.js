function doGet(e) {
  var action = e && e.parameter && e.parameter.action ? e.parameter.action : '';
  var callback = e && e.parameter && e.parameter.callback ? e.parameter.callback : '';
  var result = { ok: false, error: 'Invalid action' };

  try {
    if (action === 'login') {
      var username = e.parameter.username;
      var password = e.parameter.password;
      
      // Database se user check karein
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users & Roles');
      if (!sheet) {
        result = { ok: false, error: 'Database not setup. Run setupDatabase first.' };
      } else {
        var data = sheet.getDataRange().getValues();
        var found = false;
        for (var i = 1; i < data.length; i++) {
          if (data[i][0] === username && data[i][1] === password) {
            found = true;
            result = {
              ok: true,
              user: { username: data[i][0], role: data[i][2] || 'Staff' },
              session: 'sfs_sess_' + new Date().getTime()
            };
            break;
          }
        }
        if (!found) {
          result = { ok: false, error: 'Invalid username or password.' };
        }
      }
    } else if (action === 'bootstrap') {
      // Products, Customers aur Suppliers fetch karne ke liye
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var prodSheet = ss.getSheetByName('Products');
      var custSheet = ss.getSheetByName('Customers');
      var suppSheet = ss.getSheetByName('Suppliers');
      
      result = {
        ok: true,
        products: prodSheet ? getSheetDataAsObjects(prodSheet) : [],
        customers: custSheet ? getSheetDataAsObjects(custSheet) : [],
        suppliers: suppSheet ? getSheetDataAsObjects(suppSheet) : []
      };
    } else {
      result = { ok: true, service: 'SFS Business Management', message: 'API is online', timestamp: new Date().toISOString() };
    }
  } catch (err) {
    result = { ok: false, error: err.toString() };
  }

  var jsonString = JSON.stringify(result);
  
  // Agar callback mojood hai toh JSONP format return karein taake CORS error na aaye
  if (callback) {
    var output = callback + '(' + jsonString + ');';
    return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JAVASCRIPT);
  } else {
    return ContentService.createTextOutput(jsonString).setMimeType(ContentService.MimeType.JSON);
  }
}

// Helper function to convert sheet rows to objects
function getSheetDataAsObjects(sheet) {
  var rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];
  var headers = rows[0];
  var data = [];
  for (var i = 1; i < rows.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = rows[i][j];
    }
    data.push(obj);
  }
  return data;
}
