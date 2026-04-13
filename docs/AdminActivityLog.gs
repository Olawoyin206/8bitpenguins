const DEFAULT_ADMIN_LOG_SHEET = 'Admin Activity Log';
const MAX_ADMIN_LOG_ROWS = 500;

// Add inside doGet(e)
// if (action === 'admin_log_list') {
//   var adminLogSheet = (e.parameter.sheetName || DEFAULT_ADMIN_LOG_SHEET).trim();
//   var adminLogLimit = Number(e.parameter.limit || MAX_ADMIN_LOG_ROWS);
//   return json_(true, { rows: getAdminLog_(adminLogSheet, adminLogLimit) });
// }

// Add inside doPost(e)
// if (payload.action === 'admin_log_append') {
//   var appendSheet = (payload.sheetName || DEFAULT_ADMIN_LOG_SHEET).trim();
//   appendAdminLog_(appendSheet, payload);
//   return json_(true, { saved: true, sheetName: appendSheet });
// }
//
// if (payload.action === 'admin_log_clear') {
//   var clearSheet = (payload.sheetName || DEFAULT_ADMIN_LOG_SHEET).trim();
//   clearAdminLog_(clearSheet);
//   return json_(true, { cleared: true, sheetName: clearSheet });
// }

function getAdminLog_(sheetName, limit) {
  var sh = getOrCreateSheet_(sheetName);
  ensureHeader_(sh, ['id', 'ts', 'level', 'source', 'message', 'txHash', 'serverTime']);

  if (sh.getLastRow() < 2) return [];

  var values = sh.getDataRange().getValues();
  var header = values[0] || [];
  var rows = values.slice(1).map(function (row) {
    var out = {};
    for (var i = 0; i < header.length; i++) out[header[i]] = row[i];
    return out;
  });

  return rows
    .map(function (row) {
      return {
        id: String(row.id || ''),
        ts: Number(row.ts || row.timestamp || Date.now()),
        level: String(row.level || 'info'),
        source: String(row.source || 'system'),
        message: String(row.message || ''),
        txHash: String(row.txHash || '')
      };
    })
    .filter(function (row) { return row.message; })
    .sort(function (a, b) { return Number(b.ts || 0) - Number(a.ts || 0); })
    .slice(0, Math.max(1, Math.min(Number(limit) || MAX_ADMIN_LOG_ROWS, MAX_ADMIN_LOG_ROWS)));
}

function appendAdminLog_(sheetName, payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = getOrCreateSheet_(sheetName);
    var data = {
      id: String(payload.id || Utilities.getUuid()),
      ts: Number(payload.ts || Date.now()),
      level: String(payload.level || 'info'),
      source: String(payload.source || 'system'),
      message: String(payload.message || '').trim(),
      txHash: String(payload.txHash || ''),
      serverTime: new Date().toISOString()
    };

    if (!data.message) {
      throw new Error('message is required');
    }

    ensureHeader_(sh, ['id', 'ts', 'level', 'source', 'message', 'txHash', 'serverTime']);

    var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var row = header.map(function (key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : '';
    });
    sh.appendRow(row);

    trimSheetRows_(sh, MAX_ADMIN_LOG_ROWS);
  } finally {
    lock.releaseLock();
  }
}

function clearAdminLog_(sheetName) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = getOrCreateSheet_(sheetName);
    ensureHeader_(sh, ['id', 'ts', 'level', 'source', 'message', 'txHash', 'serverTime']);
    var lastRow = sh.getLastRow();
    if (lastRow > 1) {
      sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).clearContent();
    }
  } finally {
    lock.releaseLock();
  }
}

function trimSheetRows_(sh, keepRows) {
  var lastRow = sh.getLastRow();
  var overflow = lastRow - (keepRows + 1);
  if (overflow > 0) {
    sh.deleteRows(2, overflow);
  }
}
