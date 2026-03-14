# Updated `Code.gs`

Paste this full code into your Google Apps Script `Code.gs`.

It is your current script updated with the leaderboard patch so the leaderboard now stores and returns:

- `score`
- `moves`
- `timeSec`

It also sorts leaderboard entries by:

1. higher `score`
2. lower `moves`
3. earlier `updatedAt`

## Full Code

```javascript
const SPREADSHEET_ID = '1hwndRcg5wqdEiW6XeFSfXuV_hc_1ZU-ERx2TUCsnimo';
const DEFAULT_TASK_SHEET = 'Task Submissions';
const DEFAULT_PUZZLE_SHEET = 'Puzzle Submissions';
const DEFAULT_LEADERBOARD_SHEET = 'Leaderboard';
const MAX_LEADERBOARD_ROWS = 500;

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || '';
    if (action === 'leaderboard') {
      var sheetName = (e.parameter.sheetName || DEFAULT_LEADERBOARD_SHEET).trim();
      var limit = Number(e.parameter.limit || MAX_LEADERBOARD_ROWS);
      var rows = getLeaderboard_(sheetName, limit);
      return json_(true, { rows: rows });
    }
    return json_(true, { message: 'OK' });
  } catch (err) {
    return json_(false, { error: String(err) });
  }
}

function doPost(e) {
  try {
    var payload = parseJsonBody_(e);

    // PlayToWL leaderboard upsert
    if (payload.action === 'upsert_leaderboard') {
      var lbSheet = (payload.sheetName || DEFAULT_LEADERBOARD_SHEET).trim();
      var result = upsertLeaderboard_(lbSheet, payload);
      return json_(true, { updated: true, row: result });
    }

    // Puzzle submission write with one-wallet-one-submission guard
    if ((payload.sheetName || '').trim() === DEFAULT_PUZZLE_SHEET) {
      var puzzleResult = appendPuzzleSubmissionUnique_(DEFAULT_PUZZLE_SHEET, payload);
      if (!puzzleResult.ok) {
        return json_(false, {
          errorCode: puzzleResult.errorCode,
          error: puzzleResult.error
        });
      }
      return json_(true, { saved: true, sheetName: DEFAULT_PUZZLE_SHEET });
    }

    // Generic event write
    if (payload.sheetName) {
      appendObjectToSheet_(payload.sheetName, payload);
      return json_(true, { saved: true, sheetName: payload.sheetName });
    }

    // Task.jsx default submission
    appendObjectToSheet_(DEFAULT_TASK_SHEET, payload);
    return json_(true, { saved: true, sheetName: DEFAULT_TASK_SHEET });
  } catch (err) {
    return json_(false, { error: String(err) });
  }
}

function parseJsonBody_(e) {
  var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
  var obj = {};
  try {
    obj = JSON.parse(raw);
  } catch (_) {
    obj = {};
  }
  return obj && typeof obj === 'object' ? obj : {};
}

function json_(ok, data) {
  var out = Object.assign({ ok: ok }, data || {});
  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getOrCreateSheet_(sheetName) {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) sh = ss.insertSheet(sheetName);
  return sh;
}

function appendObjectToSheet_(sheetName, obj) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = getOrCreateSheet_(sheetName);
    var data = Object.assign({}, obj);

    if (!data.timestamp) data.timestamp = Date.now();
    data.serverTime = new Date().toISOString();

    var keys = Object.keys(data);
    if (keys.length === 0) keys = ['timestamp', 'serverTime'];

    ensureHeader_(sh, keys);

    var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var row = header.map(function (k) {
      return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : '';
    });

    sh.appendRow(row);
  } finally {
    lock.releaseLock();
  }
}

function appendPuzzleSubmissionUnique_(sheetName, obj) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = getOrCreateSheet_(sheetName);
    var data = Object.assign({}, obj);
    var incomingWallet = norm_(data.walletAddress);
    if (!incomingWallet) {
      return { ok: false, errorCode: 'missing_wallet', error: 'walletAddress is required.' };
    }

    if (!data.timestamp) data.timestamp = Date.now();
    data.serverTime = new Date().toISOString();

    var required = [
      'sheetName', 'eventType', 'xUsername', 'walletAddress', 'tweetLink',
      'requiredCaption', 'bestScore', 'currentScore', 'moves', 'time',
      'attemptNumber', 'sessionID', 'qualified', 'imageData', 'timestamp', 'serverTime'
    ];
    var keys = Object.keys(data);
    if (keys.length === 0) keys = required.slice();
    ensureHeader_(sh, required.concat(keys));

    var values = sh.getDataRange().getValues();
    var header = values[0] || [];
    var walletCol = header.indexOf('walletAddress');
    if (walletCol >= 0 && values.length > 1) {
      for (var i = 1; i < values.length; i++) {
        if (norm_(values[i][walletCol]) === incomingWallet) {
          return {
            ok: false,
            errorCode: 'duplicate_wallet',
            error: 'Wallet already submitted.'
          };
        }
      }
    }

    var row = header.map(function (k) {
      return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : '';
    });
    sh.appendRow(row);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function ensureHeader_(sh, keys) {
  var lastCol = sh.getLastColumn();
  if (lastCol === 0) {
    sh.getRange(1, 1, 1, keys.length).setValues([keys]);
    return;
  }

  var existing = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var merged = existing.slice();

  keys.forEach(function (k) {
    if (merged.indexOf(k) === -1) merged.push(k);
  });

  if (merged.length !== existing.length) {
    sh.getRange(1, 1, 1, merged.length).setValues([merged]);
  }
}

function getLeaderboard_(sheetName, limit) {
  var sh = getOrCreateSheet_(sheetName);
  ensureHeader_(sh, ['timestamp', 'updatedAt', 'eventType', 'browserId', 'xUsername', 'walletAddress', 'score', 'moves', 'timeSec']);

  if (sh.getLastRow() < 2) return [];

  var values = sh.getDataRange().getValues();
  var header = values[0];
  var rows = values.slice(1).map(function (r) {
    var o = {};
    for (var i = 0; i < header.length; i++) o[header[i]] = r[i];
    return o;
  });

  return rows
    .map(function (r) {
      return {
        browserId: String(r.browserId || ''),
        xUsername: String(r.xUsername || ''),
        walletAddress: String(r.walletAddress || ''),
        score: Number(r.score || 0),
        moves: Number(r.moves || 0) || null,
        timeSec: Number(r.timeSec || r.time || 0) || null,
        updatedAt: Number(r.updatedAt || r.timestamp || Date.now())
      };
    })
    .filter(function (r) { return r.score > 0; })
    .sort(function (a, b) {
      var scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;

      var aMoves = Number.isFinite(Number(a.moves)) && Number(a.moves) > 0 ? Number(a.moves) : Number.MAX_SAFE_INTEGER;
      var bMoves = Number.isFinite(Number(b.moves)) && Number(b.moves) > 0 ? Number(b.moves) : Number.MAX_SAFE_INTEGER;
      var moveDiff = aMoves - bMoves;
      if (moveDiff !== 0) return moveDiff;

      return Number(a.updatedAt || 0) - Number(b.updatedAt || 0);
    })
    .slice(0, Math.max(1, Math.min(Number(limit) || MAX_LEADERBOARD_ROWS, MAX_LEADERBOARD_ROWS)));
}

function upsertLeaderboard_(sheetName, payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = getOrCreateSheet_(sheetName);
    var required = ['timestamp', 'updatedAt', 'eventType', 'browserId', 'xUsername', 'walletAddress', 'score', 'moves', 'timeSec'];
    ensureHeader_(sh, required);

    var values = sh.getDataRange().getValues();
    var header = values[0];
    var rows = values.slice(1).map(function (r) {
      var o = {};
      for (var i = 0; i < header.length; i++) o[header[i]] = r[i];
      return o;
    });

    var incoming = {
      timestamp: Number(payload.timestamp || Date.now()),
      updatedAt: Date.now(),
      eventType: String(payload.eventType || 'leaderboard_entry'),
      browserId: String(payload.browserId || ''),
      xUsername: String(payload.xUsername || ''),
      walletAddress: String(payload.walletAddress || ''),
      score: Number(payload.score || 0),
      moves: Number(payload.moves || 0),
      timeSec: Number(payload.timeSec || payload.time || 0)
    };

    var matchIndex = rows.findIndex(function (r) {
      var sameBrowser = incoming.browserId && String(r.browserId || '') === incoming.browserId;
      var sameWallet = incoming.walletAddress && norm_(r.walletAddress) === norm_(incoming.walletAddress);
      var sameUser = incoming.xUsername && norm_(r.xUsername) === norm_(incoming.xUsername);
      return sameBrowser || sameWallet || sameUser;
    });

    if (matchIndex >= 0) {
      var existingScore = Number(rows[matchIndex].score || 0);
      var existingMoves = Number.isFinite(Number(rows[matchIndex].moves)) && Number(rows[matchIndex].moves) > 0
        ? Number(rows[matchIndex].moves)
        : Number.MAX_SAFE_INTEGER;

      var shouldReplace =
        incoming.score > existingScore ||
        (incoming.score === existingScore && incoming.moves < existingMoves);

      if (shouldReplace) {
        rows[matchIndex] = Object.assign({}, rows[matchIndex], incoming);
      } else {
        rows[matchIndex] = Object.assign({}, rows[matchIndex], {
          updatedAt: Date.now(),
          xUsername: incoming.xUsername || rows[matchIndex].xUsername,
          walletAddress: incoming.walletAddress || rows[matchIndex].walletAddress
        });
      }
    } else {
      rows.push(incoming);
    }

    rows = rows
      .filter(function (r) { return Number(r.score || 0) > 0; })
      .sort(function (a, b) {
        var scoreDiff = Number(b.score || 0) - Number(a.score || 0);
        if (scoreDiff !== 0) return scoreDiff;

        var aMoves = Number.isFinite(Number(a.moves)) && Number(a.moves) > 0 ? Number(a.moves) : Number.MAX_SAFE_INTEGER;
        var bMoves = Number.isFinite(Number(b.moves)) && Number(b.moves) > 0 ? Number(b.moves) : Number.MAX_SAFE_INTEGER;
        var moveDiff = aMoves - bMoves;
        if (moveDiff !== 0) return moveDiff;

        return Number(a.updatedAt || 0) - Number(b.updatedAt || 0);
      })
      .slice(0, MAX_LEADERBOARD_ROWS);

    sh.clearContents();
    sh.getRange(1, 1, 1, required.length).setValues([required]);

    if (rows.length > 0) {
      var out = rows.map(function (r) {
        return required.map(function (k) {
          return Object.prototype.hasOwnProperty.call(r, k) ? r[k] : '';
        });
      });
      sh.getRange(2, 1, out.length, required.length).setValues(out);
    }

    return incoming;
  } finally {
    lock.releaseLock();
  }
}

function norm_(v) {
  return String(v || '').trim().toLowerCase();
}
```

## After Pasting

1. Save the Apps Script
2. Deploy a new web app version
3. Test a fresh puzzle completion

## Leaderboard Columns

The leaderboard sheet will now use:

```text
timestamp | updatedAt | eventType | browserId | xUsername | walletAddress | score | moves | timeSec
```
