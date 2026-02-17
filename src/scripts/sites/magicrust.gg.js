// noinspection ES6MissingAwait

// ============================================================================
// Constants
// ============================================================================
const SELECTORS = {
    notification: '.notyf__message',
    moddedButton: 'button.change-gmod[data-gmod="modded"]',
    freeCaseButton: '.products__card .products__card-btn-free',
    productCard: '.products__card',
    modal: '.modal[data-product-id="5"], .modal[data-modal="product-5"]',
    authButton: '.auth-btn, .modal-simple-cmd__btn-auth',
    openCaseButton: '.modal-product-buy',
    errorMessage: '.alert-danger, .error-message',
    successMessage: '.alert-success, .success-message, .modal-roulette__result'
}

const MESSAGES = {
    cooldown: [
        '10 часов', '10 hours',
        'доступен каждые', 'доступн', 'available in',
        'кулдаун', 'cooldown',
        'подожди', 'wait',
        'уже получ', 'already received', 'already claimed',
        'попробуй позже', 'try later',
        'час', 'hour', 'мин', 'min'
    ],
    success: ['успешно', 'success', 'получен', 'received', 'claimed'],
    insufficientFunds: 'Недостаточно средств',
    freeCaseCooldownHours: 10 // Кулдаун для free daily case в часах
}

const TIMEOUTS = {
    moddedButtonClick: 1000,
    modalAppear: 150,
    modalMaxAttempts: 20,
    buttonReady: 500,
    waitResult: 2500
}

// ============================================================================
// Helper Functions
// ============================================================================
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function sendError(message) {
    chrome.runtime.sendMessage({errorVoteNoElement: message})
}

function sendCooldown(nextVoteTime) {
    // If no specific time provided for free case, calculate based on cooldown hours
    if (!nextVoteTime && typeof MESSAGES.freeCaseCooldownHours !== 'undefined') {
        nextVoteTime = Date.now() + (MESSAGES.freeCaseCooldownHours * 60 * 60 * 1000) + (60 * 1000) // +1 minute buffer
        console.log('[Free Case] Calculated cooldown time:', MESSAGES.freeCaseCooldownHours, 'hours →', new Date(nextVoteTime).toLocaleString())
    }
    chrome.runtime.sendMessage({later: nextVoteTime || true})
}

function sendSuccess() {
    chrome.runtime.sendMessage({successfully: Date.now()})
}

function sendMessage(text) {
    chrome.runtime.sendMessage({message: text})
}

function containsAny(text, keywords) {
    return keywords.some(keyword => text.includes(keyword))
}

// ============================================================================
// Message Handlers
// ============================================================================
function handleNotificationMessage(text) {
    if (containsAny(text, MESSAGES.cooldown)) {
        sendCooldown()
        return true
    }
    if (containsAny(text, MESSAGES.success)) {
        sendSuccess()
        return true
    }
    if (text.includes(MESSAGES.insufficientFunds)) {
        sendMessage('ERROR: Opened wrong case (not free). Got: ' + text)
        return true
    }
    return false
}

function checkInitialNotification() {
    const notification = document.querySelector(SELECTORS.notification)
    if (!notification) return false

    const text = notification.textContent.trim()
    return handleNotificationMessage(text)
}

// ============================================================================
// UI Interaction Functions
// ============================================================================
async function activateModdedMode() {
    const button = document.querySelector(SELECTORS.moddedButton)
    if (!button) {
        sendError('Modded button not found')
        return false
    }

    if (!button.classList.contains('active')) {
        button.click()
        await wait(TIMEOUTS.moddedButtonClick)
    }
    return true
}

function validateFreeCase() {
    const freeCaseButton = document.querySelector(SELECTORS.freeCaseButton)
    if (!freeCaseButton) {
        sendError('Free case button not found')
        return null
    }

    const freeCase = freeCaseButton.closest(SELECTORS.productCard)
    if (!freeCase) {
        sendError('Could not find parent card for free button')
        return null
    }

    // Check if case is for modded mode
    const gmodAttr = freeCase.getAttribute('data-gmod')
    if (!gmodAttr || !gmodAttr.includes('modded')) {
        sendError('Free case not available for modded mode')
        return null
    }

    // Check visibility
    const style = window.getComputedStyle(freeCase)
    if (style.display === 'none' || !freeCase.offsetParent) {
        sendError('Free case is hidden')
        return null
    }

    return freeCaseButton
}

