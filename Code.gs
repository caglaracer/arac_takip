/**
 * ARAÇ TAKİP SİSTEMİ - GOOGLE APPS SCRIPT BACKEND
 * 
 * Bu kod Google Sheets > Uzantılar > Apps Script ekranına yapıştırılmalıdır.
 * Tüm tablo okuma (doGet) ve kayıt/dönüş/bakım yazma (doPost) işlemlerini yönetir.
 */

// Türkçe karakter ve boşluk duyarsız metin temizleme yardımcısı
function cleanStringForCompare(str) {
  if (!str) return "";
  var letters = { 
    "İ": "i", "I": "ı", "Ş": "ş", "Ğ": "ğ", "Ü": "ü", "Ö": "ö", "Ç": "ç",
    "ı": "ı", "i": "i", "ş": "ş", "ğ": "ğ", "ü": "ü", "ö": "ö", "ç": "ç"
  };
  var result = "";
  for (var i = 0; i < str.length; i++) {
    var char = str.charAt(i);
    if (letters[char] !== undefined) {
      result += letters[char];
    } else {
      result += char.toLowerCase();
    }
  }
  return result.replace(/\s+/g, '');
}

// Güvenli sayfa bulucu (Türkçe karakter ve büyük/küçük harf bağımsız)
function getSheetSafe(ss, targetName) {
  var sheets = ss.getSheets();
  var cleanTarget = cleanStringForCompare(targetName);
  for (var i = 0; i < sheets.length; i++) {
    var sheetName = cleanStringForCompare(sheets[i].getName());
    if (sheetName === cleanTarget) {
      return sheets[i];
    }
  }
  return null;
}

// Sayfa satırlarını başlık anahtarlarına göre nesne dizisi olarak okur
function readSheetRecords(sheet) {
  var records = [];
  if (sheet && sheet.getLastRow() > 1) {
    var ssTimeZone = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return h.toString().trim(); });
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var record = {};
      var hasData = false;
      for (var j = 0; j < headers.length; j++) {
        var val = row[j];
        if (val instanceof Date) {
          var headerName = headers[j].toLowerCase();
          if (headerName.indexOf("saat") > -1) {
            record[headers[j]] = Utilities.formatDate(val, ssTimeZone, "HH:mm:ss");
          } else {
            record[headers[j]] = Utilities.formatDate(val, ssTimeZone, "dd.MM.yyyy");
          }
        } else {
          record[headers[j]] = val;
        }
        if (val !== "" && val !== null && val !== undefined) {
          hasData = true;
        }
      }
      if (hasData) {
        records.push(record);
      }
    }
  }
  return records;
}

// Başlıklara göre dinamik satır ekler (sütun sırası değişse de doğru başlığa yazar)
function appendRowByHeaders(sheet, recordObj) {
  if (sheet.getLastRow() === 0) return;
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return h.toString().trim(); });
  var newRow = [];
  for (var i = 0; i < headers.length; i++) {
    var header = headers[i];
    if (recordObj.hasOwnProperty(header)) {
      newRow.push(recordObj[header]);
    } else {
      newRow.push("");
    }
  }
  sheet.appendRow(newRow);
}

// ID sütununa göre eşleşen satırı günceller
function updateRowById(sheet, id, updateObj) {
  if (sheet.getLastRow() <= 1) return false;
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return h.toString().trim(); });
  var idColIdx = headers.indexOf("ID");
  if (idColIdx === -1) idColIdx = 0;
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][idColIdx] == id) {
      var rowNum = i + 1;
      for (var key in updateObj) {
        if (updateObj.hasOwnProperty(key)) {
          var colIdx = headers.indexOf(key);
          if (colIdx !== -1) {
            sheet.getRange(rowNum, colIdx + 1).setValue(updateObj[key]);
          }
        }
      }
      return true;
    }
  }
  return false;
}

