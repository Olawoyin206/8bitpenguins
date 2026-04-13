```javascript
const SPREADSHEET_ID = '1hwndRcg5wqdEiW6XeFSfXuV_hc_1ZU-ERx2TUCsnimo';
const DEFAULT_TASK_SHEET = 'Task Submissions';
const DEFAULT_PUZZLE_SHEET = 'Puzzle Submissions';
const DEFAULT_PUZZLE_PROFILE_SHEET = 'Puzzle Profiles';
const DEFAULT_LEADERBOARD_SHEET = 'Leaderboard';
const DEFAULT_GAME_ANALYTICS_SHEET = 'Game Analytics';
const DEFAULT_ADMIN_LOG_SHEET = 'Admin Activity Log';
const MAX_LEADERBOARD_ROWS = 1000;
const MAX_ADMIN_LOG_ROWS = 500;
const RETURNING_PLAYER_GAP_MS = 30 * 60 * 1000;
const PUZZLE_PROOF_WINDOW_MS = 24 * 60 * 60 * 1000;
const PUZZLE_TARGET_SCORE = 500;
const LEADERBOARD_PROOF_DEADLINE_MS = 24 * 60 * 60 * 1000;
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_SECRET_PROPERTY = 'TURNSTILE_SECRET_KEY';
const TURNSTILE_HOSTNAME_PROPERTY = 'TURNSTILE_EXPECTED_HOSTNAME';

function onOpen(e) {
  var scriptProps = PropertiesService.getScriptProperties();
  var backfillDone = scriptProps.getProperty('LEADERBOARD_BACKFILL_DONE');
  if (backfillDone !== 'true') {
    try {
      var result = backfillLeaderboardFromPuzzleSubmissions_();
      Logger.log('Auto backfill result: ' + JSON.stringify(result));
    } catch (err) {
      Logger.log('Auto backfill error: ' + String(err));
    }
  }
}

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || '';
    if (action === 'leaderboard') {
      var sheetName = (e.parameter.sheetName || DEFAULT_LEADERBOARD_SHEET).trim();
      var limit = Number(e.parameter.limit || MAX_LEADERBOARD_ROWS);
      var rows = getLeaderboard_(sheetName, limit);
      return json_(true, { rows: rows });
    }
    if (action === 'task_submission_status') {
      var taskSheet = (e.parameter.sheetName || DEFAULT_TASK_SHEET).trim();
      var taskStatus = getTaskSubmissionStatus_(taskSheet, {
        tweetId: e.parameter.tweetId || '',
        tweetLink: e.parameter.tweetLink || '',
        twitterUsername: e.parameter.twitterUsername || '',
        walletAddress: e.parameter.walletAddress || ''
      });
      return json_(true, taskStatus);
    }
    if (action === 'puzzle_proof_status') {
      var proofPuzzleSheet = (e.parameter.puzzleSheetName || DEFAULT_PUZZLE_SHEET).trim();
      var proofAnalyticsSheet = (e.parameter.analyticsSheetName || DEFAULT_GAME_ANALYTICS_SHEET).trim();
      var proofStatus = getPuzzleProofStatus_(proofPuzzleSheet, proofAnalyticsSheet, {
        xUsername: e.parameter.xUsername || '',
        walletAddress: e.parameter.walletAddress || ''
      });
      return json_(true, proofStatus);
    }
    if (action === 'admin_log_list') {
      var adminLogSheet = (e.parameter.sheetName || DEFAULT_ADMIN_LOG_SHEET).trim();
      var adminLogLimit = Number(e.parameter.limit || MAX_ADMIN_LOG_ROWS);
      return json_(true, { rows: getAdminLog_(adminLogSheet, adminLogLimit) });
    }
    if (action === 'game_stats_summary') {
      var analyticsSheet = (e.parameter.analyticsSheetName || DEFAULT_GAME_ANALYTICS_SHEET).trim();
      var leaderboardSheet = (e.parameter.leaderboardSheetName || DEFAULT_LEADERBOARD_SHEET).trim();
      var puzzleSheet = (e.parameter.puzzleSheetName || DEFAULT_PUZZLE_SHEET).trim();
      var period = normalizeStatsPeriod_(e.parameter.period || 'all');
      return json_(true, getGameStatsSummary_(analyticsSheet, leaderboardSheet, puzzleSheet, period));
    }
    return json_(true, { message: 'OK' });
  } catch (err) {
    return json_(false, { error: String(err) });
  }
}

function doPost(e) {
  try {
    var payload = parseJsonBody_(e);

    if (payload.action === 'admin_log_append') {
      var appendSheet = (payload.sheetName || DEFAULT_ADMIN_LOG_SHEET).trim();
      appendAdminLog_(appendSheet, payload);
      return json_(true, { saved: true, sheetName: appendSheet });
    }

    if (payload.action === 'admin_log_clear') {
      var clearSheet = (payload.sheetName || DEFAULT_ADMIN_LOG_SHEET).trim();
      clearAdminLog_(clearSheet);
      return json_(true, { cleared: true, sheetName: clearSheet });
    }

    // PlayToWL leaderboard upsert
    if (payload.action === 'upsert_leaderboard') {
      var lbSheet = (payload.sheetName || DEFAULT_LEADERBOARD_SHEET).trim();
      var result = upsertLeaderboard_(lbSheet, payload);
      return json_(true, { updated: true, row: result });
    }

    if (payload.action === 'reconcile_leaderboard_with_puzzle') {
      var reconcileLeaderboardSheet = (payload.leaderboardSheetName || payload.sheetName || DEFAULT_LEADERBOARD_SHEET).trim();
      var reconcilePuzzleSheet = (payload.puzzleSheetName || DEFAULT_PUZZLE_SHEET).trim();
      var reconcileResult = reconcileLeaderboardWithPuzzle_(reconcileLeaderboardSheet, reconcilePuzzleSheet);
      return json_(true, reconcileResult);
    }

    if (payload.action === 'repair_leaderboard_from_puzzle') {
      var repairLeaderboardSheet = (payload.leaderboardSheetName || payload.sheetName || DEFAULT_LEADERBOARD_SHEET).trim();
      var repairPuzzleSheet = (payload.puzzleSheetName || DEFAULT_PUZZLE_SHEET).trim();
      var repairResult = repairLeaderboardFromPuzzle_(repairLeaderboardSheet, repairPuzzleSheet);
      return json_(true, repairResult);
    }

    if (payload.action === 'backfill_leaderboard_from_puzzle') {
      var backfillLeaderboardSheet = (payload.leaderboardSheetName || payload.sheetName || DEFAULT_LEADERBOARD_SHEET).trim();
      var backfillPuzzleSheet = (payload.puzzleSheetName || DEFAULT_PUZZLE_SHEET).trim();
      var backfillResult = backfillLeaderboardFromPuzzleSubmissions_(backfillPuzzleSheet, backfillLeaderboardSheet);
      return json_(true, backfillResult);
    }

    if (payload.action === 'game_analytics_event') {
      var analyticsSheet = (payload.sheetName || DEFAULT_GAME_ANALYTICS_SHEET).trim();
      appendGameAnalyticsEvent_(analyticsSheet, payload);
      return json_(true, { saved: true, sheetName: analyticsSheet });
    }

    if ((payload.sheetName || '').trim() === DEFAULT_PUZZLE_PROFILE_SHEET) {
      var profileValidation = validatePuzzleProfilePayload_(payload);
      if (!profileValidation.ok) {
        return json_(false, {
          errorCode: profileValidation.errorCode,
          error: profileValidation.error
        });
      }

      var profileResult = appendPuzzleProfileRecord_(DEFAULT_PUZZLE_PROFILE_SHEET, payload);
      if (!profileResult.ok) {
        return json_(false, {
          errorCode: profileResult.errorCode,
          error: profileResult.error
        });
      }
      return json_(true, { saved: true, sheetName: DEFAULT_PUZZLE_PROFILE_SHEET, updatedExisting: Boolean(profileResult.updatedExisting) });
    }

    // Puzzle submission write with one-wallet-one-submission guard
    if ((payload.sheetName || '').trim() === DEFAULT_PUZZLE_SHEET) {
      var captchaResult = verifyTurnstileToken_(payload.turnstileToken, payload.turnstileAction || 'puzzle_proof_submit');
      if (!captchaResult.ok) {
        return json_(false, {
          errorCode: captchaResult.errorCode,
          error: captchaResult.error
        });
      }
      delete payload.turnstileToken;
      delete payload.turnstileAction;

      var proofValidation = validatePuzzleSubmissionPayload_(payload);
      if (!proofValidation.ok) {
        return json_(false, {
          errorCode: proofValidation.errorCode,
          error: proofValidation.error
        });
      }

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
    if (payload.sheetName && String(payload.sheetName).trim() !== DEFAULT_TASK_SHEET) {
      appendObjectToSheet_(payload.sheetName, payload);
      return json_(true, { saved: true, sheetName: payload.sheetName });
    }

    // Task.jsx default submission with uniqueness guard
    var taskResult = appendTaskSubmissionUnique_(DEFAULT_TASK_SHEET, payload);
    if (!taskResult.ok) {
      return json_(false, {
        errorCode: taskResult.errorCode,
        error: taskResult.error
      });
    }
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

function verifyTurnstileToken_(token, expectedAction) {
  var normalizedToken = String(token || '').trim();
  if (!normalizedToken) {
    return { ok: false, errorCode: 'captcha_missing', error: 'Captcha is required.' };
  }

  var secret = String(PropertiesService.getScriptProperties().getProperty(TURNSTILE_SECRET_PROPERTY) || '').trim();
  if (!secret) {
    return { ok: false, errorCode: 'captcha_not_configured', error: 'Captcha secret is not configured.' };
  }

  var response = UrlFetchApp.fetch(TURNSTILE_VERIFY_URL, {
    method: 'post',
    muteHttpExceptions: true,
    payload: {
      secret: secret,
      response: normalizedToken
    }
  });
  var payload = {};
  try {
    payload = JSON.parse(response.getContentText() || '{}');
  } catch (_) {
    payload = {};
  }

  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 || !payload.success) {
    return { ok: false, errorCode: 'captcha_failed', error: 'Captcha verification failed.' };
  }

  if (expectedAction && payload.action && String(payload.action) !== String(expectedAction)) {
    return { ok: false, errorCode: 'captcha_action_mismatch', error: 'Captcha action did not match this request.' };
  }

  var expectedHostname = String(PropertiesService.getScriptProperties().getProperty(TURNSTILE_HOSTNAME_PROPERTY) || '').trim().toLowerCase();
  var responseHostname = String(payload.hostname || '').trim().toLowerCase();
  if (expectedHostname && responseHostname && expectedHostname !== responseHostname) {
    return { ok: false, errorCode: 'captcha_hostname_mismatch', error: 'Captcha hostname did not match this app.' };
  }

  return { ok: true };
}

function normalizePuzzleUsernameForValidation_(value) {
  return String(value || '').trim().replace(/^@+/, '').toLowerCase();
}

function isValidPuzzleUsername_(value) {
  return /^[A-Za-z0-9_]{1,15}$/.test(String(value || '').trim().replace(/^@+/, ''));
}

function isValidPuzzleWallet_(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || '').trim());
}

function validatePuzzleProfilePayload_(payload) {
  var username = normalizePuzzleUsernameForValidation_(payload.xUsername);
  var wallet = String(payload.walletAddress || '').trim();
  var tweetLink = String(payload.tweetLink || '').trim();
  var tweetId = String(payload.tweetId || '').trim() || extractTweetIdLoose_(tweetLink);

  if (!isValidPuzzleUsername_(username)) {
    return { ok: false, errorCode: 'invalid_username', error: 'A valid X username is required.' };
  }
  if (!isValidPuzzleWallet_(wallet)) {
    return { ok: false, errorCode: 'invalid_wallet', error: 'A valid wallet address is required.' };
  }
  if (!tweetLink && !tweetId) {
    return { ok: false, errorCode: 'missing_tweet', error: 'A valid tweet link is required.' };
  }

  return { ok: true };
}

function validatePuzzleSubmissionPayload_(payload) {
  var username = normalizePuzzleUsernameForValidation_(payload.xUsername);
  var wallet = String(payload.walletAddress || '').trim();
  var tweetLink = String(payload.tweetLink || '').trim();
  var tweetId = String(payload.tweetId || '').trim() || extractTweetIdLoose_(tweetLink);
  var currentScore = Number(payload.currentScore || 0);
  var qualified = payload.qualified === true || String(payload.qualified || '').toLowerCase() === 'true';

  if (!isValidPuzzleUsername_(username)) {
    return { ok: false, errorCode: 'invalid_username', error: 'A valid X username is required.' };
  }
  if (!isValidPuzzleWallet_(wallet)) {
    return { ok: false, errorCode: 'invalid_wallet', error: 'A valid wallet address is required.' };
  }
  if (!tweetLink && !tweetId) {
    return { ok: false, errorCode: 'missing_tweet', error: 'A valid tweet link is required.' };
  }
  if (!qualified || currentScore < PUZZLE_TARGET_SCORE) {
    return { ok: false, errorCode: 'not_qualified', error: 'Only qualified runs can submit proof.' };
  }

  return { ok: true };
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

function appendPuzzleProfileRecord_(sheetName, obj) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = getOrCreateSheet_(sheetName);
    var data = Object.assign({}, obj);
    data.browserId = String(data.browserId || '').trim();
    data.xUsername = String(data.xUsername || '').trim();
    data.walletAddress = String(data.walletAddress || '').trim();
    data.tweetLink = String(data.tweetLink || '').trim();
    data.tweetId = String(data.tweetId || '').trim() || extractTweetIdLoose_(data.tweetLink);
    data.verifiedTweetUsername = String(data.verifiedTweetUsername || '').trim();
    if (!data.timestamp) data.timestamp = Date.now();
    data.serverTime = new Date().toISOString();

    var required = ['sheetName', 'eventType', 'browserId', 'xUsername', 'walletAddress', 'tweetLink', 'tweetId', 'verifiedTweetUsername', 'timestamp', 'serverTime'];
    ensureHeader_(sh, required);

    var values = sh.getDataRange().getValues();
    var header = values[0] || [];
    var walletCol = header.indexOf('walletAddress');
    var xCol = header.indexOf('xUsername');

    if (values.length > 1 && walletCol >= 0 && xCol >= 0) {
      for (var i = values.length - 1; i >= 1; i--) {
        var sameWallet = norm_(values[i][walletCol]) === norm_(data.walletAddress);
        var sameX = normalizePuzzleUsernameForValidation_(values[i][xCol]) === normalizePuzzleUsernameForValidation_(data.xUsername);
        if (sameWallet && sameX) {
          var rowValues = header.map(function (key, index) {
            if (Object.prototype.hasOwnProperty.call(data, key)) return data[key];
            return values[i][index];
          });
          sh.getRange(i + 1, 1, 1, header.length).setValues([rowValues]);
          return { ok: true, updatedExisting: true };
        }
      }
    }

    var row = header.map(function (k) {
      return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : '';
    });
    sh.appendRow(row);
    return { ok: true, updatedExisting: false };
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

    data.tweetLink = String(data.tweetLink || '').trim();
    data.tweetId = String(data.tweetId || '').trim() || extractTweetIdLoose_(data.tweetLink);
    if (!data.timestamp) data.timestamp = Date.now();
    data.serverTime = new Date().toISOString();

    var required = [
      'sheetName', 'eventType', 'xUsername', 'walletAddress', 'tweetLink', 'tweetId',
      'requiredCaption', 'bestScore', 'currentScore', 'moves', 'time',
      'attemptNumber', 'sessionID', 'qualified', 'imageData', 'timestamp', 'serverTime'
    ];
    var keys = Object.keys(data);
    if (keys.length === 0) keys = required.slice();
    ensureHeader_(sh, required.concat(keys));

    var values = sh.getDataRange().getValues();
    var header = values[0] || [];
    var walletCol = header.indexOf('walletAddress');
    var tweetLinkCol = header.indexOf('tweetLink');
    var tweetIdCol = header.indexOf('tweetId');
    if (walletCol >= 0 && values.length > 1) {
      for (var i = 1; i < values.length; i++) {
        if (norm_(values[i][walletCol]) === incomingWallet) {
          var storedTweetLink = tweetLinkCol >= 0 ? String(values[i][tweetLinkCol] || '').trim() : '';
          var storedTweetId = tweetIdCol >= 0 ? String(values[i][tweetIdCol] || '').trim() : '';
          var canBackfillProof = !storedTweetLink && !storedTweetId && (data.tweetLink || data.tweetId);

          if (canBackfillProof) {
            var rowValues = values[i].slice();
            for (var c = 0; c < header.length; c++) {
              var key = header[c];
              if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
              rowValues[c] = data[key];
            }
            sh.getRange(i + 1, 1, 1, header.length).setValues([rowValues]);
            return { ok: true, updatedExisting: true };
          }
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

function appendGameAnalyticsEvent_(sheetName, payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = getOrCreateSheet_(sheetName);
    var data = {
      action: 'game_analytics_event',
      eventType: String(payload.eventType || '').trim(),
      browserId: String(payload.browserId || '').trim(),
      clientSessionId: String(payload.clientSessionId || '').trim(),
      runId: String(payload.runId || '').trim(),
      xUsername: String(payload.xUsername || '').trim(),
      walletAddress: String(payload.walletAddress || '').trim(),
      attemptNumber: Number(payload.attemptNumber || 0),
      score: Number(payload.score || 0),
      bestScore: Number(payload.bestScore || 0),
      moves: Number(payload.moves || 0),
      timeSec: Number(payload.timeSec || payload.time || 0),
      qualified: payload.qualified === true || String(payload.qualified || '').toLowerCase() === 'true',
      outcome: String(payload.outcome || '').trim(),
      isReturningProfile: payload.isReturningProfile === true || String(payload.isReturningProfile || '').toLowerCase() === 'true',
      timestamp: Number(payload.timestamp || Date.now()),
      serverTime: new Date().toISOString()
    };

    if (!data.eventType) {
      throw new Error('eventType is required');
    }

    ensureHeader_(sh, [
      'action',
      'eventType',
      'browserId',
      'clientSessionId',
      'runId',
      'xUsername',
      'walletAddress',
      'attemptNumber',
      'score',
      'bestScore',
      'moves',
      'timeSec',
      'qualified',
      'outcome',
      'isReturningProfile',
      'timestamp',
      'serverTime'
    ]);

    var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var row = header.map(function (key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : '';
    });
    sh.appendRow(row);
  } finally {
    lock.releaseLock();
  }
}

function normalizeTaskUsername_(value) {
  var trimmed = String(value || '').trim().replace(/^@+/, '').toLowerCase();
  return trimmed ? '@' + trimmed : '';
}

function normalizeTaskWallet_(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePuzzleUsername_(value) {
  return normalizeTaskUsername_(value);
}

function normalizePuzzleWallet_(value) {
  return normalizeTaskWallet_(value);
}

function extractTweetIdLoose_(link) {
  var match = String(link || '').trim().match(
    /^https:\/\/(x\.com|twitter\.com|mobile\.twitter\.com)\/([\w.-]+)\/status\/(\d+)(\?.*)?$/i
  );
  return match ? String(match[3] || '') : '';
}

function pickLaterRow_(current, next) {
  if (!next) return current;
  if (!current) return next;
  return toTimestamp_(next) >= toTimestamp_(current) ? next : current;
}

function getLatestQualifiedPuzzleEvent_(rows, normalizedUsername, normalizedWallet) {
  var exact = null;
  var walletMatch = null;
  var usernameMatch = null;

  (rows || []).forEach(function (row) {
    if (!isQualifiedRow_(row)) return;

    var rowTs = toTimestamp_(row);
    if (rowTs <= 0) return;

    var rowUsername = normalizePuzzleUsername_(row.xUsername || row.twitterUsername || '');
    var rowWallet = normalizePuzzleWallet_(row.walletAddress || '');
    var sameExact = normalizedUsername && normalizedWallet && rowUsername === normalizedUsername && rowWallet === normalizedWallet;
    var sameWallet = normalizedWallet && rowWallet === normalizedWallet;
    var sameUsername = normalizedUsername && rowUsername === normalizedUsername;

    if (sameExact) {
      exact = pickLaterRow_(exact, row);
      return;
    }
    if (sameWallet) {
      walletMatch = pickLaterRow_(walletMatch, row);
      return;
    }
    if (sameUsername) {
      usernameMatch = pickLaterRow_(usernameMatch, row);
    }
  });

  return exact || walletMatch || usernameMatch || null;
}

function getLatestPuzzleSubmissionRow_(rows, normalizedUsername, normalizedWallet) {
  var exact = null;
  var walletMatch = null;
  var usernameMatch = null;

  (rows || []).forEach(function (row) {
    var rowUsername = normalizePuzzleUsername_(row.xUsername || row.twitterUsername || '');
    var rowWallet = normalizePuzzleWallet_(row.walletAddress || '');
    var sameExact = normalizedUsername && normalizedWallet && rowUsername === normalizedUsername && rowWallet === normalizedWallet;
    var sameWallet = normalizedWallet && rowWallet === normalizedWallet;
    var sameUsername = normalizedUsername && rowUsername === normalizedUsername;

    if (sameExact) {
      exact = pickLaterRow_(exact, row);
      return;
    }
    if (sameWallet) {
      walletMatch = pickLaterRow_(walletMatch, row);
      return;
    }
    if (sameUsername) {
      usernameMatch = pickLaterRow_(usernameMatch, row);
    }
  });

  return exact || walletMatch || usernameMatch || null;
}

function getPuzzleProofStatus_(puzzleSheetName, analyticsSheetName, query) {
  var normalizedUsername = normalizePuzzleUsername_(query.xUsername || query.twitterUsername || '');
  var normalizedWallet = normalizePuzzleWallet_(query.walletAddress || '');

  var puzzleRows = getSheetObjects_(puzzleSheetName, [
    'sheetName',
    'eventType',
    'xUsername',
    'walletAddress',
    'tweetLink',
    'tweetId',
    'requiredCaption',
    'bestScore',
    'currentScore',
    'moves',
    'time',
    'attemptNumber',
    'sessionID',
    'qualified',
    'timestamp',
    'serverTime'
  ]);

  var analyticsRows = getSheetObjects_(analyticsSheetName, [
    'action',
    'eventType',
    'browserId',
    'clientSessionId',
    'runId',
    'xUsername',
    'walletAddress',
    'attemptNumber',
    'score',
    'bestScore',
    'moves',
    'timeSec',
    'qualified',
    'outcome',
    'isReturningProfile',
    'timestamp',
    'serverTime'
  ]);

  var submissionRow = getLatestPuzzleSubmissionRow_(puzzleRows, normalizedUsername, normalizedWallet);
  var qualifiedEvent = getLatestQualifiedPuzzleEvent_(analyticsRows, normalizedUsername, normalizedWallet);
  var nowTs = Date.now();
  var tweetLink = submissionRow ? String(submissionRow.tweetLink || '').trim() : '';
  var tweetId = submissionRow
    ? String(submissionRow.tweetId || '').trim() || extractTweetIdLoose_(tweetLink)
    : '';
  var qualifiedAt = qualifiedEvent ? toTimestamp_(qualifiedEvent) : 0;
  if (qualifiedAt <= 0 && submissionRow) qualifiedAt = toTimestamp_(submissionRow);
  var submittedAt = submissionRow ? toTimestamp_(submissionRow) : 0;
  var proofDeadlineTs = qualifiedAt > 0 ? qualifiedAt + PUZZLE_PROOF_WINDOW_MS : 0;
  var submitted = Boolean(tweetLink || tweetId);
  var expired = !submitted && proofDeadlineTs > 0 && nowTs > proofDeadlineTs;
  var proofState = submitted
    ? 'submitted'
    : proofDeadlineTs > 0
      ? expired ? 'expired' : 'missing'
      : submissionRow ? 'missing' : 'unknown';

  return {
    submissionExists: Boolean(submissionRow),
    submitted: submitted,
    proofState: proofState,
    expired: expired,
    tweetLink: tweetLink,
    tweetId: tweetId,
    xUsername: submissionRow ? String(submissionRow.xUsername || '') : normalizedUsername,
    walletAddress: submissionRow ? String(submissionRow.walletAddress || '') : normalizedWallet,
    currentScore: submissionRow ? Number(submissionRow.currentScore || 0) : 0,
    moves: submissionRow ? Number(submissionRow.moves || 0) : 0,
    time: submissionRow ? Number(submissionRow.time || 0) : 0,
    qualifiedAt: qualifiedAt,
    submittedAt: submittedAt,
    proofDeadlineTs: proofDeadlineTs,
    msRemaining: !submitted && proofDeadlineTs > 0 ? Math.max(0, proofDeadlineTs - nowTs) : 0
  };
}

function getTaskSubmissionStatus_(sheetName, query) {
  var sh = getOrCreateSheet_(sheetName);
  ensureHeader_(sh, ['twitterUsername', 'walletAddress', 'tweetLink', 'tweetId', 'timestamp', 'serverTime']);

  var incomingTweetId = norm_(query.tweetId) || norm_(extractTweetIdLoose_(query.tweetLink));
  var incomingTweetLink = norm_(query.tweetLink);
  var incomingUsername = normalizeTaskUsername_(query.twitterUsername);
  var incomingWallet = normalizeTaskWallet_(query.walletAddress);

  if (sh.getLastRow() < 2) {
    return {
      exists: false,
      duplicateTweet: false,
      duplicateTwitterUsername: false,
      duplicateWalletAddress: false
    };
  }

  var values = sh.getDataRange().getValues();
  var header = values[0] || [];
  var tweetIdCol = header.indexOf('tweetId');
  var tweetLinkCol = header.indexOf('tweetLink');
  var twitterUsernameCol = header.indexOf('twitterUsername');
  var walletAddressCol = header.indexOf('walletAddress');

  var duplicateTweet = false;
  var duplicateTwitterUsername = false;
  var duplicateWalletAddress = false;

  for (var i = 1; i < values.length; i++) {
    var storedTweetId = tweetIdCol >= 0 ? norm_(values[i][tweetIdCol]) : '';
    var storedTweetLink = tweetLinkCol >= 0 ? norm_(values[i][tweetLinkCol]) : '';
    var storedUsername = twitterUsernameCol >= 0 ? normalizeTaskUsername_(values[i][twitterUsernameCol]) : '';
    var storedWallet = walletAddressCol >= 0 ? normalizeTaskWallet_(values[i][walletAddressCol]) : '';

    if ((incomingTweetId && storedTweetId === incomingTweetId) ||
        (incomingTweetLink && storedTweetLink === incomingTweetLink)) {
      duplicateTweet = true;
    }

    if (incomingUsername && storedUsername === incomingUsername) {
      duplicateTwitterUsername = true;
    }

    if (incomingWallet && storedWallet === incomingWallet) {
      duplicateWalletAddress = true;
    }

    if (duplicateTweet || duplicateTwitterUsername || duplicateWalletAddress) {
      break;
    }
  }

  return {
    exists: duplicateTweet || duplicateTwitterUsername || duplicateWalletAddress,
    duplicateTweet: duplicateTweet,
    duplicateTwitterUsername: duplicateTwitterUsername,
    duplicateWalletAddress: duplicateWalletAddress
  };
}

function appendTaskSubmissionUnique_(sheetName, obj) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = getOrCreateSheet_(sheetName);
    var data = Object.assign({}, obj);

    data.twitterUsername = normalizeTaskUsername_(data.twitterUsername);
    data.walletAddress = normalizeTaskWallet_(data.walletAddress);
    data.tweetLink = String(data.tweetLink || '').trim();
    data.tweetId = String(data.tweetId || '').trim() || extractTweetIdLoose_(data.tweetLink);

    if (!data.tweetId) {
      return {
        ok: false,
        errorCode: 'invalid_tweet_id',
        error: 'A valid X status link with a tweet ID is required.'
      };
    }

    if (!data.twitterUsername) {
      return {
        ok: false,
        errorCode: 'invalid_twitter_username',
        error: 'A valid X username is required.'
      };
    }

    if (!data.walletAddress) {
      return {
        ok: false,
        errorCode: 'invalid_wallet_address',
        error: 'A valid wallet address is required.'
      };
    }

    if (!data.timestamp) data.timestamp = Date.now();
    data.serverTime = new Date().toISOString();

    var required = ['twitterUsername', 'walletAddress', 'tweetLink', 'tweetId', 'timestamp', 'serverTime'];
    ensureHeader_(sh, required.concat(Object.keys(data)));

    var status = getTaskSubmissionStatus_(sheetName, {
      tweetId: data.tweetId,
      tweetLink: data.tweetLink,
      twitterUsername: data.twitterUsername,
      walletAddress: data.walletAddress
    });

    if (status.duplicateTweet) {
      return {
        ok: false,
        errorCode: 'duplicate_tweet_id',
        error: 'Tweet already submitted.'
      };
    }

    if (status.duplicateTwitterUsername) {
      return {
        ok: false,
        errorCode: 'duplicate_twitter_username',
        error: 'X username already submitted.'
      };
    }

    if (status.duplicateWalletAddress) {
      return {
        ok: false,
        errorCode: 'duplicate_wallet_address',
        error: 'Wallet address already submitted.'
      };
    }

    var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
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

function getSheetObjects_(sheetName, requiredHeader) {
  var sh = getOrCreateSheet_(sheetName);
  ensureHeader_(sh, requiredHeader || []);
  if (sh.getLastRow() < 2) return [];

  var values = sh.getDataRange().getValues();
  var header = values[0] || [];
  return values.slice(1).map(function (row) {
    var out = {};
    for (var i = 0; i < header.length; i++) out[header[i]] = row[i];
    return out;
  });
}

function readLeaderboardRows_(sheetName) {
  var sh = getOrCreateSheet_(sheetName);
  ensureHeader_(sh, ['timestamp', 'updatedAt', 'eventType', 'browserId', 'xUsername', 'walletAddress', 'score', 'moves', 'timeSec', 'proofDeadlineTs', 'hasProof']);

  if (sh.getLastRow() < 2) return [];

  var values = sh.getDataRange().getValues();
  var header = values[0];
  return values.slice(1).map(function (r) {
    var o = {};
    for (var i = 0; i < header.length; i++) o[header[i]] = r[i];
    return {
      timestamp: Number(o.timestamp || Date.now()),
      updatedAt: Number(o.updatedAt || o.timestamp || Date.now()),
      eventType: String(o.eventType || 'leaderboard_entry'),
      browserId: String(o.browserId || ''),
      xUsername: String(o.xUsername || ''),
      walletAddress: String(o.walletAddress || ''),
      score: Number(o.score || 0),
      moves: Number(o.moves || 0) || null,
      timeSec: Number(o.timeSec || o.time || 0) || null,
      proofDeadlineTs: Number(o.proofDeadlineTs || 0) || null,
      hasProof: o.hasProof === true || o.hasProof === 'true' || o.hasProof === 'TRUE' || o.hasProof === 1 || o.hasProof === '1'
    };
  });
}

function buildPuzzleSubmissionIdentityIndex_(rows) {
  var exactPairs = {};
  var wallets = {};
  var usernames = {};

  (rows || []).forEach(function (row) {
    if (!puzzleSubmissionHasProof_(row)) return;
    var username = normalizePuzzleUsername_(row.xUsername || row.twitterUsername || '');
    var wallet = normalizePuzzleWallet_(row.walletAddress || '');
    if (username) usernames[username] = true;
    if (wallet) wallets[wallet] = true;
    if (username && wallet) exactPairs[username + '|' + wallet] = true;
  });

  return {
    exactPairs: exactPairs,
    wallets: wallets,
    usernames: usernames
  };
}

function puzzleSubmissionHasProof_(row) {
  var tweetLink = String((row && row.tweetLink) || '').trim();
  var tweetId = String((row && row.tweetId) || '').trim() || extractTweetIdLoose_(tweetLink);
  return Boolean(tweetLink || tweetId);
}

function hasPuzzleProofForIdentity_(puzzleRows, username, wallet) {
  var normalizedUsername = normalizePuzzleUsername_(username || '');
  var normalizedWallet = normalizePuzzleWallet_(wallet || '');

  return (puzzleRows || []).some(function (row) {
    if (!puzzleSubmissionHasProof_(row)) return false;
    var rowUsername = normalizePuzzleUsername_(row.xUsername || row.twitterUsername || '');
    var rowWallet = normalizePuzzleWallet_(row.walletAddress || '');
    if (normalizedUsername && normalizedWallet && rowUsername === normalizedUsername && rowWallet === normalizedWallet) return true;
    if (normalizedWallet && rowWallet === normalizedWallet) return true;
    if (normalizedUsername && rowUsername === normalizedUsername) return true;
    return false;
  });
}

function filterLeaderboardRowsByPuzzleSubmissions_(leaderboardRows, puzzleRows) {
  var index = buildPuzzleSubmissionIdentityIndex_(puzzleRows);

  return (leaderboardRows || []).filter(function (row) {
    var username = normalizePuzzleUsername_(row.xUsername || '');
    var wallet = normalizePuzzleWallet_(row.walletAddress || '');
    if (username && wallet && index.exactPairs[username + '|' + wallet]) return true;
    if (wallet && index.wallets[wallet]) return true;
    if (username && index.usernames[username]) return true;
    return false;
  });
}

function sortLeaderboardRows_(rows) {
  return (rows || [])
    .filter(function (r) { return Number(r.score || 0) > 0; })
    .sort(function (a, b) {
      var scoreDiff = Number(b.score || 0) - Number(a.score || 0);
      if (scoreDiff !== 0) return scoreDiff;

      var aMoves = Number.isFinite(Number(a.moves)) && Number(a.moves) > 0 ? Number(a.moves) : Number.MAX_SAFE_INTEGER;
      var bMoves = Number.isFinite(Number(b.moves)) && Number(b.moves) > 0 ? Number(b.moves) : Number.MAX_SAFE_INTEGER;
      var moveDiff = aMoves - bMoves;
      if (moveDiff !== 0) return moveDiff;

      var aTime = Number.isFinite(Number(a.timeSec)) && Number(a.timeSec) > 0 ? Number(a.timeSec) : Number.MAX_SAFE_INTEGER;
      var bTime = Number.isFinite(Number(b.timeSec)) && Number(b.timeSec) > 0 ? Number(b.timeSec) : Number.MAX_SAFE_INTEGER;
      var timeDiff = aTime - bTime;
      if (timeDiff !== 0) return timeDiff;

      return Number(a.updatedAt || 0) - Number(b.updatedAt || 0);
    });
}

function getLeaderboard_(sheetName, limit) {
  try {
    var puzzleRows = getSheetObjects_(DEFAULT_PUZZLE_SHEET, [
      'xUsername',
      'walletAddress',
      'currentScore',
      'moves',
      'time',
      'qualified',
      'tweetLink',
      'tweetId',
      'timestamp',
      'serverTime'
    ]);

    var now = Date.now();

    var qualifiedRows = puzzleRows.filter(function (row) {
      if (isQualifiedRow_(row)) return true;
      var score = Number(row.currentScore || 0);
      return score >= PUZZLE_TARGET_SCORE;
    });

    var enrichedRows = qualifiedRows.map(function (row) {
      var hasProof = puzzleSubmissionHasProof_(row);
      var rowTs = toTimestamp_(row);

      return {
        timestamp: rowTs,
        updatedAt: rowTs,
        eventType: 'puzzle_submission',
        browserId: '',
        xUsername: normalizePuzzleUsername_(row.xUsername || ''),
        walletAddress: normalizePuzzleWallet_(row.walletAddress || ''),
        score: Number(row.currentScore || 0),
        moves: Number(row.moves || 0),
        timeSec: Number(row.time || 0),
        proofDeadlineTs: hasProof ? null : (rowTs + LEADERBOARD_PROOF_DEADLINE_MS),
        hasProof: hasProof
      };
    });

    var filteredByDeadline = enrichedRows.filter(function (row) {
      if (row.hasProof === true) return true;

      var deadline = Number(row.proofDeadlineTs || 0);
      if (!deadline) return true;

      return deadline > now;
    });

    return sortLeaderboardRows_(filteredByDeadline)
      .slice(0, Math.max(1, Math.min(Number(limit) || MAX_LEADERBOARD_ROWS, MAX_LEADERBOARD_ROWS)));
  } catch (err) {
    Logger.log('getLeaderboard_ error: ' + String(err));
    return [];
  }
}

function upsertLeaderboard_(sheetName, payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = getOrCreateSheet_(sheetName);
    var required = ['timestamp', 'updatedAt', 'eventType', 'browserId', 'xUsername', 'walletAddress', 'score', 'moves', 'timeSec', 'proofDeadlineTs', 'hasProof'];
    ensureHeader_(sh, required);

    var rows = readLeaderboardRows_(sheetName);

    var puzzleRows = getSheetObjects_(DEFAULT_PUZZLE_SHEET, [
      'sheetName',
      'eventType',
      'xUsername',
      'walletAddress',
      'tweetLink',
      'tweetId',
      'currentScore',
      'moves',
      'time',
      'qualified',
      'timestamp',
      'serverTime'
    ]);

    var existingHasProof = hasPuzzleProofForIdentity_(puzzleRows, payload.xUsername, payload.walletAddress);

    var incoming = {
      timestamp: Number(payload.timestamp || Date.now()),
      updatedAt: Date.now(),
      eventType: String(payload.eventType || 'leaderboard_entry'),
      browserId: String(payload.browserId || ''),
      xUsername: String(payload.xUsername || ''),
      walletAddress: String(payload.walletAddress || ''),
      score: Number(payload.score || 0),
      moves: Number(payload.moves || 0),
      timeSec: Number(payload.timeSec || payload.time || 0),
      proofDeadlineTs: payload.hasProof === true ? null : (Number(payload.proofDeadlineTs) || (Date.now() + LEADERBOARD_PROOF_DEADLINE_MS)),
      hasProof: payload.hasProof === true || existingHasProof
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
      var incomingMoves = Number.isFinite(Number(incoming.moves)) && Number(incoming.moves) > 0
        ? Number(incoming.moves)
        : Number.MAX_SAFE_INTEGER;
      var existingTime = Number.isFinite(Number(rows[matchIndex].timeSec)) && Number(rows[matchIndex].timeSec) > 0
        ? Number(rows[matchIndex].timeSec)
        : Number.MAX_SAFE_INTEGER;
      var incomingTime = Number.isFinite(Number(incoming.timeSec)) && Number(incoming.timeSec) > 0
        ? Number(incoming.timeSec)
        : Number.MAX_SAFE_INTEGER;

      var shouldReplace =
        incoming.score > existingScore ||
        (incoming.score === existingScore && incomingMoves < existingMoves) ||
        (incoming.score === existingScore && incomingMoves === existingMoves && incomingTime < existingTime);

      if (shouldReplace) {
        rows[matchIndex] = Object.assign({}, rows[matchIndex], incoming);
      } else {
        rows[matchIndex] = Object.assign({}, rows[matchIndex], {
          updatedAt: Date.now(),
          xUsername: incoming.xUsername || rows[matchIndex].xUsername,
          walletAddress: incoming.walletAddress || rows[matchIndex].walletAddress,
          hasProof: incoming.hasProof || rows[matchIndex].hasProof,
          proofDeadlineTs: incoming.hasProof ? null : (rows[matchIndex].proofDeadlineTs || (Date.now() + LEADERBOARD_PROOF_DEADLINE_MS))
        });
      }
    } else {
      rows.push(incoming);
    }

    rows = sortLeaderboardRows_(rows)
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

function reconcileLeaderboardWithPuzzle_(leaderboardSheetName, puzzleSheetName) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = getOrCreateSheet_(leaderboardSheetName);
    var required = ['timestamp', 'updatedAt', 'eventType', 'browserId', 'xUsername', 'walletAddress', 'score', 'moves', 'timeSec'];
    ensureHeader_(sh, required);

    var beforeRows = readLeaderboardRows_(leaderboardSheetName);
    var puzzleRows = getSheetObjects_(puzzleSheetName, [
      'sheetName',
      'eventType',
      'xUsername',
      'walletAddress',
      'tweetLink',
      'tweetId',
      'currentScore',
      'moves',
      'time',
      'qualified',
      'timestamp',
      'serverTime'
    ]);
    var filteredRows = sortLeaderboardRows_(filterLeaderboardRowsByPuzzleSubmissions_(beforeRows, puzzleRows))
      .slice(0, MAX_LEADERBOARD_ROWS);

    sh.clearContents();
    sh.getRange(1, 1, 1, required.length).setValues([required]);

    if (filteredRows.length > 0) {
      var out = filteredRows.map(function (row) {
        return required.map(function (key) {
          return Object.prototype.hasOwnProperty.call(row, key) ? row[key] : '';
        });
      });
      sh.getRange(2, 1, out.length, required.length).setValues(out);
    }

    return {
      updated: true,
      beforeCount: beforeRows.filter(function (row) { return Number(row.score || 0) > 0; }).length,
      afterCount: filteredRows.length,
      removedCount: Math.max(0, beforeRows.filter(function (row) { return Number(row.score || 0) > 0; }).length - filteredRows.length),
      leaderboardSheetName: leaderboardSheetName,
      puzzleSheetName: puzzleSheetName
    };
  } finally {
    lock.releaseLock();
  }
}

function repairLeaderboardFromPuzzle_(leaderboardSheetName, puzzleSheetName) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = getOrCreateSheet_(leaderboardSheetName);
    var required = ['timestamp', 'updatedAt', 'eventType', 'browserId', 'xUsername', 'walletAddress', 'score', 'moves', 'timeSec'];
    ensureHeader_(sh, required);

    var beforeRows = readLeaderboardRows_(leaderboardSheetName);
    var puzzleRows = getSheetObjects_(puzzleSheetName, [
      'sheetName',
      'eventType',
      'xUsername',
      'walletAddress',
      'tweetLink',
      'tweetId',
      'bestScore',
      'currentScore',
      'moves',
      'time',
      'qualified',
      'timestamp',
      'serverTime'
    ]);

    var repairedRows = [];

    function isBetter_(incoming, existing) {
      var incomingScore = Number(incoming.score || 0);
      var existingScore = Number(existing.score || 0);
      if (incomingScore !== existingScore) return incomingScore > existingScore;

      var incomingMoves = Number.isFinite(Number(incoming.moves)) && Number(incoming.moves) > 0
        ? Number(incoming.moves)
        : Number.MAX_SAFE_INTEGER;
      var existingMoves = Number.isFinite(Number(existing.moves)) && Number(existing.moves) > 0
        ? Number(existing.moves)
        : Number.MAX_SAFE_INTEGER;
      if (incomingMoves !== existingMoves) return incomingMoves < existingMoves;

      var incomingTime = Number.isFinite(Number(incoming.timeSec)) && Number(incoming.timeSec) > 0
        ? Number(incoming.timeSec)
        : Number.MAX_SAFE_INTEGER;
      var existingTime = Number.isFinite(Number(existing.timeSec)) && Number(existing.timeSec) > 0
        ? Number(existing.timeSec)
        : Number.MAX_SAFE_INTEGER;
      if (incomingTime !== existingTime) return incomingTime < existingTime;

      return Number(incoming.updatedAt || 0) < Number(existing.updatedAt || 0);
    }

    function findMatchingRow_(rows, username, wallet) {
      return rows.find(function (row) {
        var rowUsername = normalizePuzzleUsername_(row.xUsername || '');
        var rowWallet = normalizePuzzleWallet_(row.walletAddress || '');
        if (username && wallet && rowUsername === username && rowWallet === wallet) return true;
        if (wallet && rowWallet === wallet) return true;
        if (username && rowUsername === username) return true;
        return false;
      }) || null;
    }

    (puzzleRows || []).forEach(function (row) {
      if (!puzzleSubmissionHasProof_(row)) return;
      var username = normalizePuzzleUsername_(row.xUsername || '');
      var wallet = normalizePuzzleWallet_(row.walletAddress || '');
      var score = Number(row.currentScore || row.bestScore || 0);
      var moves = Number(row.moves || 0);
      var timeSec = Number(row.time || 0);

      if (!username && !wallet) return;
      if (score <= 0) return;

      var existingRow = findMatchingRow_(beforeRows, username, wallet);
      var incoming = {
        timestamp: Number(row.timestamp || (existingRow && existingRow.timestamp) || Date.now()),
        updatedAt: Date.now(),
        eventType: 'leaderboard_entry',
        browserId: existingRow ? String(existingRow.browserId || '') : '',
        xUsername: String(row.xUsername || (existingRow && existingRow.xUsername) || ''),
        walletAddress: String(row.walletAddress || (existingRow && existingRow.walletAddress) || ''),
        score: score,
        moves: moves || null,
        timeSec: timeSec || null
      };

      var matchIndex = repairedRows.findIndex(function (candidate) {
        var candidateUsername = normalizePuzzleUsername_(candidate.xUsername || '');
        var candidateWallet = normalizePuzzleWallet_(candidate.walletAddress || '');
        if (username && wallet && candidateUsername === username && candidateWallet === wallet) return true;
        if (wallet && candidateWallet === wallet) return true;
        if (username && candidateUsername === username) return true;
        return false;
      });

      if (matchIndex < 0) {
        repairedRows.push(incoming);
        return;
      }

      if (isBetter_(incoming, repairedRows[matchIndex])) {
        repairedRows[matchIndex] = Object.assign({}, repairedRows[matchIndex], incoming);
      }
    });

    repairedRows = sortLeaderboardRows_(repairedRows).slice(0, MAX_LEADERBOARD_ROWS);

    sh.clearContents();
    sh.getRange(1, 1, 1, required.length).setValues([required]);

    if (repairedRows.length > 0) {
      var out = repairedRows.map(function (row) {
        return required.map(function (key) {
          return Object.prototype.hasOwnProperty.call(row, key) ? row[key] : '';
        });
      });
      sh.getRange(2, 1, out.length, required.length).setValues(out);
    }

    return {
      updated: true,
      repairedCount: repairedRows.length,
      previousCount: beforeRows.filter(function (row) { return Number(row.score || 0) > 0; }).length,
      leaderboardSheetName: leaderboardSheetName,
      puzzleSheetName: puzzleSheetName
    };
  } finally {
    lock.releaseLock();
  }
}

function getGameIdentityAliases_(row) {
  var aliases = [];
  var username = norm_(row.xUsername);
  var wallet = norm_(row.walletAddress);
  var browserId = norm_(row.browserId);
  if (username) aliases.push('x:' + username);
  if (wallet) aliases.push('wallet:' + wallet);
  if (browserId) aliases.push('browser:' + browserId);
  return aliases;
}

function buildGameIdentityAliasMap_(rows) {
  var parent = {};

  function ensure(alias) {
    if (alias && !parent[alias]) parent[alias] = alias;
  }

  function find(alias) {
    ensure(alias);
    while (parent[alias] !== alias) {
      parent[alias] = parent[parent[alias]];
      alias = parent[alias];
    }
    return alias;
  }

  function union(a, b) {
    if (!a || !b) return;
    var rootA = find(a);
    var rootB = find(b);
    if (rootA === rootB) return;
    parent[rootB] = rootA;
  }

  (rows || []).forEach(function (row) {
    var aliases = getGameIdentityAliases_(row);
    if (aliases.length === 0) return;
    aliases.forEach(ensure);
    for (var i = 1; i < aliases.length; i++) {
      union(aliases[0], aliases[i]);
    }
  });

  var aliasMap = {};
  Object.keys(parent).forEach(function (alias) {
    aliasMap[alias] = find(alias);
  });
  return aliasMap;
}

function gamePlayerKey_(row, aliasMap) {
  var aliases = getGameIdentityAliases_(row);
  for (var i = 0; i < aliases.length; i++) {
    if (aliasMap && aliasMap[aliases[i]]) return aliasMap[aliases[i]];
  }
  return aliases[0] || '';
}

function gameRunKey_(row) {
  var runId = norm_(row.runId);
  if (runId) return 'run:' + runId;

  var sessionId = norm_(row.clientSessionId);
  var browserId = norm_(row.browserId);
  var attemptNumber = Number(row.attemptNumber || 0);

  if (sessionId && attemptNumber > 0) return 'session:' + sessionId + ':attempt:' + attemptNumber;
  if (browserId && attemptNumber > 0) return 'browser:' + browserId + ':attempt:' + attemptNumber;
  if (sessionId) return 'session:' + sessionId;
  if (browserId) return 'browser:' + browserId;
  return '';
}

function ensureGamePlayer_(playerMap, playerKey) {
  if (!playerKey) return null;
  if (!playerMap[playerKey]) {
    playerMap[playerKey] = {
      sessions: {},
      runs: 0,
      returning: false,
      inferredPlayed: false,
      tracked: false,
      qualifiedRuns: 0,
      runTimestamps: []
    };
  }
  return playerMap[playerKey];
}

function toTimestamp_(row) {
  var raw = row.timestamp || row.updatedAt || row.ts || 0;
  var numeric = Number(raw);
  if (numeric > 0) return numeric;
  var parsed = Date.parse(String(row.serverTime || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeAverage_(sum, count) {
  return count > 0 ? Math.round((sum / count) * 100) / 100 : 0;
}

function normalizeStatsPeriod_(value) {
  var period = String(value || 'all').trim().toLowerCase();
  if (period === 'daily' || period === 'weekly' || period === 'monthly') return period;
  return 'all';
}

function getStatsWindowStart_(period, nowTs) {
  if (period === 'daily') return nowTs - (24 * 60 * 60 * 1000);
  if (period === 'weekly') return nowTs - (7 * 24 * 60 * 60 * 1000);
  if (period === 'monthly') return nowTs - (30 * 24 * 60 * 60 * 1000);
  return 0;
}

function isWithinStatsWindow_(timestamp, windowStart) {
  var ts = Number(timestamp || 0);
  if (!windowStart) return ts > 0;
  return ts >= windowStart;
}

function isQualifiedRow_(row) {
  return row.qualified === true || String(row.qualified || '').toLowerCase() === 'true';
}

function sortQualifiedPerformance_(a, b) {
  var scoreDiff = Number(b.score || 0) - Number(a.score || 0);
  if (scoreDiff !== 0) return scoreDiff;
  var moveDiff = Number(a.moves || 0) - Number(b.moves || 0);
  if (moveDiff !== 0) return moveDiff;
  var timeDiff = Number(a.timeSec || 0) - Number(b.timeSec || 0);
  if (timeDiff !== 0) return timeDiff;
  return Number(a.timestamp || 0) - Number(b.timestamp || 0);
}

function isBetterQualifiedCandidate_(candidate, current) {
  if (!current) return true;
  return sortQualifiedPerformance_(candidate, current) < 0;
}

function getGameStatsSummary_(analyticsSheetName, leaderboardSheetName, puzzleSheetName, period) {
  var analyticsRows = getSheetObjects_(analyticsSheetName, [
    'action',
    'eventType',
    'browserId',
    'clientSessionId',
    'runId',
    'xUsername',
    'walletAddress',
    'attemptNumber',
    'score',
    'bestScore',
    'moves',
    'timeSec',
    'qualified',
    'outcome',
    'isReturningProfile',
    'timestamp',
    'serverTime'
  ]);
  var leaderboardRows = getLeaderboard_(leaderboardSheetName, MAX_LEADERBOARD_ROWS);
  var puzzleRows = getSheetObjects_(puzzleSheetName, [
    'sheetName',
    'eventType',
    'xUsername',
    'walletAddress',
    'currentScore',
    'moves',
    'time',
    'qualified',
    'timestamp',
    'serverTime'
  ]);
  var statsPeriod = normalizeStatsPeriod_(period);
  var nowTs = Date.now();
  var windowStart = getStatsWindowStart_(statsPeriod, nowTs);
  var windowLabel = statsPeriod === 'daily'
    ? 'Daily'
    : statsPeriod === 'weekly'
      ? 'Weekly'
      : statsPeriod === 'monthly'
        ? 'Monthly'
        : 'All Time';
  var filteredAnalyticsRows = analyticsRows.filter(function (row) {
    var ts = toTimestamp_(row);
    return isWithinStatsWindow_(ts, windowStart);
  });
  var filteredPuzzleRows = puzzleRows.filter(function (row) {
    var ts = toTimestamp_(row);
    return isWithinStatsWindow_(ts, windowStart);
  });
  var filteredLeaderboardRows = leaderboardRows.filter(function (row) {
    var ts = Number(row.updatedAt || 0);
    return isWithinStatsWindow_(ts, windowStart);
  });
  var identityAliasMap = buildGameIdentityAliasMap_(
    filteredAnalyticsRows.concat(filteredPuzzleRows, filteredLeaderboardRows)
  );

  var trackedSince = 0;
  var lastUpdated = 0;
  var totalRuns = 0;
  var completedRuns = 0;
  var qualifiedRuns = 0;
  var unqualifiedRuns = 0;
  var incompleteRuns = 0;
  var activeRuns = 0;
  var playerMap = {};
  var runMap = {};
  var qualifiedRunRows = [];
  var trackedPlayerKeys = {};
  var analyticsQualifiedPlayerKeys = {};
  var legacyQualifiedBestByPlayer = {};
  var legacyQualifiedLatestByPlayer = {};

  filteredAnalyticsRows.forEach(function (row) {
    var ts = toTimestamp_(row);
    if (ts > 0 && (!trackedSince || ts < trackedSince)) trackedSince = ts;
    if (ts > lastUpdated) lastUpdated = ts;

    var playerKey = gamePlayerKey_(row, identityAliasMap);
    if (!playerKey) return;

    var player = ensureGamePlayer_(playerMap, playerKey);
    trackedPlayerKeys[playerKey] = true;
    player.tracked = true;
    var sessionId = norm_(row.clientSessionId);
    if (sessionId) player.sessions[sessionId] = true;

    var eventType = String(row.eventType || '');
    var runKey = gameRunKey_(row);
    var run = runKey ? runMap[runKey] : null;
    if (runKey && !run) {
      run = {
        playerKey: playerKey,
        started: false,
        completed: false,
        outcome: '',
        qualified: false,
        score: 0,
        moves: 0,
        timeSec: 0,
        timestamp: 0,
        browserId: String(row.browserId || ''),
        xUsername: String(row.xUsername || ''),
        walletAddress: String(row.walletAddress || '')
      };
      runMap[runKey] = run;
    }

    if (eventType === 'run_started') {
      if (run) {
        if (!run.started) {
          run.started = true;
          totalRuns += 1;
          player.runs += 1;
          if (ts > 0) player.runTimestamps.push(ts);
        }
        if (ts > run.timestamp) run.timestamp = ts;
      } else {
        totalRuns += 1;
        player.runs += 1;
        if (ts > 0) player.runTimestamps.push(ts);
      }
    }

    if (eventType === 'run_completed') {
      if (run) {
        if (!run.started) {
          run.started = true;
          totalRuns += 1;
          player.runs += 1;
        }
        if (!run.completed || ts >= run.timestamp) {
          run.completed = true;
          run.outcome = norm_(row.outcome);
          run.qualified = isQualifiedRow_(row) || norm_(row.outcome) === 'qualified';
          run.score = Number(row.score || 0);
          run.moves = Number(row.moves || 0);
          run.timeSec = Number(row.timeSec || row.time || 0);
          run.timestamp = ts;
          run.browserId = String(row.browserId || run.browserId || '');
          run.xUsername = String(row.xUsername || run.xUsername || '');
          run.walletAddress = String(row.walletAddress || run.walletAddress || '');
        }
      }
    }
  });

  Object.keys(runMap).forEach(function (key) {
    var run = runMap[key];
    if (!run || !run.started) return;

    if (!run.completed) {
      activeRuns += 1;
      return;
    }

    completedRuns += 1;
    if (run.qualified || run.outcome === 'qualified') {
      qualifiedRuns += 1;
      if (run.playerKey) analyticsQualifiedPlayerKeys[run.playerKey] = true;
      var qualifiedPlayer = ensureGamePlayer_(playerMap, run.playerKey);
      if (qualifiedPlayer) qualifiedPlayer.qualifiedRuns += 1;
      qualifiedRunRows.push({
        browserId: String(run.browserId || ''),
        xUsername: String(run.xUsername || ''),
        walletAddress: String(run.walletAddress || ''),
        score: Number(run.score || 0),
        moves: Number(run.moves || 0),
        timeSec: Number(run.timeSec || 0),
        timestamp: Number(run.timestamp || 0)
      });
      return;
    }

    if (run.outcome === 'completed_unqualified') {
      unqualifiedRuns += 1;
      return;
    }

    incompleteRuns += 1;
  });

  filteredPuzzleRows.forEach(function (row) {
    var ts = toTimestamp_(row);
    if (ts > lastUpdated) lastUpdated = ts;

    var playerKey = gamePlayerKey_(row, identityAliasMap);
    if (!playerKey) return;

    var player = ensureGamePlayer_(playerMap, playerKey);
    player.inferredPlayed = true;

    if (!isQualifiedRow_(row) || analyticsQualifiedPlayerKeys[playerKey]) return;

    var candidate = {
      browserId: String(row.browserId || ''),
      xUsername: String(row.xUsername || ''),
      walletAddress: String(row.walletAddress || ''),
      score: Number(row.currentScore || row.score || 0),
      moves: Number(row.moves || 0),
      timeSec: Number(row.time || row.timeSec || 0),
      timestamp: ts,
      source: 'puzzle'
    };

    if (isBetterQualifiedCandidate_(candidate, legacyQualifiedBestByPlayer[playerKey])) {
      legacyQualifiedBestByPlayer[playerKey] = candidate;
    }
    if (!legacyQualifiedLatestByPlayer[playerKey] || candidate.timestamp >= Number(legacyQualifiedLatestByPlayer[playerKey].timestamp || 0)) {
      legacyQualifiedLatestByPlayer[playerKey] = candidate;
    }
  });

  filteredLeaderboardRows.forEach(function (row) {
    var ts = Number(row.updatedAt || 0);
    if (ts > lastUpdated) lastUpdated = ts;

    var playerKey = gamePlayerKey_(row, identityAliasMap);
    if (!playerKey) return;

    var player = ensureGamePlayer_(playerMap, playerKey);
    player.inferredPlayed = true;

    if (analyticsQualifiedPlayerKeys[playerKey]) return;

    var candidate = {
      browserId: String(row.browserId || ''),
      xUsername: String(row.xUsername || ''),
      walletAddress: String(row.walletAddress || ''),
      score: Number(row.score || 0),
      moves: Number(row.moves || 0),
      timeSec: Number(row.timeSec || row.time || 0),
      timestamp: ts,
      source: 'leaderboard'
    };

    if (isBetterQualifiedCandidate_(candidate, legacyQualifiedBestByPlayer[playerKey])) {
      legacyQualifiedBestByPlayer[playerKey] = candidate;
    }
    if (!legacyQualifiedLatestByPlayer[playerKey] || candidate.timestamp >= Number(legacyQualifiedLatestByPlayer[playerKey].timestamp || 0)) {
      legacyQualifiedLatestByPlayer[playerKey] = candidate;
    }
  });

  Object.keys(legacyQualifiedBestByPlayer).forEach(function (playerKey) {
    var row = legacyQualifiedBestByPlayer[playerKey];
    if (!row) return;
    var player = ensureGamePlayer_(playerMap, playerKey);
    if (player) {
      if (player.runs === 0) player.runs = 1;
    }
    qualifiedRunRows.push({
      browserId: String(row.browserId || ''),
      xUsername: String(row.xUsername || ''),
      walletAddress: String(row.walletAddress || ''),
      score: Number(row.score || 0),
      moves: Number(row.moves || 0),
      timeSec: Number(row.timeSec || 0),
      timestamp: Number(row.timestamp || 0)
    });
  });

  var usersPlayed = 0;
  var trackedPlayers = 0;
  var returningPlayers = 0;
  var legacyRecoveredPlayers = 0;
  Object.keys(playerMap).forEach(function (key) {
    var player = playerMap[key];
    if (player.runs > 0 || player.inferredPlayed) usersPlayed += 1;
    if (player.tracked) trackedPlayers += 1;
    if (player.inferredPlayed && player.runs <= 1 && Object.keys(player.sessions).length === 0) {
      legacyRecoveredPlayers += 1;
    }

    var timestamps = (player.runTimestamps || [])
      .map(function (value) { return Number(value || 0); })
      .filter(function (value) { return value > 0; })
      .sort(function (a, b) { return a - b; });

    for (var i = 1; i < timestamps.length; i++) {
      if ((timestamps[i] - timestamps[i - 1]) >= RETURNING_PLAYER_GAP_MS) {
        returningPlayers += 1;
        break;
      }
    }
  });

  var qualifiedPlayerKeys = {};
  var qualifiedScoreSum = 0;
  var qualifiedMovesSum = 0;
  var qualifiedTimeSum = 0;
  var qualifiedLeaderboardCount = 0;

  qualifiedRunRows.forEach(function (row) {
    var playerKey = gamePlayerKey_(row, identityAliasMap);
    if (playerKey) qualifiedPlayerKeys[playerKey] = true;
    qualifiedScoreSum += Number(row.score || 0);
    qualifiedMovesSum += Number(row.moves || 0);
    qualifiedTimeSum += Number(row.timeSec || 0);
    qualifiedLeaderboardCount += 1;
    var ts = Number(row.timestamp || 0);
    if (ts > lastUpdated) lastUpdated = ts;
  });

  filteredPuzzleRows.forEach(function (row) {
    var ts = toTimestamp_(row);
    if (ts > lastUpdated) lastUpdated = ts;
    if (isQualifiedRow_(row)) {
      var playerKey = gamePlayerKey_(row, identityAliasMap);
      if (playerKey) qualifiedPlayerKeys[playerKey] = true;
    }
  });

  filteredLeaderboardRows.forEach(function (row) {
    var ts = Number(row.updatedAt || 0);
    if (ts > lastUpdated) lastUpdated = ts;
  });

  var qualifiedPuzzleRows = filteredPuzzleRows.filter(function (row) {
    return isQualifiedRow_(row);
  });
  var latestQualifiedCandidates = qualifiedRunRows.concat(
    Object.keys(legacyQualifiedLatestByPlayer).map(function (playerKey) {
      return legacyQualifiedLatestByPlayer[playerKey];
    })
  );
  var latestQualified = latestQualifiedCandidates
    .slice()
    .sort(function (a, b) { return Number(b.timestamp || 0) - Number(a.timestamp || 0); })[0] || null;
  var leaderboardTop = filteredLeaderboardRows
    .slice(0, 5)
    .map(function (row) {
      return {
        browserId: String(row.browserId || ''),
        xUsername: String(row.xUsername || ''),
        walletAddress: String(row.walletAddress || ''),
        score: Number(row.score || 0),
        moves: Number(row.moves || 0),
        timeSec: Number(row.timeSec || row.time || 0),
        timestamp: Number(row.updatedAt || row.timestamp || 0)
      };
    });
  var topPerformer = leaderboardTop[0] || null;
  var trackedQualifiedPlayers = Object.keys(analyticsQualifiedPlayerKeys).length;
  var legacyQualifiedPlayers = Object.keys(legacyQualifiedBestByPlayer).length;
  var analyticsCoverageRate = usersPlayed > 0 ? Math.round((trackedPlayers / usersPlayed) * 10000) / 100 : 0;
  var qualifiedCoverageRate = Object.keys(qualifiedPlayerKeys).length > 0
    ? Math.round((trackedQualifiedPlayers / Object.keys(qualifiedPlayerKeys).length) * 10000) / 100
    : 0;

  return {
    summaryVersion: 5,
    period: statsPeriod,
    periodLabel: windowLabel,
    trackedSince: trackedSince || windowStart,
    windowStart: windowStart,
    windowEnd: nowTs,
    lastUpdated: lastUpdated,
    usersPlayed: usersPlayed,
    trackedPlayers: trackedPlayers,
    returningPlayers: returningPlayers,
    qualifiedPlayers: Object.keys(qualifiedPlayerKeys).length,
    trackedQualifiedPlayers: trackedQualifiedPlayers,
    legacyQualifiedPlayers: legacyQualifiedPlayers,
    totalRuns: totalRuns,
    completedRuns: completedRuns,
    qualifiedRuns: qualifiedRuns,
    unqualifiedRuns: unqualifiedRuns,
    incompleteRuns: incompleteRuns,
    activeRuns: activeRuns,
    runQualificationRate: completedRuns > 0 ? Math.round((qualifiedRuns / completedRuns) * 10000) / 100 : 0,
    averageQualifiedScore: safeAverage_(qualifiedScoreSum, qualifiedLeaderboardCount),
    averageQualifiedMoves: safeAverage_(qualifiedMovesSum, qualifiedLeaderboardCount),
    averageQualifiedTimeSec: safeAverage_(qualifiedTimeSum, qualifiedLeaderboardCount),
    bestScore: topPerformer ? Number(topPerformer.score || 0) : 0,
    topPerformer: topPerformer,
    leaderboardTop: leaderboardTop,
    latestQualified: latestQualified,
    analyticsEvents: filteredAnalyticsRows.length,
    leaderboardEntries: filteredLeaderboardRows.length,
    qualifiedSubmissionCount: qualifiedPuzzleRows.length,
    legacyRecoveredPlayers: legacyRecoveredPlayers,
    legacyRecoveredQualifiedRuns: Object.keys(legacyQualifiedBestByPlayer).length,
    analyticsCoverageRate: analyticsCoverageRate,
    qualifiedCoverageRate: qualifiedCoverageRate,
    returningGapMinutes: Math.round(RETURNING_PLAYER_GAP_MS / 60000)
  };
}

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

function norm_(v) {
  return String(v || '').trim().toLowerCase();
}

function backfillLeaderboardFromPuzzleSubmissions_(puzzleSheetName, leaderboardSheetName) {
  var scriptProps = PropertiesService.getScriptProperties();
  var backfillDone = scriptProps.getProperty('LEADERBOARD_BACKFILL_DONE');
  if (backfillDone === 'true' && !PropertiesService.getScriptProperties().getProperty('FORCE_BACKFILL')) {
    return { skipped: true, message: 'Backfill already completed. Set FORCE_BACKFILL to re-run.' };
  }

  var puzzleRows = getSheetObjects_(puzzleSheetName || DEFAULT_PUZZLE_SHEET, [
    'xUsername',
    'walletAddress',
    'currentScore',
    'moves',
    'time',
    'qualified',
    'tweetLink',
    'tweetId',
    'timestamp',
    'serverTime'
  ]);

  var leaderboardRows = readLeaderboardRows_(leaderboardSheetName || DEFAULT_LEADERBOARD_SHEET);
  var existingIndex = buildPuzzleSubmissionIdentityIndex_(leaderboardRows);

  var qualifiedPuzzleRows = puzzleRows.filter(function (row) {
    if (isQualifiedRow_(row)) return true;
    var score = Number(row.currentScore || 0);
    return score >= PUZZLE_TARGET_SCORE;
  });

  var toAdd = [];

  qualifiedPuzzleRows.forEach(function (row) {
    var username = normalizePuzzleUsername_(row.xUsername || '');
    var wallet = normalizePuzzleWallet_(row.walletAddress || '');
    var identity = username + '|' + wallet;

    if (username && wallet && existingIndex.exactPairs[identity]) return;
    if (wallet && existingIndex.wallets[wallet]) return;
    if (username && existingIndex.usernames[username]) return;

    var hasProof = puzzleSubmissionHasProof_(row);
    var rowTs = toTimestamp_(row);
    var proofDeadlineTs = hasProof ? null : (rowTs + LEADERBOARD_PROOF_DEADLINE_MS);

    toAdd.push({
      timestamp: rowTs,
      updatedAt: Date.now(),
      eventType: 'backfill',
      browserId: '',
      xUsername: username,
      walletAddress: wallet,
      score: Number(row.currentScore || 0),
      moves: Number(row.moves || 0),
      timeSec: Number(row.time || 0),
      proofDeadlineTs: proofDeadlineTs,
      hasProof: hasProof
    });

    if (username && wallet) existingIndex.exactPairs[identity] = true;
    if (wallet) existingIndex.wallets[wallet] = true;
    if (username) existingIndex.usernames[username] = true;
  });

  if (toAdd.length === 0) {
    scriptProps.setProperty('LEADERBOARD_BACKFILL_DONE', 'true');
    return { added: 0, skipped: 0, total: 0, message: 'No new qualified users to add.' };
  }

  var allRows = leaderboardRows.concat(toAdd);
  allRows = sortLeaderboardRows_(allRows).slice(0, MAX_LEADERBOARD_ROWS);

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = getOrCreateSheet_(leaderboardSheetName || DEFAULT_LEADERBOARD_SHEET);
    var required = ['timestamp', 'updatedAt', 'eventType', 'browserId', 'xUsername', 'walletAddress', 'score', 'moves', 'timeSec', 'proofDeadlineTs', 'hasProof'];
    ensureHeader_(sh, required);

    sh.clearContents();
    sh.getRange(1, 1, 1, required.length).setValues([required]);

    if (allRows.length > 0) {
      var out = allRows.map(function (r) {
        return required.map(function (k) {
          return Object.prototype.hasOwnProperty.call(r, k) ? r[k] : '';
        });
      });
      sh.getRange(2, 1, out.length, required.length).setValues(out);
    }

    scriptProps.setProperty('LEADERBOARD_BACKFILL_DONE', 'true');

    var withProof = toAdd.filter(function (r) { return r.hasProof; }).length;
    var withoutProof = toAdd.length - withProof;

    return {
      added: toAdd.length,
      withProof: withProof,
      withoutProof: withoutProof,
      total: allRows.length,
      message: 'Backfill completed successfully.'
    };
  } catch (err) {
    return { error: String(err), added: 0 };
  } finally {
    lock.releaseLock();
  }
}

function runBackfillNow() {
  PropertiesService.getScriptProperties().setProperty('FORCE_BACKFILL', 'true');
  var result = backfillLeaderboardFromPuzzleSubmissions_();
  PropertiesService.getScriptProperties().deleteProperty('FORCE_BACKFILL');
  return result;
}

```
