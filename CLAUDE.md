# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Auto Vote Rating is a Chrome/Edge browser extension (Manifest v3) that automates voting and claiming daily rewards on gaming server rating sites. It supports 150+ sites including Minecraft servers, Discord bot listings, Rust servers, and more.

Key features:
- Automated voting with captcha assistance (reCAPTCHA, hCaptcha, Yandex SmartCaptcha, Cloudflare Turnstile, MTCaptcha)
- Silent vote mode (background execution without opening tabs)
- Scheduled voting with customizable cooldowns
- Multi-project management with IndexedDB storage

## Core Architecture

### File Structure (After Refactoring)

```
├── manifest.json        # Chrome extension manifest v3
├── libs/
│   ├── idb.umd.js       # IndexedDB wrapper
│   └── linkedom.js      # DOM parser for service worker
├── src/
│   ├── core/
│   │   ├── background.js    # Service worker - manages voting queue, alarms
│   │   ├── projects.js      # Configuration for all supported sites (allProjects)
│   │   ├── main.js          # Core voting logic and utilities
│   │   └── options.js       # UI for managing projects and settings
│   ├── ui/
│   │   └── options.html     # Extension settings page
│   ├── utils/
│   │   ├── database/        # Database utilities (init, migrations)
│   │   ├── voting/          # Voting logic (time calculator, result handler)
│   │   └── browser/         # Browser APIs (tabs, notifications, alarms)
│   └── scripts/
│       ├── sites/           # Site-specific voting scripts (DOMAIN.js)
│       ├── silentvote/      # Background voting scripts (DOMAIN_silentvote.js)
│       └── common/          # Common scripts (api, captcha, alert, istrusted)
└── css/                 # Stylesheets
```

**IMPORTANT**: After refactoring, Service Worker (`src/core/background.js`) uses **absolute paths** with `/` prefix in `importScripts()`:
```javascript
importScripts('/libs/idb.umd.js')           // ✓ Correct (absolute from extension root)
importScripts('/src/core/projects.js')     // ✓ Correct
importScripts('libs/idb.umd.js')           // ✗ Wrong (relative to service worker location)
```

### How Voting Works

1. **Project Registration** (`projects.js`):
   - Each domain has configuration with functions: `pageURL()`, `voteURL()`, `projectName()`, `parseURL()`, `timeout()`
   - Special flags: `notRequiredCaptcha()`, `silentVote()`, `needIsTrusted()`, `needAdditionalOrigins()`

2. **Voting Flow**:
   - User adds project URL → parsed by `parseURL()` → stored in IndexedDB
   - `background.js` schedules alarm based on `timeout()`
   - On alarm: opens tab, injects `scripts/DOMAIN.js` + `scripts/main/api.js`
   - Script executes `vote(first)` function → sends result via chrome.runtime.sendMessage
   - Results: `{successfully}`, `{later}`, `{errorVoteNoElement}`, `{message}`

3. **Silent Vote Mode**:
   - Projects with `silentVote()` = true execute in background worker
   - Script: `scripts/DOMAIN_silentvote.js` with function `silentVote_DOMAIN(project)`
   - Uses fetch API + linkedom for DOM parsing
   - Imported in `background.js` install event

### Message Protocol

Content scripts communicate with background via:
- `{successfully: timestamp}` - vote succeeded
- `{later: timestamp|true}` - set next vote time (or use default timeout)
- `{errorVoteNoElement: message}` - element not found error
- `{message: text}` - general status message
- `{silentVote: true}` - silent vote completed, will open tab for actual voting

## Adding Support for New Sites

### Standard Vote (Opens Tab)

1. **Add to `projects.js`**:
```javascript
'example.com': {
    pageURL: (project) => 'https://example.com/server/' + project.id,
    voteURL: (project) => 'https://example.com/vote/' + project.id,
    projectName: (doc) => doc.querySelector('h1.title').textContent,
    exampleURL: () => ['https://example.com/server/', '12345', ''],
    parseURL: (url) => ({id: url.pathname.split('/')[2]}),
    timeout: () => ({hours: 24}),  // or {hour: 12, minutes: 30}
    notRequiredCaptcha: () => true,  // if no captcha on site
    notRequiredNick: () => true,     // if no nickname needed
    notRequiredId: () => true        // if project ID not required
}
```

