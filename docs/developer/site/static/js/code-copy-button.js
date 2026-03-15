'use strict';

// Display string constants
const COPY_TEXT = "Copy";
const COPIED_TEXT = "Copied!";
const COPY_FAILED_TEXT = "Copy failed";
// Icon that represents a successful copy
const iconCheck = `<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-check" width="44" height="44" viewBox="0 0 24 24" stroke-width="2" stroke="#22863a" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <title>${COPIED_TEXT}</title>
  <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
  <path d="M5 12l5 5l10 -10" />
</svg>`;
// Icon that represents the ability to copy
const iconCopy = `<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-copy" width="44" height="44" viewBox="0 0 24 24" stroke-width="1.5" stroke="#000000" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <title>${COPY_TEXT}</title>
  <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
  <rect x="8" y="8" width="12" height="12" rx="2" />
  <path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2" />
</svg>`;

/**
 * Returns a Selection containing the node to copy
 * @param node {Node} The HTMLElement to copy text from
 * @returns {Selection} The selection containing the node to copy
 */
const selectText = (node) => {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
    return selection;
};

/**
 * Change the button icon to the success icon for 2 seconds, then revert it
 * @param el {HTMLElement} The button to change
 */
const temporarilyChangeIcon = (el) => {
    el.innerHTML = iconCheck;
    setTimeout(() => {el.innerHTML = iconCopy}, 2000)
}

/**
 * Changes tooltip text for 2 seconds, then changes it back
 * @param el {HTMLElement} The element containing the tooltip
 * @param oldText {String} The text that the tooltip reverts to
 * @param newText {String} The new text to display in the tooltip for 2 seconds
 */
const temporarilyChangeTooltip = (el, oldText, newText) => {
    el.setAttribute('data-tooltip', newText)
    el.classList.add('success')
    setTimeout(() => {
        el.setAttribute('data-tooltip', oldText);
        el.classList.remove('success');
    }, 2000);
}

/**
 * Adds a "copy" button to the specified HTML element
 * @param containerEl {HTMLElement} Add copy button to this element
 */
const addCopyButton = (containerEl) => {
    // Get the element that contains the text to copy
    const codeEl = containerEl.firstElementChild;
    // Create a new "copy" button and configure its attributes
    const copyButton = document.createElement("button");
    copyButton.className = "highlight-copy-button o-tooltip--left";
    copyButton.textContent = COPY_TEXT;
    copyButton.innerHTML = iconCopy;
    copyButton.setAttribute("type", "button");
    copyButton.setAttribute("data-tooltip", COPY_TEXT);
    // Configure the button click handler
    copyButton.addEventListener("click", () => {
        try {
            if (navigator && navigator.clipboard) {
                // If the Clipboard API is present, use it.
                navigator.clipboard.writeText(codeEl.textContent)
                    .catch((e) => {
                        console && console.error(e);
                    })
                    .finally(() => {
                        temporarilyChangeTooltip(copyButton, COPY_TEXT, COPIED_TEXT);
                        temporarilyChangeIcon(copyButton);
                    });
            } else if (document.queryCommandSupported("copy")) {
                // If there is no Clipboard API but the deprecated API is present, use it instead.
                const selection = selectText(codeEl);
                document.execCommand("copy");
                selection.removeAllRanges();
                temporarilyChangeTooltip(copyButton, COPY_TEXT, COPIED_TEXT);
                temporarilyChangeIcon(copyButton);
            } else {
                console && console.error("no suitable clipboard API could be found; cannot copy code block");
            }
        } catch(e) {
            console && console.error(e);
            temporarilyChangeTooltip(copyButton, COPY_TEXT, COPY_FAILED_TEXT);
        }
    });
    // Add the button to the HTML element
    containerEl.appendChild(copyButton);
};

// Add copy button to all code blocks
Array.from(document.getElementsByClassName("highlight")).forEach((el) => addCopyButton(el));
