# PlayToWL Improvement Plan

This plan assumes the project keeps using Google Apps Script as the backend.

## Reality Check

With Apps Script plus an untrusted browser client, we can improve integrity a lot, but we cannot make the game fully cheat-proof the same way a real server-authoritative game backend could.

What we can do well with Apps Script:

- make identity handling consistent
- make leaderboard writes and reads consistent
- verify proof links on the backend
- reduce obvious fake submissions
- add rate limiting, dedupe, and auditability
- improve performance by avoiding repeated full-sheet scans

What we cannot fully guarantee with Apps Script alone:

- that a browser-reported score was produced by an untampered client
- that a determined attacker cannot forge a qualified run payload

So the right target is:

- strong operational integrity now
- clear source of truth
- much harder abuse
- faster UI and cheaper sheet reads

## Priority 0

### 1. Make one leaderboard source of truth

Problem:

- the frontend writes leaderboard entries
- there are two competing leaderboard concepts:
  - direct leaderboard writes
  - leaderboard reads derived from puzzle submissions

Impact:

- ranks can drift
- debugging becomes confusing

Decision:

- derive the public leaderboard from `Puzzle Submissions`
- treat `Puzzle Submissions` as the source of truth
- use badges on the leaderboard to show:
  - proof submitted
  - proof missing
- keep proof-missing users visible only during a 24 hour grace window after qualification/submission
- after 24 hours without proof, hide them from the leaderboard but do not delete their sheet row
- if proof is later attached to that same user/submission identity, they should appear on the leaderboard again

Required changes:

- update `getLeaderboard_` in `docs/AppsScriptWithAdminLog.gs`
- make leaderboard ranking come directly from the best valid row in `Puzzle Submissions`
- include `hasProof` and `proofDeadlineTs` in the response so the frontend can show the correct badge
- remove separate leaderboard writes from the frontend
- make sure leaderboard filtering works like this:
  - `hasProof = true`: always eligible to show
  - `hasProof = false` and still within 24 hours: show with pending badge
  - `hasProof = false` and past 24 hours: hide from leaderboard only
  - later proof attached: show again immediately

### 2. Make profile save a real backend step

Problem:

- `handleProfileStart` in `src/PlayToWL.jsx` is mostly local
- profile uniqueness is not reserved remotely before play begins

Impact:

- users think they are registered when they are not
- identity collisions are discovered too late

Decision:

- starting the game should create or update a remote profile record first
- localStorage should only mirror confirmed backend state

Required changes:

- change `handleProfileStart` in `src/PlayToWL.jsx` to call `submitPuzzleProfileRecord`
- Apps Script should reject conflicting profile pairs
- on success, store the confirmed backend profile locally

### 3. Move tweet proof verification to Apps Script

Problem:

- tweet verification currently happens in the browser
- direct POSTs to Apps Script can bypass that check

Impact:

- fake proof links can be stored
- required tweet rules are not enforced centrally

Decision:

- Apps Script must validate the submitted tweet link before marking proof as accepted

Required changes:

- add a server-side verification function in `docs/AppsScriptWithAdminLog.gs`
- verify:
  - valid status URL
  - expected username match
  - required tweet content or quote target
- only then write to `Puzzle Submissions` and mark `hasProof`

Note:

- if direct X API access is not available in Apps Script, use a backend-verifiable fallback carefully
- but do not leave proof trust in the browser

## Priority 1

### 4. Stop trusting `qualified/currentScore` blindly

Problem:

- the browser sends `currentScore`, `moves`, `time`, and `qualified`
- Apps Script accepts those values directly

Impact:

- qualified runs can be forged by scripted requests

Decision:

- Apps Script should accept a run only if it matches a server-observed run trail

App Script-friendly version:

- create a `run_started` record with `runId`
- stream important game events already being sent in analytics
- at proof submission time, recompute whether a qualifying run exists for that identity and `runId`
- reject proof submissions that do not have a matching qualified run trail

This is not perfect anti-cheat, but it is much better than trusting one final POST.

Required changes:

- tighten `appendGameAnalyticsEvent_`
- require `runId`, `clientSessionId`, `attemptNumber`
- store and validate a minimum run lifecycle:
  - `run_started`
  - `run_completed`
  - qualified outcome
- update `validatePuzzleSubmissionPayload_` and submission acceptance logic

