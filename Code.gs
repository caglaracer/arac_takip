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

// Hızlı tarih ve saat formatlayıcı (Utilities.formatDate yerine V8 yerel motoru - 1000 kat daha hızlı)
function formatGasDate(val, isTime) {
  var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
  if (isTime) {
    return pad(val.getHours()) + ':' + pad(val.getMinutes()) + ':' + pad(val.getSeconds());
  }
  return pad(val.getDate()) + '.' + pad(val.getMonth() + 1) + '.' + val.getFullYear();
}

// Tüm sayfaları tek seferde haritaya alır (O(1) hızlı erişim)
function getSheetMap(ss) {
  var sheets = ss.getSheets();
  var map = {};
  for (var i = 0; i < sheets.length; i++) {
    map[cleanStringForCompare(sheets[i].getName())] = sheets[i];
  }
  return map;
}

// Güvenli sayfa bulucu (Türkçe karakter ve büyük/küçük harf bağımsız)
function getSheetSafe(ss, targetName, sheetMap) {
  var cleanTarget = cleanStringForCompare(targetName);
  if (sheetMap && sheetMap[cleanTarget]) {
    return sheetMap[cleanTarget];
  }
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sheetName = cleanStringForCompare(sheets[i].getName());
    if (sheetName === cleanTarget) {
      return sheets[i];
    }
  }
  return null;
}

