'use strict';

// Init GTM dataLayer for Analytics
let eventValue = 0;
let rating = '';

/** Add click handlers to each of the emoji buttons */
const addEmojiClick = () => {
    const emojis = document.getElementsByClassName("rate-this-page-action");
    for (const emojiEl of emojis) {
        emojiEl.addEventListener('click', (e) => {
            emojiEl.classList.add("selected");
            showThermometerModal();
            // Prepare DataLayer Vars
            rating = emojiEl.getAttribute("data-rating");
            if (rating !== null) {
                switch (rating) {
                    case 'Yes':
                        eventValue = 3;
                        break;
                    case 'Somewhat':
                        eventValue = 2;
                        break;
                    case 'No':
                        eventValue = 1;
                        break;
                }
            }
        });
    }
};

/** Reset the state of the emoji buttons to default */
const resetEmojiStates = () => {
    const emojis = document.getElementsByClassName("rate-this-page-action");
    for (const emojiEl of emojis) {
        emojiEl.classList.remove("selected");
    }
};

/** Hide the confirmation popup */
const hideConfirmationPopup = () => {
    const confirmationEls = document.getElementsByClassName("c-thermometer-popup");
    if (confirmationEls.length > 0) {
        confirmationEls[0].classList.replace("show", "hide");
    }
};

/** Show the confirmation popup */
const showConfirmationPopup = () => {
    const confirmationEls = document.getElementsByClassName("c-thermometer-popup");
    if (confirmationEls.length > 0) {
        confirmationEls[0].classList.replace("hide", "show");
    }
};

/** Hide the feedback modal */
const hideThermometerModal = () => {
    const modalEls = document.getElementsByClassName("c-thermometer-modal__container");
    if (modalEls.length > 0) {
        modalEls[0].classList.replace("show", "hide");
    }
};

/** Show the feedback modal */
const showThermometerModal = () => {
    const modalEls = document.getElementsByClassName("c-thermometer-modal__container");
    if (modalEls.length > 0) {
        modalEls[0].classList.replace("hide", "show");
    }
};

/** Reset the feedback textarea and the character count */
const resetThermometerTextarea = () => {
    const textareaEl = document.getElementById("c-thermometer-modal__textarea");
    if (textareaEl) {
        textareaEl.value = "";
    }
    const counterSpanEl = document.getElementById("c-thermometer-modal__counter-span");
    if (counterSpanEl) {
        counterSpanEl.innerText = "0";
    }
};

/** Cancel button from feedback modal; hide the modal and reset the emoji states. */
const cancelThermometerModal = (event) => {
    hideThermometerModal();
    resetEmojiStates();
};

/** Submit button from feedback modal; submit the feedback, reset the feedback fields, and show a confirmation */
const submitThermometerModal = (event) => {
    let currentString = "";
    const textareaEl = document.getElementById("c-thermometer-modal__textarea");
    if (textareaEl) {
        currentString = textareaEl.value;
    }
    if (currentString !== "" && eventValue > 0) {
        // Submit DataLayer Event
        const dataLayer = window.dataLayer || [];
        dataLayer.push({
            event: 'rateThisPage',
            eventLabel: rating,
            eventValue,
            eventFeedback: currentString
        });
        // Submit Rudderstack event if possible
        // NOTE: Rudderstack support is included by Google Tag Manager
        if (typeof (rudderanalytics) !== 'undefined') {
            rudderanalytics.track("feedback_submitted", {
                label: rating,
                rating: eventValue,
                feedback: currentString
            });
        }
        hideThermometerModal();
        resetEmojiStates();
        resetThermometerTextarea();
        // reset the eventValue
        eventValue = 0;
        showConfirmationPopup();
        setTimeout(() => {
            hideConfirmationPopup();
        }, 3000);
    }
};

/** Add click handlers to the buttons in the feedback modal */
const addModalButtons = () => {
    const closeButtonEl = document.getElementById("c-thermometer-modal__close-x");
    if (closeButtonEl) {
        closeButtonEl.addEventListener("click", cancelThermometerModal);
    }
    const submitButtonEl = document.getElementById("c-thermometer-modal__footer-submit");
    if (submitButtonEl) {
        submitButtonEl.addEventListener("click", submitThermometerModal);
    }
};

/**
 * Update the textarea length display with the current length of the textarea.
 * @param event The DOM event; unused
 */
const updateThermometerTextareaLength = (event) => {
    const textareaEl = document.getElementById("c-thermometer-modal__textarea");
    if (textareaEl) {
        const counterSpanEl = document.getElementById("c-thermometer-modal__counter-span");
        if (counterSpanEl) {
            counterSpanEl.innerText = String(textareaEl.textLength);
        }
    }
};

/** Add a document click handler to hide any visible modals or confirmation popups */
const addDocumentClick = () => {
    document.addEventListener('click', (e) => {
        hideConfirmationPopup();
        hideThermometerModal();
        resetEmojiStates();
    });
    // Also hide visible modals or confirmation popups if the user presses the Escape key
    document.addEventListener('keyup', (e) => {
        if (e.key === "Escape") {
            hideConfirmationPopup();
            hideThermometerModal();
            resetEmojiStates();
        }
    });
};

/** Stop the propagation of click events for particular divs. This allows the modal to remain visible when clicking inside it. */
const addEventPropagationHandlers = () => {
    const modalContentEls = document.getElementsByClassName("c-thermometer-modal__content");
    if (modalContentEls.length > 0) {
        modalContentEls[0].addEventListener('click', e => e.stopImmediatePropagation());
    }
    const modalTriggerEls = document.getElementsByClassName("c-thermometer__trigger");
    if (modalTriggerEls.length > 0) {
        modalTriggerEls[0].addEventListener('click', e => e.stopImmediatePropagation());
    }
    const popupEls = document.getElementsByClassName("c-thermometer__popup");
    if (popupEls.length > 0) {
        popupEls[0].addEventListener('click', e => e.stopImmediatePropagation());
    }
};

// Initialize the feedback widget when the document has finished loading
document.addEventListener("DOMContentLoaded", (event) => {
    // Add a handler to the textarea which updates the character count display
    const textareaEl = document.getElementById("c-thermometer-modal__textarea");
    if (textareaEl) {
        textareaEl.addEventListener("input", updateThermometerTextareaLength);
    }
    addEventPropagationHandlers();
    addEmojiClick();
    addDocumentClick();
    addModalButtons();
});
