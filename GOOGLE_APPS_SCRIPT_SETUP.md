# Google Apps Script Setup (Task + PlayToWL Leaderboard)

This guide contains the full Google Apps Script backend used by:

- `src/Task.jsx` submission POST
- `src/PlayToWL.jsx` leaderboard GET (`action=leaderboard`)
- `src/PlayToWL.jsx` leaderboard upsert POST (`action=upsert_leaderboard`)

## 1) Create Google Sheet

1. Create a new Google Sheet.
2. Copy its Spreadsheet ID from the URL:
   - `https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`
3. You do not need to create tabs manually; script auto-creates them.
4. Default sheet names used:
   - `Task Submissions`
   - `Puzzle Submissions`
   - `Leaderboard`

## 2) Create Apps Script Project

1. Open `https://script.google.com`.
2. Create a new project.
3. Replace the default `Code.gs` with the code below.
4. Set `SPREADSHEET_ID` to your real sheet ID.

## 3) Full `Code.gs`

```javascript
const SPREADSHEET_ID = 'PUT_YOUR_SHEET_ID_HERE';
const DEFAULT_TASK_SHEET = 'Task Submissions';
const DEFAULT_PUZZLE_SHEET = 'Puzzle Submissions';
const DEFAULT_LEADERBOARD_SHEET = 'Leaderboard';
const MAX_LEADERBOARD_ROWS = 100;

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
        updatedAt: Number(r.updatedAt || r.timestamp || Date.now())
      };
    })
    .filter(function (r) { return r.score > 0; })
    .sort(function (a, b) { return b.score - a.score; })
    .slice(0, Math.max(1, Math.min(Number(limit) || MAX_LEADERBOARD_ROWS, MAX_LEADERBOARD_ROWS)));
}

function upsertLeaderboard_(sheetName, payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = getOrCreateSheet_(sheetName);
    var required = ['timestamp', 'updatedAt', 'eventType', 'browserId', 'xUsername', 'walletAddress', 'score'];
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
      score: Number(payload.score || 0)
    };

    var matchIndex = rows.findIndex(function (r) {
      var sameBrowser = incoming.browserId && String(r.browserId || '') === incoming.browserId;
      var sameWallet = incoming.walletAddress && norm_(r.walletAddress) === norm_(incoming.walletAddress);
      var sameUser = incoming.xUsername && norm_(r.xUsername) === norm_(incoming.xUsername);
      return sameBrowser || sameWallet || sameUser;
    });

    if (matchIndex >= 0) {
      var existingScore = Number(rows[matchIndex].score || 0);
      if (incoming.score > existingScore) {
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
      .sort(function (a, b) { return Number(b.score || 0) - Number(a.score || 0); })
      .slice(0, MAX_LEADERBOARD_ROWS);

    sh.clearContents();
    sh.getRange(1, 1, 1, required.length).setValues([required]);

    if (rows.length > 0) {
      var out = rows.map(function (r) {
        return required.map(function (k) { return r[k] || ''; });
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

## 4) Deploy as Web App

1. Click **Deploy** -> **New deployment**.
2. Type: **Web app**.
3. Execute as: **Me**.
4. Who has access: **Anyone**.
5. Click **Deploy** and copy the `/exec` URL.

## 5) Wire URL in frontend

Your app currently points to:

- `src/Task.jsx`
- `src/PlayToWL.jsx`

Both should use the same deployed Web App URL, for example:

```text
https://script.google.com/macros/s/AKfycbzjI_MtGVQX6pyisMDL8aD_ah7YCG_73NNaEY2Ye5BgWw-Q04J9sfHL95jn7FriLCcl/exec
```

## 6) Quick tests

### Test leaderboard GET

Open this in browser:

```text
YOUR_WEB_APP_URL?action=leaderboard&sheetName=Leaderboard&limit=20
```

Expected response:

```json
{"ok":true,"rows":[]}
```

### Test leaderboard upsert (POST)

Send POST body:

```json
{
  "action": "upsert_leaderboard",
  "sheetName": "Leaderboard",
  "eventType": "leaderboard_entry",
  "browserId": "b_test_001",
  "xUsername": "@testuser",
  "walletAddress": "0x1111111111111111111111111111111111111111",
  "score": 850,
  "timestamp": 1760000000000
}
```

### Test task submission (POST)

Send POST body:

```json
{
  "twitterUsername": "@taskuser",
  "walletAddress": "0x2222222222222222222222222222222222222222",
  "tweetLink": "https://x.com/test/status/1234567890",
  "timestamp": 1760000000000
}
```

### Test puzzle submission duplicate guard (POST)

Send this once (expected success), then send it again unchanged (expected duplicate):

```json
{
  "sheetName": "Puzzle Submissions",
  "eventType": "puzzle_submission",
  "xUsername": "@puzzleuser",
  "walletAddress": "0x3333333333333333333333333333333333333333",
  "tweetLink": "https://x.com/test/status/1234567890",
  "requiredCaption": "Just Solved The @8bitpenguin_xyz puzzle",
  "bestScore": 900,
  "currentScore": 900,
  "moves": 41,
  "time": 118,
  "attemptNumber": 1,
  "sessionID": "b_test_3333",
  "qualified": true,
  "imageData": "/favicon.png",
  "timestamp": 1760000000000
}
```

## 7) Puzzle submission details (what is sent after successful solve)

When a user solves the puzzle and submits proof on the PlayToWL page, `src/PlayToWL.jsx` sends this payload to Google Apps Script:

```json
{
  "sheetName": "Puzzle Submissions",
  "eventType": "puzzle_submission",
  "xUsername": "@username",
  "walletAddress": "0xabc...123",
  "tweetLink": "https://x.com/user/status/1234567890",
  "requiredCaption": "Just Solved The @8bitpenguin_xyz puzzle",
  "bestScore": 910,
  "currentScore": 905,
  "moves": 44,
  "time": 126,
  "attemptNumber": 2,
  "sessionID": "btest1234",
  "qualified": true,
  "imageData": "data:image/png;base64,... or /favicon.png",
  "timestamp": 1760000000000
}
```

Field meaning:

- `sheetName`: Target sheet tab (`Puzzle Submissions`).
- `eventType`: Event marker (`puzzle_submission`).
- `xUsername`: Player X handle.
- `walletAddress`: EVM wallet submitted by player.
- `tweetLink`: Proof tweet URL.
- `requiredCaption`: Required tweet caption text.
- `bestScore`: Best local score recorded for that browser.
- `currentScore`: Current run score at submission time.
- `moves`: Move count for the submitted solved run.
- `time`: Solve duration in seconds for the submitted run.
- `attemptNumber`: Attempt number used in current rate-limit window.
- `sessionID`: Browser/session identifier used by the game.
- `qualified`: Whether score reached target threshold.
- `imageData`: Qualified image snapshot/base64 (or fallback image URL).
- `timestamp`: Client timestamp in milliseconds.

Duplicate-wallet behavior:

- First submission for wallet: `{"ok":true,"saved":true,...}`
- Any later submission with same `walletAddress`: `{"ok":false,"errorCode":"duplicate_wallet","error":"Wallet already submitted."}`

After this, leaderboard sync also sends:

```json
{
  "action": "upsert_leaderboard",
  "sheetName": "Leaderboard",
  "eventType": "leaderboard_entry",
  "browserId": "bxxxxxxx",
  "xUsername": "@username",
  "walletAddress": "0xabc...123",
  "score": 910,
  "timestamp": 1760000000000
}
```

## 8) Common issues

- If requests fail with CORS/permission errors, redeploy and set access to **Anyone**.
- If no rows appear, confirm `SPREADSHEET_ID` is correct and redeploy after changes.
- If frontend still uses old deployment URL, update `GOOGLE_SCRIPT_URL` in both files.