// Sayfa satırlarını başlık anahtarlarına göre nesne dizisi olarak okur (Hızlı V8 motoru)
function readSheetRecords(sheet) {
  var records = [];
  if (sheet && sheet.getLastRow() > 1) {
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
          var isTime = headerName.indexOf("saat") > -1;
          record[headers[j]] = formatGasDate(val, isTime);
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
  var sheetMap = getSheetMap(ss);

  // 1. SEFER KAYITLARI
  var sheetRecords = getSheetSafe(ss, "Kayıtlar", sheetMap);
  var records = readSheetRecords(sheetRecords);
  
  // 2. ARAÇLAR LİSTESİ
  var sheetVehicles = getSheetSafe(ss, "Araçlar", sheetMap);
  var vehicles = readSheetRecords(sheetVehicles);
  
  // 3. SÜRÜCÜLER / PERSONEL LİSTESİ
  var sheetDrivers = getSheetSafe(ss, "Sürücüler", sheetMap);
  var drivers = readSheetRecords(sheetDrivers);

  // 4. BAKIM VE YIKAMA KAYITLARI
  var maintSheet = getSheetSafe(ss, "BAKIM_KAYITLARI", sheetMap);
  var maintenanceRecords = readSheetRecords(maintSheet);
  
  // 5. FİRMALAR VE HİZMET LİSTESİ
  var sheetCompanies = getSheetSafe(ss, "Firmalar", sheetMap);
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
    companies: companies
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
    
    var maintKm = params.km;
    if ((maintKm === undefined || maintKm === "" || maintKm === null) && params.notes) {
      var match = params.notes.toString().match(/\[KM:\s*(\d+)\]|KM\s*[:=]?\s*(\d+)|(\d{5,6})\s*km/i);
      if (match) {
        maintKm = match[1] || match[2] || match[3];
      }
    }
    
    var maintObj = {
      "ID": params.id,
      "Tarih": formattedDate,
      "Plaka": params.plate,
      "İşlem Türü": params.type,
      "KM": maintKm !== undefined && maintKm !== "" ? Number(maintKm) : "",
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
    
    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return h.toString().trim(); });
    var plateColIdx = headers.indexOf("Plaka");
    var durumColIdx = headers.indexOf("Durum");
    var cikisKmColIdx = headers.indexOf("Çıkış KM");
    var donusKmColIdx = headers.indexOf("Dönüş KM");
    var donusSaatiColIdx = headers.indexOf("Dönüş Saati");
    var kmFarkiColIdx = headers.indexOf("KM Farkı");
    var donusCihazColIdx = headers.indexOf("Dönüş Cihaz");
    var teslimEdenColIdx = headers.indexOf("Teslim Eden");
    
    // GÜVENLİK VE MÜKERRER KAYIT KİLİDİ:
    // Bu aracın daha önceden açık unutulmuş veya kapatılmamış seferi varsa,
    // tabloda çift açık kayıt ya da yetim sefer kalmaması için önceki seferi otomatik kapat!
    var targetPlateClean = cleanStringForCompare(params.plate);
    var newCheckoutKm = Number(params.checkoutKm) || 0;
    
    if (plateColIdx !== -1 && durumColIdx !== -1) {
      for (var i = 1; i < data.length; i++) {
        var rowPlate = cleanStringForCompare(data[i][plateColIdx]);
        var rowDurum = String(data[i][durumColIdx] || '').trim().toUpperCase();
        
        if (rowPlate === targetPlateClean && rowDurum === "AÇIK") {
          var rowNum = i + 1;
          var prevCikisKm = Number(data[i][cikisKmColIdx]) || 0;
          var diff = (newCheckoutKm > 0 && newCheckoutKm >= prevCikisKm) ? (newCheckoutKm - prevCikisKm) : 0;
          var closeKm = newCheckoutKm > 0 ? newCheckoutKm : prevCikisKm;
          
          sheet.getRange(rowNum, durumColIdx + 1).setValue("KAPALI");
          if (donusKmColIdx !== -1) sheet.getRange(rowNum, donusKmColIdx + 1).setValue(closeKm);
          if (donusSaatiColIdx !== -1) sheet.getRange(rowNum, donusSaatiColIdx + 1).setValue(params.checkoutTime || "18:00:00");
          if (kmFarkiColIdx !== -1) sheet.getRange(rowNum, kmFarkiColIdx + 1).setValue(diff);
          if (donusCihazColIdx !== -1) sheet.getRange(rowNum, donusCihazColIdx + 1).setValue(params.checkoutDevice || "SİSTEM_OTO");
          if (teslimEdenColIdx !== -1) {
            sheet.getRange(rowNum, teslimEdenColIdx + 1).setValue((params.driver || "Sürücü") + " (Yeni Çıkışla Kapatıldı)");
          }
          Logger.log("Önceki açık sefer otomatik kapatıldı: Satır " + rowNum + " (" + params.plate + ")");
        }
      }
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
    var plateColIdx = headers.indexOf("Plaka");
    var durumColIdx = headers.indexOf("Durum");
    var checkoutKmColIdx = headers.indexOf("Çıkış KM");
    
    if (idColIdx === -1 || checkoutKmColIdx === -1) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Sütun eşleşme hatası" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var targetRowIndex = -1;
    // 1. Doğrudan gönderilen ID ile eşleşen açık kaydı bul
    if (params.id) {
      for (var i = 1; i < data.length; i++) {
        if (data[i][idColIdx] == params.id) {
          targetRowIndex = i;
          break;
        }
      }
    }
    
    // 2. ID ile bulunamazsa ve Plaka verildiyse, o plakaya ait EN GÜNCEL (en son) AÇIK kaydı bul
    if (targetRowIndex === -1 && params.plate && plateColIdx !== -1 && durumColIdx !== -1) {
      var cleanTargetP = cleanStringForCompare(params.plate);
      for (var j = data.length - 1; j >= 1; j--) {
        if (cleanStringForCompare(data[j][plateColIdx]) === cleanTargetP && String(data[j][durumColIdx] || '').trim().toUpperCase() === "AÇIK") {
          targetRowIndex = j;
          break;
        }
      }
    }
    
    if (targetRowIndex !== -1) {
      var checkoutKm = data[targetRowIndex][checkoutKmColIdx];
      var diff = Number(params.returnKm) - Number(checkoutKm);
      
      if (diff < 0) {
        return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "HATA: Dönüş KM (" + params.returnKm + "), çıkış KM'den (" + checkoutKm + ") düşük olamaz!" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      var rowIdToUpdate = data[targetRowIndex][idColIdx];
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
      
      updateRowById(sheet, rowIdToUpdate, updateObj);
      
      // Güvenlik: Eğer bu plakaya ait arkada kalmış başka yetim açık kayıtlar varsa onları da KAPALI yap
      if (plateColIdx !== -1 && durumColIdx !== -1) {
        var finalCleanP = cleanStringForCompare(data[targetRowIndex][plateColIdx]);
        for (var k = 1; k < data.length; k++) {
          if (k !== targetRowIndex && cleanStringForCompare(data[k][plateColIdx]) === finalCleanP && String(data[k][durumColIdx] || '').trim().toUpperCase() === "AÇIK") {
            sheet.getRange(k + 1, durumColIdx + 1).setValue("KAPALI");
          }
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "İlgili açık kayıt bulunamadı" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // ----------------------------------------------------
  // D. TABLO ONARIM VE TEMİZLİK (repair_open_records)
  // ----------------------------------------------------
  else if (params.action === 'repair_open_records') {
    var resMsg = tablolariOnar();
    return ContentService.createTextOutput(JSON.stringify({ ok: true, message: resMsg }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // ----------------------------------------------------
  // E. MÜKERRER KAYITLARI SİL / TEMİZLE (clean_duplicates)
  // ----------------------------------------------------
  else if (params.action === 'clean_duplicates') {
    var resMsg = mukerrerKayitlariTemizle();
    return ContentService.createTextOutput(JSON.stringify({ ok: true, message: resMsg }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Bilinmeyen action: " + params.action }))
    .setMimeType(ContentService.MimeType.JSON);
}

// =========================================================================
// 3. DOĞRUDAN ÇALIŞTIRMA YARDIMCISI (APPS SCRIPT İÇİNDEN "ÇALIŞTIR" DEMEK İÇİN)
// =========================================================================
/**
 * Tablodaki tüm mükerrer ve yetim AÇIK seferleri tarar ve temizler.
 * Her plaka için yalnızca EN SON açık seferi bırakır, öncekileri güvenle kapatır.
 */
function tablolariOnar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getSheetSafe(ss, "Kayıtlar");
  if (!sheet || sheet.getLastRow() <= 1) return "Kayıtlar sayfası boş.";
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return h.toString().trim(); });
  var plateColIdx = headers.indexOf("Plaka");
  var durumColIdx = headers.indexOf("Durum");
  var cikisKmColIdx = headers.indexOf("Çıkış KM");
  var donusKmColIdx = headers.indexOf("Dönüş KM");
  var donusSaatiColIdx = headers.indexOf("Dönüş Saati");
  var kmFarkiColIdx = headers.indexOf("KM Farkı");
  var teslimEdenColIdx = headers.indexOf("Teslim Eden");
  
  if (plateColIdx === -1 || durumColIdx === -1) return "Plaka veya Durum sütunu bulunamadı.";
  
  var openByPlate = {};
  for (var i = 1; i < data.length; i++) {
    var durum = String(data[i][durumColIdx] || '').trim().toUpperCase();
    if (durum === "AÇIK") {
      var plk = cleanStringForCompare(data[i][plateColIdx]);
      if (!openByPlate[plk]) openByPlate[plk] = [];
      openByPlate[plk].push(i);
    }
  }
  
  var count = 0;
  for (var p in openByPlate) {
    var rows = openByPlate[p];
    if (rows.length > 1) {
      // Yalnızca en son açılan kayıt AÇIK kalsın; öncekileri kapat
      for (var r = 0; r < rows.length - 1; r++) {
        var rowIdx = rows[r];
        var rowNum = rowIdx + 1;
        var nextRowIdx = rows[r + 1];
        var cKm = Number(data[rowIdx][cikisKmColIdx]) || 0;
        var nextCKm = Number(data[nextRowIdx][cikisKmColIdx]) || cKm;
        var dKm = nextCKm >= cKm ? nextCKm : cKm;
        var diff = dKm - cKm;
        
        sheet.getRange(rowNum, durumColIdx + 1).setValue("KAPALI");
        if (donusKmColIdx !== -1) sheet.getRange(rowNum, donusKmColIdx + 1).setValue(dKm);
        if (donusSaatiColIdx !== -1) sheet.getRange(rowNum, donusSaatiColIdx + 1).setValue("18:00:00");
        if (kmFarkiColIdx !== -1) sheet.getRange(rowNum, kmFarkiColIdx + 1).setValue(diff);
        if (teslimEdenColIdx !== -1) sheet.getRange(rowNum, teslimEdenColIdx + 1).setValue("Sistem (Mükerrer Düzeltme)");
        count++;
      }
    }
  }
  
  var msg = "Onarım tamamlandı: Toplam " + count + " adet yetim açık sefer kapatıldı.";
  Logger.log(msg);
  return msg;
}

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

/**
 * Tablodaki tüm mükerrer (aynı gün/araç için çift tıklanarak girilmiş klon) seferleri temizler.
 * Apps Script editöründe üstteki fonksiyon listesinden "mukerrerKayitlariTemizle" seçip
 * "Çalıştır" (Run) butonuna basarak doğrudan çalıştırabilirsiniz.
 */
function mukerrerKayitlariTemizle() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getSheetSafe(ss, "Kayıtlar");
  if (!sheet || sheet.getLastRow() <= 1) return "Kayıtlar sayfası boş.";
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return h.toString().trim(); });
  var idColIdx = headers.indexOf("ID");
  var plateColIdx = headers.indexOf("Plaka");
  var dateColIdx = headers.indexOf("Tarih");
  var cikisKmColIdx = headers.indexOf("Çıkış KM");
  var donusKmColIdx = headers.indexOf("Dönüş KM");
  var kmFarkiColIdx = headers.indexOf("KM Farkı");
  var guzergahColIdx = headers.indexOf("Güzergah");
  var durumColIdx = headers.indexOf("Durum");
  
  if (plateColIdx === -1 || dateColIdx === -1 || cikisKmColIdx === -1) {
    return "Gerekli sütunlar (Plaka, Tarih, Çıkış KM) bulunamadı.";
  }
  
  var rowsToDelete = [];
  var seen = {};
  
  for (var i = 1; i < data.length; i++) {
    if (seen[i]) continue;
    
    var plk1 = cleanStringForCompare(data[i][plateColIdx]);
    var tar1 = String(data[i][dateColIdx]).trim();
    var cKm1 = Number(data[i][cikisKmColIdx]) || 0;
    var id1 = Number(data[i][idColIdx]) || 0;
    
    var group = [i];
    
    for (var j = i + 1; j < data.length; j++) {
      if (seen[j]) continue;
      
      var plk2 = cleanStringForCompare(data[j][plateColIdx]);
      var tar2 = String(data[j][dateColIdx]).trim();
      var cKm2 = Number(data[j][cikisKmColIdx]) || 0;
      var id2 = Number(data[j][idColIdx]) || 0;
      
      // Aynı plaka, aynı tarih ve aynı çıkış KM'si
      if (plk1 === plk2 && tar1 === tar2 && cKm1 === cKm2) {
        var timeDiffSec = Math.abs(id1 - id2) / 1000;
        var diff1 = Number(data[i][kmFarkiColIdx]) || 0;
        var diff2 = Number(data[j][kmFarkiColIdx]) || 0;
        
        // 15 dakika içinde girilmiş çift tıklama ya da 0 km farkı olan klon kayıt
        if (timeDiffSec < 900 || diff1 === 0 || diff2 === 0) {
          group.push(j);
          seen[j] = true;
        }
      }
    }
    
    if (group.length > 1) {
      seen[i] = true;
      // Gruptaki en dolu / geçerli kaydı TUT, diğer kopyaları sil
      group.sort(function(a, b) {
        var kmFarkA = Number(data[a][kmFarkiColIdx]) || 0;
        var kmFarkB = Number(data[b][kmFarkiColIdx]) || 0;
        if (kmFarkB !== kmFarkA) return kmFarkB - kmFarkA;
        var guzLenA = guzergahColIdx !== -1 ? String(data[a][guzergahColIdx] || '').length : 0;
        var guzLenB = guzergahColIdx !== -1 ? String(data[b][guzergahColIdx] || '').length : 0;
        if (guzLenB !== guzLenA) return guzLenB - guzLenA;
        return (Number(data[b][idColIdx]) || 0) - (Number(data[a][idColIdx]) || 0);
      });
      
      // group[0] kalacak, group[1..] silinecek
      for (var k = 1; k < group.length; k++) {
        rowsToDelete.push(group[k] + 1); // sheet row index (1-indexed)
      }
    }
  }
  
  if (rowsToDelete.length === 0) {
    Logger.log("Mükerrer kayıt bulunamadı. Tablo temiz.");
    return "Mükerrer kayıt bulunamadı. Tablo tamamen temiz.";
  }
  
  // Satır numaralarını BÜYÜKTEN KÜÇÜĞE doğru sırala ve sil (indekslerin kaymaması için)
  rowsToDelete.sort(function(a, b) { return b - a; });
  
  for (var d = 0; d < rowsToDelete.length; d++) {
    sheet.deleteRow(rowsToDelete[d]);
  }
  
  var resultMsg = "Başarıyla " + rowsToDelete.length + " adet mükerrer (kopya/çift tıklama) satır silindi ve tablo temizlendi.";
  Logger.log(resultMsg);
  return resultMsg;
}