async function waitForModal() {
    for (let i = 0; i < TIMEOUTS.modalMaxAttempts; i++) {
        await wait(TIMEOUTS.modalAppear)

        const modal = document.querySelector(SELECTORS.modal)
        if (modal && modal.classList.contains('modal-on')) {
            return modal
        }
    }

    // Check if cooldown message appeared
    const notification = document.querySelector(SELECTORS.notification)
    if (notification && containsAny(notification.textContent, MESSAGES.cooldown)) {
        sendCooldown()
        return null
    }

    sendError('Modal did not appear')
    return null
}

async function handleModalActions(modal) {
    await wait(TIMEOUTS.buttonReady)

    // Check if user needs to authenticate
    const authButton = modal.querySelector(SELECTORS.authButton)
    if (authButton) {
        authButton.click()
        return false
    }

    // Try to open the case
    const openCaseButton = modal.querySelector(SELECTORS.openCaseButton)
    if (!openCaseButton) {
        sendError('Open case button not found in modal')
        return false
    }

    openCaseButton.click()
    return true
}

// ============================================================================
// Result Checking Functions
// ============================================================================
function checkNotificationResult() {
    // Try to find any notification (including those that are disappearing)
    const notifications = document.querySelectorAll('.notyf__message, .notyf__toast, ' + SELECTORS.notification)
    console.log('[Free Case] checkNotificationResult: found', notifications.length, 'notifications')

    if (notifications.length === 0) return false

    // Check all notifications (sometimes multiple can be present)
    for (const notification of notifications) {
        if (!notification) continue

        const text = notification.textContent.trim()
        if (!text) continue

        console.log('[Free Case] Notification text:', text)

        // Check for cooldown message
        if (containsAny(text.toLowerCase(), MESSAGES.cooldown.map(m => m.toLowerCase()))) {
            console.log('[Free Case] ✓ COOLDOWN detected:', text)
            sendCooldown()
            return true
        }

        // Check for success message
        if (containsAny(text.toLowerCase(), MESSAGES.success.map(m => m.toLowerCase()))) {
            console.log('[Free Case] ✓ SUCCESS detected:', text)
            sendSuccess()
            return true
        }

        // Check for insufficient funds
        if (text.includes(MESSAGES.insufficientFunds)) {
            console.log('[Free Case] ✗ ERROR - Insufficient funds:', text)
            sendMessage('ERROR: Opened wrong case (not free). Got: ' + text)
            return true
        }

        // If we found a message but don't recognize it, log it
        if (text.length > 5) {
            console.log('[Free Case] ⚠ Unknown message:', text)
            sendMessage(text)
            return true
        }
    }

    return false
}

function checkErrorMessages() {
    const errorMsg = document.querySelector(SELECTORS.errorMessage)
    if (!errorMsg) {
        console.log('[Free Case] checkErrorMessages: no error element found')
        return false
    }

    const text = errorMsg.textContent.trim()
    console.log('[Free Case] Error message found:', text)

    if (containsAny(text, MESSAGES.cooldown)) {
        console.log('[Free Case] ✓ COOLDOWN detected in error message')
        sendCooldown()
        return true
    }

    console.log('[Free Case] ⚠ Unknown error message')
    sendMessage(text)
    return true
}

function checkSuccessMessages() {
    const successMsg = document.querySelector(SELECTORS.successMessage)
    if (successMsg) {
        console.log('[Free Case] ✓ SUCCESS message element found')
        sendSuccess()
        return true
    }
    console.log('[Free Case] checkSuccessMessages: no success element found')
    return false
}

// ============================================================================
// Main Vote Function
// ============================================================================
async function vote(first) {
    // Delegate to appropriate function based on URL
    if (document.URL.includes('/wheel-fortune')) {
        return await voteWheelFortune(first)
    } else {
        return await voteFreeCase(first)
    }
}