// ==========================================
// 1. GET İSTEKLERİ: VERİLERİ OKUMA (doGet)
// ==========================================
function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var debugSheets = [];
  
  var allSheets = ss.getSheets();
  for (var i = 0; i < allSheets.length; i++) {
    debugSheets.push({
      name: allSheets[i].getName(),
      rows: allSheets[i].getLastRow(),
      cols: allSheets[i].getLastColumn()
    });
  }

  // 1. SEFER KAYITLARI
  var sheetRecords = getSheetSafe(ss, "Kayıtlar");
  var records = readSheetRecords(sheetRecords);
  
  // 2. ARAÇLAR LİSTESİ
  var sheetVehicles = getSheetSafe(ss, "Araçlar");
  var vehicles = readSheetRecords(sheetVehicles);
  
  // 3. SÜRÜCÜLER / PERSONEL LİSTESİ
  var sheetDrivers = getSheetSafe(ss, "Sürücüler");
  var drivers = readSheetRecords(sheetDrivers);

  // 4. BAKIM VE YIKAMA KAYITLARI
  var maintSheet = getSheetSafe(ss, "BAKIM_KAYITLARI");
  var maintenanceRecords = readSheetRecords(maintSheet);
  
  // 5. FİRMALAR VE HİZMET LİSTESİ
  var sheetCompanies = getSheetSafe(ss, "Firmalar");
  if (!sheetCompanies) {
    sheetCompanies = ss.insertSheet("Firmalar");
    sheetCompanies.appendRow(["Firma Adı", "Hizmet Türü", "Ücret", "Varsayılan"]);
    sheetCompanies.appendRow(["Altın Oto Yıkama", "Araç Yıkama", 250, "Evet"]);
    sheetCompanies.appendRow(["Merkez Lastik", "Lastik Değişimi", 500, "Evet"]);
    sheetCompanies.appendRow(["Yetkili Servis", "Periyodik Bakım", "", "Evet"]);
  }
  var companies = readSheetRecords(sheetCompanies);
  
  var output = {
    ok: true,
    records: records,
    vehicles: vehicles,
    drivers: drivers,
    maintenanceRecords: maintenanceRecords,
    companies: companies,
    debugInfo: {
      sheets: debugSheets
    }
  };
  
  return ContentService.createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// 2. POST İSTEKLERİ: VERİ YAZMA (doPost)
