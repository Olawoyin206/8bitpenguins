# PLAY-TO-WL PUZZLE GAME LOGIC (BALANCED VERSION)

## 1) Game State and Setup

- Game states: `playing`, `won`, `resting`
- Grid size: `3x3` with one empty slot
- Puzzle image generated once per page session
- Image remains the same while the page stays open
- New image generates on page refresh
- Tiles are shuffled into a guaranteed solvable arrangement
- Players can attempt multiple runs per session

## 2) Puzzle Interaction Logic

- A tile can only move if it is adjacent to the empty slot
- Valid move triggers:
  - slide animation
  - move counter increment
  - timer start (only after first move)
- Timer increments every second
- Optional hint: highlight movable tiles after 5 seconds of inactivity
- Game can optionally pause when user switches browser tab
- Interaction disabled during cooldown

## 3) Scoring Logic

Base Score: `1000`

Move Penalty:
- First 30 moves: `-3` per move
- Next 30 moves: `-5` per move
- Remaining moves: `-7` per move

Time Penalty:
- First 120 seconds: `-0.5` per second
- Next 180 seconds: `-1` per second
- Remaining time: `-1.5` per second

Bonuses:
- `+120` if solved within 30 moves
- `+100` if solved within 90 seconds
- `+60` if solved within 60 moves

Minimum Final Score: `200`

## 4) Qualification Logic

Required Score: `450`

Outcome:
- Score `>= 450` -> Player Qualified
- Score `350-449` -> Near Miss (encouraged to retry)
- Score `< 350` -> Failed Attempt

Actions when Qualified:
- Player marked qualified
- Score saved locally
- Victory screen displayed
- Submission tab unlocked

## 5) Retry and Cooldown Logic

- 3 attempts allowed every 10 minutes
- Player may retry instantly up to 3 attempts
- After 3 attempts -> cooldown activates

Cooldown:
- Duration: 5 minutes
- Puzzle interaction disabled during cooldown
- Countdown displayed
- Auto unlock when timer expires

## 6) Alert System

Score ranges determine alert messaging:

- `> 550` -> Calm state
- `450-550` -> Almost there!
- `350-450` -> You can still qualify
- `< 350` -> Try another run

Alerts should be soft UI indicators and not flashing warnings.

## 7) Leaderboard Logic

- Shows top 100 players
- Ranked by best score
- Displays:
  - rank
  - X username
  - score
  - timestamp
- Top 3 players receive special styling

Leaderboard refresh:
- Auto refresh every 20 seconds

Data source:
- Google Apps Script endpoint

Local leaderboard updates instantly when player qualifies.

## 8) Victory Screen Flow

When player qualifies, show victory screen instead of redirect.

Display:
- Final score
- Total moves
- Solve time
- Puzzle image

Buttons:
- Save Image
- Tweet & Submit
- Play Again

## 9) Tweet Composer Flow

Steps:
1. Player clicks Tweet & Submit
2. Puzzle image downloads automatically
3. X compose window opens with prefilled text
4. Player attaches downloaded image and posts tweet

Tweet includes:
- Required caption
- Call-to-action line

## 10) Submission Validation Rules

Required fields:
- X username
- Wallet address
- Tweet link

Wallet must match EVM format:
- `0x` + 40 hexadecimal characters

Tweet link must match:
- `https://x.com/username/status/123456789`

Tweet must contain the required campaign caption.

## 11) Submission Payload Sent to Google Script

Payload includes:
- `sheetName: Puzzle Submissions`
- `eventType: puzzle_submission`
- `xUsername`
- `walletAddress`
- `tweetLink`
- `requiredCaption`
- `bestScore`
- `currentScore`
- `moves`
- `time`
- `attemptNumber`
- `sessionID`
- `qualified`
- `imageData`
- `timestamp`

## 12) Submission Limit Rule

- Only one submission allowed per wallet address
- Duplicate submissions blocked
- Player may continue playing for leaderboard ranking

## System Goals

- Reduce player frustration
- Encourage multiple attempts
- Increase engagement and completion rate
- Improve social sharing
- Prevent abuse or farming