### 5. Add abuse controls in Apps Script

Problem:

- current endpoints are easy to spam
- full-sheet scans plus open POST endpoints will become operational pain

Decision:

- add request throttling and identity throttling

Required changes:

- use `CacheService` keyed by:
  - browserId
  - walletAddress
  - xUsername
  - IP-derived hints when available
- block repeated writes inside short windows
- log rejected attempts into a moderation sheet or admin log

### 6. Make proof and leaderboard state transitions explicit

Problem:

- current proof state is inferred from mixed sheet rows

Decision:

- define explicit states:
  - `profile_saved`
  - `qualified_unsubmitted`
  - `proof_pending`
  - `proof_submitted`
  - `proof_verified`
  - `proof_expired`
  - `disqualified`

Required changes:

- persist state transitions in Apps Script
- return those states directly to the frontend
- stop reconstructing state from too many loose fields

## Priority 2

### 7. Reduce full-sheet scans

Problem:

- Apps Script repeatedly loads entire sheets for leaderboard, proof status, and analytics summaries

Impact:

- slower responses
- higher quota use
- scalability problems

Decision:

- introduce lightweight indexes and precomputed summaries

Required changes:

- keep `Puzzle Submissions` as authority
- keep profile index keys in `ScriptProperties` or `CacheService`
- keep recent proof state per identity in a small lookup cache
- avoid recomputing from all rows for hot endpoints

### 8. Reduce frontend polling pressure

Problem:

- the game page refreshes leaderboard every 20 seconds
- proof sync and leaderboard sync are layered on top

Decision:

- use slower background polling and more event-driven refreshes

Required changes in `src/PlayToWL.jsx`:

- refresh leaderboard on:
  - page open
  - qualification complete
  - proof submitted
  - manual refresh
- increase passive polling interval
- skip polling when tab is hidden

### 9. Split `PlayToWL.jsx`

Problem:

- the file currently mixes:
  - game engine
  - leaderboard sync
  - profile/proof handling
  - analytics
  - modal flow

Impact:

- harder to debug
- higher regression risk

Decision:

- split into focused modules/hooks

Suggested structure:

- `usePuzzleGame`
- `usePuzzleProfile`
- `usePuzzleProof`
- `usePuzzleLeaderboard`
- `puzzleApi.js`

## Priority 3

### 10. Clarify score rules in UI

Problem:

- live score, final score, and fail condition are not obvious to users

Decision:

- one visible explanation of:
  - target score
  - bonus rules
  - when a run dies

Required changes:

- add a short scoring help block on the game tab
- show live projected final score and fail threshold clearly

### 11. Clean local storage strategy

Problem:

- localStorage is doing too much:
  - profile
  - leaderboard cache
  - proof snapshot
  - qualified snapshot

Decision:

- keep local storage as cache only, not authority

Required changes:

- version the keys
- separate:
  - cache
  - local draft
  - confirmed backend state

## Recommended Implementation Order

### Phase 1

- lock leaderboard source of truth to `Puzzle Submissions`
- make profile save server-backed
- move proof verification server-side

### Phase 2

- require run lifecycle consistency before accepting qualification
- add throttling and abuse controls
- simplify proof state model

### Phase 3

- reduce full-sheet scans
- reduce frontend polling
- refactor `PlayToWL.jsx`

## Concrete File Targets

Frontend:

- `src/PlayToWL.jsx`
- `src/taskConfig.js`

Apps Script:

- `docs/AppsScriptWithAdminLog.gs`

Most important backend functions to change first:

- `doGet`
- `doPost`
- `getLeaderboard_`
- `validatePuzzleSubmissionPayload_`
- `appendPuzzleProfileRecord_`
- `appendPuzzleSubmissionUnique_`
- `getPuzzleProofStatus_`

## Suggested Success Criteria

- profile save is confirmed by Apps Script before gameplay unlocks
- leaderboard reads come from `Puzzle Submissions`
- proof submission is verified server-side
- fake direct proof POSTs are rejected
- leaderboard badges correctly show proof submitted vs proof missing
- users without proof disappear from the leaderboard after 24 hours without being deleted from `Puzzle Submissions`
- those same users reappear automatically when proof is later attached
- leaderboard and proof endpoints do not require repeated full-sheet scans for normal traffic