// ============================================================================
// Free Daily Case Vote Function
// ============================================================================
async function voteFreeCase(first) {
    console.log('[Free Case] Starting voteFreeCase, first:', first)

    // Check for immediate messages
    console.log('[Free Case] Checking for initial notification...')
    if (checkInitialNotification()) {
        console.log('[Free Case] Initial notification found and handled')
        return
    }

    // Execute only on first run
    if (first === false) {
        console.log('[Free Case] Not first run, skipping')
        return
    }

    // Wait a bit for page to fully load
    await wait(500)

    // Check if there's already a notification about cooldown
    console.log('[Free Case] Checking for existing notification...')
    const existingNotification = document.querySelector(SELECTORS.notification)
    if (existingNotification) {
        const text = existingNotification.textContent.trim()
        console.log('[Free Case] Found notification:', text)
        if (containsAny(text, MESSAGES.cooldown)) {
            console.log('[Free Case] Cooldown message detected in notification')
            sendCooldown()
            return
        }
    }

    // Step 1: Activate modded mode
    console.log('[Free Case] Step 1: Activating modded mode...')
    if (!await activateModdedMode()) {
        console.log('[Free Case] Failed to activate modded mode')
        return
    }

    // Step 2: Validate free case
    console.log('[Free Case] Step 2: Validating free case button...')
    const freeCaseButton = validateFreeCase()
    if (!freeCaseButton) {
        console.log('[Free Case] Free case button validation failed')
        return
    }

    // Check button state before clicking
    const freeCase = freeCaseButton.closest(SELECTORS.productCard)
    if (freeCase) {
        // Check if button is disabled or has cooldown class
        if (freeCaseButton.disabled ||
            freeCaseButton.classList.contains('disabled') ||
            freeCaseButton.classList.contains('cooldown')) {
            console.log('[Free Case] Button is disabled or has cooldown class')
            sendCooldown()
            return
        }

        // Check button text for cooldown indicators
        const buttonText = freeCaseButton.textContent.trim().toLowerCase()
        console.log('[Free Case] Button text:', buttonText)
        if (buttonText.includes('час') ||
            buttonText.includes('hour') ||
            buttonText.includes('мін') ||
            buttonText.includes('min') ||
            buttonText.includes(':')) {
            console.log('[Free Case] Button text contains cooldown indicator')
            sendCooldown()
            return
        }
    }

    // Step 3: Click free case button
    console.log('[Free Case] Step 3: Clicking free case button...')
    freeCaseButton.click()

    // Step 4: Wait for modal
    console.log('[Free Case] Step 4: Waiting for modal...')
    const modal = await waitForModal()
    if (!modal) {
        console.log('[Free Case] Modal did not appear or cooldown detected')
        return
    }

    console.log('[Free Case] Step 5: Handling modal actions...')
    const caseOpened = await handleModalActions(modal)
    if (!caseOpened) {
        console.log('[Free Case] Case was not opened (may need auth or other issue)')
        return
    }

    // Step 6: Wait for result and check messages multiple times
    console.log('[Free Case] Step 6: Waiting for result...')
    // Sometimes notifications appear with delay
    for (let attempt = 0; attempt < 5; attempt++) {
        console.log('[Free Case] Check attempt', attempt + 1, 'of 5')
        await wait(500)

        // Check in order of priority
        if (checkNotificationResult()) {
            console.log('[Free Case] Notification result found')
            return
        }
        if (checkErrorMessages()) {
            console.log('[Free Case] Error message found')
            return
        }
        if (checkSuccessMessages()) {
            console.log('[Free Case] Success message found')
            return
        }
    }

    // Final check after longer wait
    console.log('[Free Case] Final check after 1 second...')
    await wait(1000)
    if (checkNotificationResult()) {
        console.log('[Free Case] Final check: Notification result found')
        return
    }
    if (checkErrorMessages()) {
        console.log('[Free Case] Final check: Error message found')
        return
    }
    if (checkSuccessMessages()) {
        console.log('[Free Case] Final check: Success message found')
        return
    }

    // If we got here, assume success
    console.log('[Free Case] No result found, assuming success')
    sendSuccess()
}

// ============================================================================
// Wheel Fortune Vote Function
// ============================================================================

// Wheel Fortune Selectors
const WHEEL_SELECTORS = {
    spinButton: 'button.wheel-button, button[class*="wheel"], button[class*="spin"]',
    cooldownTimer: '.wheel-fortune__wheel-timer-lost, .wheel-timer, .cooldown, [class*="timer"], [class*="cooldown"]',
    notification: '.notification, .alert, .toast',
    successMessage: '.success, [class*="success"]',
    errorMessage: '.error, [class*="error"]'
}

const WHEEL_TIMEOUTS = {
    pageLoad: 2000,
    spinAnimation: 5000,
    checkResult: 1000,
    cooldownCheck: 500
}

