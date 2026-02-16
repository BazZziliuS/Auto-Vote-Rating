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

### File Structure

```
├── background.js          # Service worker - manages voting queue, alarms, tab injection
├── projects.js           # Configuration for all supported sites (allProjects object)
├── main.js              # Core voting logic and utilities
├── options.js           # UI for managing projects and settings
├── options.html         # Extension settings page
├── manifest.json        # Chrome extension manifest v3
├── scripts/
│   ├── DOMAIN.js        # Site-specific voting scripts (e.g., magicrust.gg.js)
│   ├── DOMAIN_silentvote.js  # Background voting scripts (no tab needed)
│   └── main/
│       ├── api.js           # Messaging between content script and background
│       ├── captchaclicker.js # Captcha detection and solving
│       ├── audio_captcha.js  # Audio captcha to text conversion
│       ├── hacktimer.js      # Timer that works in background tabs
│       ├── alert_main.js     # Alert handling
│       ├── istrusted_main.js # Trusted event simulation
│       └── visible.js        # Visibility detection
└── libs/
    ├── idb.umd.js       # IndexedDB wrapper
    └── linkedom.js      # DOM parser for service worker
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

### Cooldown Parsing

Always check for cooldown BEFORE attempting vote:
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
- "21 ч. 59 м. 2 с." (Russian format)
- "21:59:02" (HH:MM:SS)
- "22 hours" (text format)

### Success Detection

Check multiple indicators:
1. Success message elements
2. Button disabled state after click
3. Timer appearance after action
4. Error message absence

Only send `{successfully}` after confirmed vote, not when cooldown detected.

## Testing After Changes

1. **Reload extension**: `chrome://extensions/` → click "Reload" button
2. **For service worker changes**: May need to unregister at `chrome://serviceworker-internals/`
3. **Test voting flow**: Add test project → check console logs → verify timing

## Common Issues

- **"Script failed to load" error**: Check file exists and is imported in `background.js` install event
- **Vote counted as success but timer visible**: Check cooldown BEFORE clicking button, not after
- **Captcha not detected**: Verify `notRequiredCaptcha()` is not set to true

## Important Notes

- **Language**: All user-facing messages should be in Russian (this is a Russian-language extension)
- **Commit messages**: Write in Russian, be descriptive
- **Line endings**: Files use CRLF (Windows), git may show warnings
- **No linting**: Project has no linter/formatter configured
- **Browser compatibility**: Chrome 105.0+, designed for Chromium-based browsers