2. **Create `scripts/example.com.js`**:
```javascript
async function vote(first) {
    if (first === false) return  // only run on first call

    // Find and click vote button
    const voteButton = document.querySelector('.vote-btn')
    if (!voteButton) {
        chrome.runtime.sendMessage({errorVoteNoElement: 'Vote button not found'})
        return
    }

    voteButton.click()
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Check for success
    if (document.querySelector('.success-message')) {
        chrome.runtime.sendMessage({successfully: Date.now()})
        return
    }

    // Check for cooldown
    const cooldownEl = document.querySelector('.cooldown')
    if (cooldownEl) {
        chrome.runtime.sendMessage({later: true})
        return
    }
}
```

### Silent Vote (Background Mode)

1. Add `silentVote: () => true` to `projects.js` configuration

2. Create `scripts/example.com_silentvote.js`:
```javascript
self['silentVote_example.com'] = async function (project) {
    const response = await fetch('https://example.com/api/vote', {
        method: 'POST',
        body: JSON.stringify({serverId: project.id})
    })

    if (response.ok) {
        endVote({silentVote: true}, null, project)
    } else {
        endVote({message: 'Vote failed'}, null, project)
    }
}
```

3. Import in `background.js` install event:
```javascript
importScripts('scripts/example.com_silentvote.js')
```

### Multi-Task Sites (e.g., magicrust.gg)

Some sites support multiple tasks (free case + wheel of fortune):

1. Use `parseURL()` to set different `project.id` based on URL path:
```javascript
parseURL: (url) => {
    if (url.pathname.includes('/wheel-fortune')) {
        return {id: 'wheel fortune'}
    }
    return {id: 'free daily case'}
}
```

2. Make `pageURL()`, `voteURL()`, `projectName()`, `timeout()` conditional on `project.id`

3. In voting script, delegate to different functions:
```javascript
async function vote(first) {
    if (document.URL.includes('/wheel-fortune')) {
        return await voteWheelFortune(first)
    } else {
        return await voteFreeCase(first)
    }
}
```

## Key Patterns

### Cooldown Detection and Time Calculation

**CRITICAL**: Always send **specific cooldown time** instead of `{later: true}` when possible.

**Why**: When `{later: true}` is sent, background calculates time based on `project.stats.lastSuccessVote`. If this is empty (first run, data reset), cooldown is calculated from **current time**, causing immediate re-execution loop.

**Correct approach**:
```javascript
function sendCooldown(nextVoteTime) {
    // Calculate specific time if not provided
    if (!nextVoteTime) {
        const cooldownHours = 10  // Site-specific cooldown
        nextVoteTime = Date.now() + (cooldownHours * 60 * 60 * 1000) + (60 * 1000)
        console.log('[Site] Calculated cooldown:', cooldownHours, 'hours ->', new Date(nextVoteTime).toLocaleString())
    }
    chrome.runtime.sendMessage({later: nextVoteTime})  // Send specific timestamp
}
```

**Check cooldown BEFORE attempting vote**:
```javascript
// Check if timer visible before clicking
const timerElement = document.querySelector('.cooldown-timer')
if (timerElement && timerElement.offsetParent !== null) {
    const cooldownTime = parseCooldownTime(timerElement.textContent)
    chrome.runtime.sendMessage({later: cooldownTime})
    return
}
```

Parse various time formats:
- "21 ч. 59 м. 2 с." (Russian format) → Use regex: `/(\d+)\s*ч\.?\s*(\d+)\s*м\.?\s*(\d+)\s*с\.?/`
- "21:59:02" (HH:MM:SS)
- "22 hours" (text format)