// Cooldown Parsing Functions
function parseCooldownTime(text) {
    if (!text) return null

    // Clean up text: remove extra spaces, normalize
    const cleanText = text.trim().replace(/\s+/g, ' ')

    // Try to parse format "3 ч. 37 м. 36 с." (Russian format from magicrust.gg)
    // Also handle variations: "3ч. 37м. 36с.", "3 ч 37 м 36 с"
    const russianMatch = cleanText.match(/(\d+)\s*ч\.?\s*(\d+)\s*м\.?\s*(\d+)\s*с\.?/)
    if (russianMatch) {
        const hours = parseInt(russianMatch[1]) || 0
        const minutes = parseInt(russianMatch[2]) || 0
        const seconds = parseInt(russianMatch[3]) || 0
        const milliseconds = (hours * 60 * 60 * 1000) + (minutes * 60 * 1000) + (seconds * 1000)
        const result = Date.now() + milliseconds + (30 * 1000) // +30 seconds buffer
        console.log('[Wheel Fortune] Parsed Russian format:', cleanText, '→', hours + 'h', minutes + 'm', seconds + 's', '→ Next vote:', new Date(result).toLocaleString())
        return result
    }

    // Try format with only hours and minutes: "3 ч. 37 м."
    const russianHMMatch = cleanText.match(/(\d+)\s*ч\.?\s*(\d+)\s*м\.?/)
    if (russianHMMatch) {
        const hours = parseInt(russianHMMatch[1]) || 0
        const minutes = parseInt(russianHMMatch[2]) || 0
        const milliseconds = (hours * 60 * 60 * 1000) + (minutes * 60 * 1000)
        const result = Date.now() + milliseconds + (30 * 1000)
        console.log('[Wheel Fortune] Parsed Russian H:M format:', cleanText, '→', hours + 'h', minutes + 'm', '→ Next vote:', new Date(result).toLocaleString())
        return result
    }

    // Try to find time in format HH:MM:SS or H:MM:SS
    const timeMatch = cleanText.match(/(\d+):(\d+):(\d+)/)
    if (timeMatch) {
        const hours = parseInt(timeMatch[1]) || 0
        const minutes = parseInt(timeMatch[2]) || 0
        const seconds = parseInt(timeMatch[3]) || 0
        const milliseconds = (hours * 60 * 60 * 1000) + (minutes * 60 * 1000) + (seconds * 1000)
        const result = Date.now() + milliseconds + (60 * 1000) // +1 minute buffer
        console.log('[Wheel Fortune] Parsed HH:MM:SS format:', cleanText, '→ Next vote:', new Date(result).toLocaleString())
        return result
    }

    // Try to find hours in text (e.g., "22 часа", "22 hours")
    const hoursMatch = cleanText.match(/(\d+)\s*(час|hour)/i)
    if (hoursMatch) {
        const hours = parseInt(hoursMatch[1]) || 0
        const result = Date.now() + (hours * 60 * 60 * 1000) + (60 * 1000)
        console.log('[Wheel Fortune] Parsed hours only:', cleanText, '→', hours + 'h', '→ Next vote:', new Date(result).toLocaleString())
        return result
    }

    console.log('[Wheel Fortune] Could not parse time from:', cleanText)
    return null
}

function getCooldownFromPage() {
    // Try to find cooldown timer elements
    const timerElements = document.querySelectorAll(WHEEL_SELECTORS.cooldownTimer)
    console.log('[Wheel Fortune] Looking for timer elements, found:', timerElements.length)

    for (const element of timerElements) {
        if (!element || !element.textContent) continue

        const text = element.textContent.trim()
        if (text.length === 0) continue

        console.log('[Wheel Fortune] Checking timer element:', element.className, 'Text:', text)

        const cooldownTime = parseCooldownTime(text)
        if (cooldownTime) {
            return cooldownTime
        }
    }

    // Default to 22 hours if we can't parse
    console.log('[Wheel Fortune] No timer found, using default 22 hours')
    const defaultTime = Date.now() + (22 * 60 * 60 * 1000)
    console.log('[Wheel Fortune] Default next vote:', new Date(defaultTime).toLocaleString())
    return defaultTime
}

// Button Finding
function findSpinButton() {
    // Try specific selectors first
    let button = document.querySelector(WHEEL_SELECTORS.spinButton)
    if (button) return button

    // Try to find button by text content
    const buttons = document.querySelectorAll('button')
    button = Array.from(buttons).find(btn => {
        const text = btn.textContent.toLowerCase()
        return text.includes('крутить') ||
               text.includes('spin') ||
               text.includes('вращ') ||
               text.includes('колесо')
    })

    return button
}