// ==========================================
function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var params;
  try {
    params = JSON.parse(e.postData.contents);
  } catch (err) {
    params = e.parameter;
  }
  
  // ----------------------------------------------------
  // A. BAKIM / YIKAMA / PERİYODİK BAKIM (log_maintenance)
  // ----------------------------------------------------
  if (params.action === 'log_maintenance') {
    var sheet = getSheetSafe(ss, "BAKIM_KAYITLARI");
    if (!sheet) {
      sheet = ss.insertSheet("BAKIM_KAYITLARI");
      sheet.appendRow([
        "ID", "Tarih", "Plaka", "İşlem Türü", "KM", 
        "Personel", "Ücret", "Yıkama Firması", "Ödeme Durumu", 
        "Notlar", "Cihaz ID", "Kayıt Tarihi"
      ]);
    } else {
      // Başlıkları incele ve eksik sütunları otomatik ekle (Auto-Migration)
      var data = sheet.getDataRange().getValues();
      var headers = data[0].map(function(h) { return h.toString().trim(); });
      
      // 1. KM Sütunu (Periyodik bakım ve işlem KM takibi)
      if (headers.indexOf("KM") === -1) {
        var personCol = headers.indexOf("Personel");
        if (personCol === -1) personCol = headers.indexOf("Ücret");
        var insertIdx = personCol === -1 ? headers.length : personCol;
        sheet.insertColumnBefore(insertIdx + 1);
        sheet.getRange(1, insertIdx + 1).setValue("KM");
        headers.splice(insertIdx, 0, "KM");
      }
      
      // 2. Ücret Sütunu
      if (headers.indexOf("Ücret") === -1) {
        var notlarIdx = headers.indexOf("Notlar");
        var insertIdx = notlarIdx === -1 ? headers.length : notlarIdx;
        sheet.insertColumnBefore(insertIdx + 1);
        sheet.getRange(1, insertIdx + 1).setValue("Ücret");
        headers.splice(insertIdx, 0, "Ücret");
      }
      
      // 3. Yıkama Firması Sütunu
      if (headers.indexOf("Yıkama Firması") === -1) {
        var notlarIdx = headers.indexOf("Notlar");
        var insertIdx = notlarIdx === -1 ? headers.length : notlarIdx;
        sheet.insertColumnBefore(insertIdx + 1);
        sheet.getRange(1, insertIdx + 1).setValue("Yıkama Firması");
        headers.splice(insertIdx, 0, "Yıkama Firması");
      }
      
      // 4. Ödeme Durumu Sütunu
      if (headers.indexOf("Ödeme Durumu") === -1) {
        var notlarIdx = headers.indexOf("Notlar");
        var insertIdx = notlarIdx === -1 ? headers.length : notlarIdx;
        sheet.insertColumnBefore(insertIdx + 1);
        sheet.getRange(1, insertIdx + 1).setValue("Ödeme Durumu");
        headers.splice(insertIdx, 0, "Ödeme Durumu");
      }
    }
    
    var rawDate = params.date; // YYYY-MM-DD
    var formattedDate = rawDate;
    if (rawDate && rawDate.indexOf('-') > -1) {
      var p = rawDate.split('-');
      formattedDate = p[2] + '.' + p[1] + '.' + p[0]; // dd.MM.yyyy
    }
    
    var maintObj = {
      "ID": params.id,
      "Tarih": formattedDate,
      "Plaka": params.plate,
      "İşlem Türü": params.type,
      "KM": params.km !== undefined && params.km !== "" ? Number(params.km) : "",
      "Personel": params.driver,
      "Ücret": params.price !== undefined && params.price !== "" ? Number(params.price) : "",
      "Yıkama Firması": params.company || "",
      "Ödeme Durumu": params.paymentStatus || "Ödendi",
      "Notlar": params.notes || "",
      "Cihaz ID": params.deviceId,
      "Kayıt Tarihi": new Date()
    };
    
    appendRowByHeaders(sheet, maintObj);
    
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // ----------------------------------------------------
  // B. ARAÇ ALIM / ÇIKIŞ SEFERİ (checkout)
  // ----------------------------------------------------
  else if (params.action === 'checkout') {
    var sheet = getSheetSafe(ss, "Kayıtlar");
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Kayıtlar sayfası bulunamadı" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var recordObj = {
      "ID": params.id,
      "Tarih": params.date,
      "Plaka": params.plate,
      "Araç Modeli": params.model,
      "Sürücü": params.driver,
      "Çıkış KM": params.checkoutKm,
      "Çıkış Saati": params.checkoutTime,
      "Kullanım Amacı": params.purpose,
      "Güzergah": params.route,
      "Dönüş KM": "",
      "Dönüş Saati": "",
      "KM Farkı": "",
      "Çıkış Cihaz": params.checkoutDevice,
      "Dönüş Cihaz": "",
      "Durum": "AÇIK"
    };
    
    appendRowByHeaders(sheet, recordObj);
    
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // ----------------------------------------------------
  // C. ARAÇ DÖNÜŞ / TESLİM İŞLEMİ (return)
  // ----------------------------------------------------
  else if (params.action === 'return') {
    var sheet = getSheetSafe(ss, "Kayıtlar");
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Kayıtlar sayfası bulunamadı" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return h.toString().trim(); });
    var idColIdx = headers.indexOf("ID");
    var checkoutKmColIdx = headers.indexOf("Çıkış KM");
    
    if (idColIdx === -1 || checkoutKmColIdx === -1) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Sütun eşleşme hatası" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Açık kaydı ID ile bul
    for (var i = 1; i < data.length; i++) {
      if (data[i][idColIdx] == params.id) {
        var checkoutKm = data[i][checkoutKmColIdx];
        var diff = Number(params.returnKm) - Number(checkoutKm);
        
        var updateObj = {
          "Dönüş KM": params.returnKm,
          "Dönüş Saati": params.returnTime,
          "KM Farkı": diff,
          "Dönüş Cihaz": params.returnDevice,
          "Durum": "KAPALI"
        };
        
        if (params.returnDriverName) {
          updateObj["Teslim Eden"] = params.returnDriverName;
        }
        
        updateRowById(sheet, params.id, updateObj);
        
        return ContentService.createTextOutput(JSON.stringify({ ok: true }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "İlgili açık kayıt bulunamadı" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Bilinmeyen action: " + params.action }))
    .setMimeType(ContentService.MimeType.JSON);
}

// =========================================================================
// 3. DOĞRUDAN ÇALIŞTIRMA YARDIMCISI (APPS SCRIPT İÇİNDEN "ÇALIŞTIR" DEMEK İÇİN)
// =========================================================================
/**
 * Apps Script editöründe üstteki fonksiyon listesinden "tablolariGuncelle" seçip
 * "Çalıştır" (Run) butonuna basarak KM sütununu anında açabilirsiniz.
 */
function tablolariGuncelle() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getSheetSafe(ss, "BAKIM_KAYITLARI");
  
  if (!sheet) {
    sheet = ss.insertSheet("BAKIM_KAYITLARI");
    sheet.appendRow([
      "ID", "Tarih", "Plaka", "İşlem Türü", "KM", 
      "Personel", "Ücret", "Yıkama Firması", "Ödeme Durumu", 
      "Notlar", "Cihaz ID", "Kayıt Tarihi"
    ]);
    Logger.log("BAKIM_KAYITLARI sayfası oluşturuldu ve KM sütunu eklendi.");
    return "BAKIM_KAYITLARI sayfası ve KM sütunu oluşturuldu.";
  }
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return h.toString().trim(); });
  
  if (headers.indexOf("KM") === -1) {
    var personCol = headers.indexOf("Personel");
    if (personCol === -1) personCol = headers.indexOf("Ücret");
    var insertIdx = personCol === -1 ? headers.length : personCol;
    sheet.insertColumnBefore(insertIdx + 1);
    sheet.getRange(1, insertIdx + 1).setValue("KM");
    Logger.log("KM sütunu başarıyla eklendi!");
    return "KM sütunu başarıyla eklendi!";
  } else {
    Logger.log("KM sütunu zaten mevcut.");
    return "KM sütunu zaten mevcut.";
  }
}