Example parsing function:
```javascript
function parseCooldownTime(text) {
    const cleanText = text.trim().replace(/\s+/g, ' ')

    // Russian format: "3 ч. 37 м. 36 с."
    const russianMatch = cleanText.match(/(\d+)\s*ч\.?\s*(\d+)\s*м\.?\s*(\d+)\s*с\.?/)
    if (russianMatch) {
        const hours = parseInt(russianMatch[1]) || 0
        const minutes = parseInt(russianMatch[2]) || 0
        const seconds = parseInt(russianMatch[3]) || 0
        return Date.now() + (hours * 3600 + minutes * 60 + seconds) * 1000 + 30000
    }
    return null
}
```

### Success Detection

Check multiple indicators:
1. Success message elements
2. Button disabled state after click
3. Timer appearance after action
4. Error message absence

Only send `{successfully}` after confirmed vote, not when cooldown detected.

## Debugging and Testing

### Adding Debug Logging

When debugging voting scripts, add comprehensive logging with prefixes:

```javascript
console.log('[Site Name] Starting vote, first:', first)
console.log('[Site Name] Step 1: Checking for cooldown...')
console.log('[Site Name] Found notification:', text)
console.log('[Site Name] ✓ SUCCESS detected:', message)
console.log('[Site Name] ✗ ERROR:', error)
console.log('[Site Name] Calculated cooldown:', hours, 'hours ->', new Date(time).toLocaleString())
```

**Filter console logs**: In browser DevTools, use filter `[Site Name]` to see only relevant logs.

### Testing After Changes

1. **Reload extension**: `chrome://extensions/` → click "Reload" button
2. **For service worker changes**: May need to unregister at `chrome://serviceworker-internals/`
3. **For script changes**:
   - Open browser console (F12)
   - Filter logs by site name: `[Free Case]`, `[Wheel Fortune]`, etc.
   - Watch full execution flow
4. **Test voting flow**: Add test project → check console logs → verify timing

## Common Issues and Solutions

### Extension Won't Load
- **"Service worker registration failed. Status code: 15"**: Syntax error or import issue in Service Worker
  - Check all `importScripts()` use absolute paths with `/` prefix
  - Verify all imported files exist and have valid syntax: `node -c path/to/file.js`
  - Look for empty or malformed import files

### Voting Loop (Keeps Reopening Tab)
- **Script sends `{later: true}` without specific time AND `lastSuccessVote` is empty**
  - Solution: Always calculate and send specific timestamp: `{later: Date.now() + cooldownMs}`
  - Add logging to verify: `console.log('[Site] Calculated cooldown time:', new Date(time).toLocaleString())`

### Vote Detection Issues
- **Vote counted as success but timer visible**: Check cooldown BEFORE clicking button, not after
- **Cooldown message not detected**:
  - Check message text in console logs
  - Verify cooldown keywords include all variations (case-insensitive)
  - Check notification appears/disappears quickly - add multiple check attempts with delays
- **Captcha not detected**: Verify `notRequiredCaptcha()` is not set to true

### Path Issues After Refactoring
- **Files not found**: Update paths in `options.html` to use `../../` for root resources
  - Images: `../../images/icons/file.svg`
  - Scripts: `../core/main.js`, `../utils/database/db-init.js`

## Module System and Dependencies

### Service Worker Context
- Uses `importScripts()` for synchronous module loading
- All paths must be absolute from extension root: `/libs/file.js`, `/src/core/file.js`
- Database migrations loaded in specific order (see `background.js`)
- No ES6 modules support in Service Worker context

### Content Script Context
- Loaded via `<script>` tags in HTML or injected via `chrome.scripting.executeScript`
- Can use relative paths from HTML location
- Shares same functions as Service Worker but loaded differently

### Shared Code Pattern
Files used in both contexts (like `main.js`):
- No `importScripts()` calls inside (would fail in HTML context)
- Dependencies loaded externally before the shared file
- Service Worker: imports via `background.js`
- HTML: imports via `<script>` tags in correct order

## Important Notes

- **Language**: All user-facing messages should be in Russian (this is a Russian-language extension)
- **Commit messages**: Write in Russian, be descriptive
- **Line endings**: Files use CRLF (Windows), git may show warnings
- **No linting**: Project has no linter/formatter configured
- **Browser compatibility**: Chrome 105.0+, designed for Chromium-based browsers
- **File structure**: After refactoring, core files are in `src/` subdirectories