async function voteWheelFortune(first) {
    // Don't run on Steam domain (auth redirect)
    if (document.URL.includes('steamcommunity.com')) {
        return
    }

    // Execute only on first run
    if (first === false) return

    // Wait for page to load
    await wait(WHEEL_TIMEOUTS.pageLoad)

    console.log('[Wheel Fortune] Checking for cooldown timer on page load')

    // Check if cooldown timer is already visible (BEFORE clicking button)
    const timerElement = document.querySelector('.wheel-fortune__wheel-timer-lost')
    if (timerElement) {
        console.log('[Wheel Fortune] Timer element found:', timerElement.textContent)
        console.log('[Wheel Fortune] Timer visible:', timerElement.offsetParent !== null)

        if (timerElement.offsetParent !== null) {
            // Timer is visible - cooldown is active
            console.log('[Wheel Fortune] Cooldown is active, parsing time...')
            const cooldownTime = getCooldownFromPage()
            sendCooldown(cooldownTime)
            return
        }
    } else {
        console.log('[Wheel Fortune] No timer element found, button should be available')
    }

    // Find the spin button
    const spinButton = findSpinButton()

    if (!spinButton) {
        sendError('Кнопка вращения колеса не найдена')
        return
    }

    // Check if button is disabled (cooldown active)
    if (spinButton.disabled || spinButton.classList.contains('disabled')) {
        const cooldownTime = getCooldownFromPage()
        sendCooldown(cooldownTime)
        return
    }

    // Check button style - sometimes buttons are visually disabled via opacity/pointer-events
    const computedStyle = window.getComputedStyle(spinButton)
    if (computedStyle.pointerEvents === 'none' ||
        computedStyle.opacity === '0' ||
        computedStyle.opacity === '0.5') {
        const cooldownTime = getCooldownFromPage()
        sendCooldown(cooldownTime)
        return
    }

    // Button is enabled - click to spin
    spinButton.click()

    // Wait for spin animation and result
    await wait(WHEEL_TIMEOUTS.spinAnimation)

    // Check for success indicators
    const successMsg = document.querySelector(WHEEL_SELECTORS.successMessage)
    if (successMsg) {
        sendSuccess()

        // Try to get new cooldown time after successful spin
        await wait(WHEEL_TIMEOUTS.cooldownCheck)
        const cooldownTime = getCooldownFromPage()
        if (cooldownTime) {
            chrome.runtime.sendMessage({later: cooldownTime})
        }
        return
    }

    // Check if button is disabled after spin (indicates success)
    if (spinButton.disabled || spinButton.classList.contains('disabled')) {
        sendSuccess()

        // Try to get new cooldown time after successful spin
        await wait(WHEEL_TIMEOUTS.cooldownCheck)
        const cooldownTime = getCooldownFromPage()
        if (cooldownTime) {
            chrome.runtime.sendMessage({later: cooldownTime})
        }
        return
    }

    // Check if timer appeared after spin (indicates success)
    const timerAfterSpin = document.querySelector('.wheel-fortune__wheel-timer-lost')
    if (timerAfterSpin && timerAfterSpin.offsetParent !== null) {
        sendSuccess()

        // Get new cooldown time
        const cooldownTime = getCooldownFromPage()
        if (cooldownTime) {
            chrome.runtime.sendMessage({later: cooldownTime})
        }
        return
    }

    // Check for error messages
    const errorMsg = document.querySelector(WHEEL_SELECTORS.errorMessage)
    if (errorMsg) {
        const errorText = errorMsg.textContent.trim()
        if (errorText.toLowerCase().includes('кулдаун') ||
            errorText.toLowerCase().includes('cooldown') ||
            errorText.toLowerCase().includes('доступно через')) {
            const cooldownTime = getCooldownFromPage()
            sendCooldown(cooldownTime)
            return
        }
        sendMessage(errorText)
        return
    }

    // If we got here, assume success
    sendSuccess()

    // Try to get cooldown time
    await wait(WHEEL_TIMEOUTS.cooldownCheck)
    const cooldownTime = getCooldownFromPage()
    if (cooldownTime) {
        chrome.runtime.sendMessage({later: cooldownTime})
    }
}
