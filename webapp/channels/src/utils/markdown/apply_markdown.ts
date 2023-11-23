// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type MarkdownMode = 'bold' | 'italic' | 'link' | 'strike' | 'code' | 'heading' | 'quote' | 'ul' | 'ol'

export type ApplyMarkdownOptions = {
    markdownMode: MarkdownMode;
    selectionStart: number | null;
    selectionEnd: number | null;
    message: string;
}

type ApplyMarkdownReturnValue = {
    selectionStart: number;
    selectionEnd: number;
    message: string;
}

type ApplySpecificMarkdownOptions = ApplyMarkdownReturnValue & {
    delimiter?: string;
    delimiterStart?: string;
    delimiterEnd?: string;
}

export type ApplyLinkMarkdownOptions = ApplySpecificMarkdownOptions & {
    url?: string;

}

export function applyMarkdown(options: ApplyMarkdownOptions): ApplyMarkdownReturnValue {
    const {selectionEnd, selectionStart, message, markdownMode} = options;

    if (selectionStart === null || selectionEnd === null) {
        /**
         * in case we do not get the selectionStart or selectionEnd values
         * from the textbox we simply set it to be at the end of the message
         * string and return the message without changing it.
         *
         * This should never happen, so this just serves as an insurance fallback for very strange browser-bugs!
         */
        return {
            message,
            selectionStart: message.length,
            selectionEnd: message.length,
        };
    }

    let delimiter: string;

    /**
     * all options that need to be handled in a ver specific way have their own applyMarkdown (sub-)functions.
     * The rest just define their delimiters and return the basic applyMarkdownToSelection function.
     *
     * In a strange case where nothing works we throw an error.
     */
    switch (markdownMode) {
    case 'bold':
        return applyBoldMarkdown({selectionEnd, selectionStart, message});
    case 'italic':
        return applyItalicMarkdown({selectionEnd, selectionStart, message});
    case 'link':
        return applyLinkMarkdown({selectionEnd, selectionStart, message});
    case 'ol':
        return applyOlMarkdown({selectionEnd, selectionStart, message});
    case 'ul':
        delimiter = '- ';
        return applyMarkdownToSelectedLines({selectionEnd, selectionStart, message, delimiter});
    case 'heading':
        delimiter = '### ';
        return applyMarkdownToSelectedLines({selectionEnd, selectionStart, message, delimiter});
    case 'quote':
        delimiter = '> ';
        return applyMarkdownToSelectedLines({selectionEnd, selectionStart, message, delimiter});
    case 'strike':
        delimiter = '~~';
        return applyMarkdownToSelection({selectionEnd, selectionStart, message, delimiter});
    case 'code':
        return applyCodeMarkdown({selectionEnd, selectionStart, message});
    }

    throw Error('Unsupported markdown mode: ' + markdownMode);
}

const getMultilineSuffix = (suffix: string): string => {
    if (suffix.startsWith('\n')) {
        return '';
    }

    return suffix.indexOf('\n') === -1 ? suffix : suffix.slice(0, suffix.indexOf('\n'));
};

const getNewSuffix = (suffix: string): string => {
    if (suffix.startsWith('\n')) {
        return suffix;
    }

    return suffix.indexOf('\n') === -1 ? '' : suffix.slice(suffix.indexOf('\n'));
};

const applyOlMarkdown = ({selectionEnd, selectionStart, message}: ApplySpecificMarkdownOptions) => {
    const prefix = message.slice(0, selectionStart);
    const selection = message.slice(selectionStart, selectionEnd);
    const suffix = message.slice(selectionEnd);

    const newPrefix = prefix.includes('\n') ? prefix.slice(0, prefix.lastIndexOf('\n')) : '';

    const multilineSuffix = getMultilineSuffix(suffix);
    const newSuffix = getNewSuffix(suffix);

    const delimiterLength = 3;
    const getDelimiter = (num?: number) => {
        getDelimiter.counter = num || getDelimiter.counter;
        return `${getDelimiter.counter++}. `;
    };
    getDelimiter.counter = 1;

    const multilinePrefix = prefix.includes('\n') ? prefix.slice(prefix.lastIndexOf('\n')) : prefix;
    let multilineSelection = multilinePrefix + selection + multilineSuffix;
    const isFirstLineSelected = !multilineSelection.startsWith('\n');

    if (selection.startsWith('\n')) {
        multilineSelection = prefix + selection + multilineSuffix;
    }

    const getHasCurrentMarkdown = (): boolean => {
        const linesQuantity = (multilineSelection.match(/\n/g) || []).length;
        const newLinesWithDelimitersQuantity = (multilineSelection.match(/\n\d\. /g) || []).length;

        if (newLinesWithDelimitersQuantity === linesQuantity && !isFirstLineSelected) {
            return true;
        }

        return linesQuantity === newLinesWithDelimitersQuantity && (/^\d\. /).test(multilineSelection);
    };

    let newValue: string;
    let newStart: number;
    let newEnd: number;

    if (getHasCurrentMarkdown()) {
        // clear first line from delimiter
        if (isFirstLineSelected) {
            multilineSelection = multilineSelection.slice(delimiterLength);
        }

        newValue = newPrefix + multilineSelection.replace(/\n\d\. /g, '\n') + newSuffix;
        let count = 0;

        if (isFirstLineSelected) {
            count++;
        }
        count += (multilineSelection.match(/\n/g) || []).length;

        newStart = Math.max(selectionStart - delimiterLength, 0);
        newEnd = Math.max(selectionEnd - (delimiterLength * count), 0);
    } else {
        let count = 0;
        if (isFirstLineSelected) {
            multilineSelection = getDelimiter() + multilineSelection;
            count++;
        }
        const selectionArr = Array.from(multilineSelection);
        for (let i = 0; i < selectionArr.length; i++) {
            if (selectionArr[i] === '\n') {
                selectionArr[i] = `\n${getDelimiter()}`;
            }
        }
        multilineSelection = selectionArr.join('');
        newValue = newPrefix + multilineSelection + newSuffix;

        count += (multilineSelection.match(new RegExp('\\n', 'g')) || []).length;

        newStart = selectionStart + delimiterLength;
        newEnd = selectionEnd + (delimiterLength * count);
    }

    return {
        message: newValue,
        selectionStart: newStart,
        selectionEnd: newEnd,
    };
};

export const applyMarkdownToSelectedLines = ({
    selectionEnd,
    selectionStart,
    message,
    delimiter,
}: ApplySpecificMarkdownOptions) => {
    if (!delimiter) {
        /**
         * in case no delimiter is set return the values without changing anything
         */
        return {
            message,
            selectionStart,
            selectionEnd,
        };
    }

    const prefix = message.slice(0, selectionStart);
    const selection = message.slice(selectionStart, selectionEnd);
    const suffix = message.slice(selectionEnd);

    const newPrefix = prefix.includes('\n') ? prefix.slice(0, prefix.lastIndexOf('\n')) : '';
    const multilinePrefix = prefix.includes('\n') ? prefix.slice(prefix.lastIndexOf('\n')) : prefix;

    const multilineSuffix = getMultilineSuffix(suffix);
    const newSuffix = getNewSuffix(suffix);
    let multilineSelection: string = multilinePrefix + selection + multilineSuffix;

    const isFirstLineSelected = !multilineSelection.startsWith('\n');

    if (selection.startsWith('\n')) {
        multilineSelection = prefix + selection + multilineSuffix;
    }

    const getHasCurrentMarkdown = (): boolean => {
        const linesQuantity = (multilineSelection.match(/\n/g) || []).length;
        const newLinesWithDelimitersQuantity = (multilineSelection.match(new RegExp(`\n${delimiter}`, 'g')) || []).
            length;

        if (newLinesWithDelimitersQuantity === linesQuantity && !isFirstLineSelected) {
            return true;
        }

        return linesQuantity === newLinesWithDelimitersQuantity && multilineSelection.startsWith(delimiter);
    };

    let newValue: string;
    let newStart: number;
    let newEnd: number;

    if (getHasCurrentMarkdown()) {
        // clear first line from delimiter
        if (isFirstLineSelected) {
            multilineSelection = multilineSelection.slice(delimiter.length);
        }

        newValue = newPrefix + multilineSelection.replace(new RegExp(`\n${delimiter}`, 'g'), '\n') + newSuffix;
        let count = 0;
        if (isFirstLineSelected) {
            count++;
        }
        count += (multilineSelection.match(/\n/g) || []).length;

        newStart = Math.max(selectionStart - delimiter.length, 0);
        newEnd = Math.max(selectionEnd - (delimiter.length * count), 0);
    } else {
        newValue = newPrefix + multilineSelection.replace(/\n/g, `\n${delimiter}`) + newSuffix;
        let count = 0;
        if (isFirstLineSelected) {
            newValue = delimiter + newValue;
            count++;
        }

        count += (multilineSelection.match(new RegExp('\\n', 'g')) || []).length;

        newStart = selectionStart + delimiter.length;
        newEnd = selectionEnd + (delimiter.length * count);
    }

    return {
        message: newValue,
        selectionStart: newStart,
        selectionEnd: newEnd,
    };
};

const applyMarkdownToSelection = ({
    selectionEnd,
    selectionStart,
    message,
    delimiter,
    delimiterStart,
    delimiterEnd,
}: ApplySpecificMarkdownOptions) => {
    const openingDelimiter = delimiterStart ?? delimiter;
    const closingDelimiter = delimiterEnd ?? delimiter;
    if (!openingDelimiter || !closingDelimiter) {
        /**
         * in case no delimiter is set return the values without changing anything
         */
        return {
            message,
            selectionStart,
            selectionEnd,
        };
    }

    // the part of the message that comes before the selection
    let prefix = message.slice(0, selectionStart);

    // the selected part of the message where the markdown needs to be added/removed
    let selection = message.slice(selectionStart, selectionEnd);

    // the part of the message that comes after the selection
    let suffix = message.slice(selectionEnd);

    // Does the selection have current hotkey's markdown?
    const hasCurrentMarkdown = prefix.endsWith(openingDelimiter) && suffix.startsWith(closingDelimiter);

    let newValue: string;
    let newStart = selectionStart;
    let newEnd = selectionEnd;

    if (selection.endsWith(' ')) {
        selection = selection.slice(0, -1);
        suffix = ` ${suffix}`;
        newEnd -= 1;
    }

    if (selection.startsWith(' ')) {
        selection = selection.slice(1);
        prefix = `${prefix} `;
        newStart += 1;
    }

    if (hasCurrentMarkdown) {
        // selection already has the markdown, so we remove it here
        newValue = prefix.slice(0, prefix.length - openingDelimiter.length) + selection + suffix.slice(closingDelimiter.length);
        newStart -= openingDelimiter.length;
        newEnd -= closingDelimiter.length;
    } else {
        // add markdown to the selection
        newValue = prefix + openingDelimiter + selection + closingDelimiter + suffix;
        newStart += openingDelimiter.length;
        newEnd += closingDelimiter.length;
    }

    return {
        message: newValue,
        selectionStart: newStart,
        selectionEnd: newEnd,
    };
};

function applyBoldMarkdown(options: ApplySpecificMarkdownOptions) {
    return applyBoldItalicMarkdown({...options, markdownMode: 'bold'});
}

function applyItalicMarkdown(options: ApplySpecificMarkdownOptions) {
    return applyBoldItalicMarkdown({...options, markdownMode: 'italic'});
}

function applyBoldItalicMarkdown({selectionEnd, selectionStart, message, markdownMode}: ApplySpecificMarkdownOptions & Pick<ApplyMarkdownOptions, 'markdownMode'>) {
    const BOLD_MD = '**';
    const ITALIC_MD = '*';

    const isForceItalic = markdownMode === 'italic';
    const isForceBold = markdownMode === 'bold';

    let prefix = message.slice(0, selectionStart);
    let selection = message.slice(selectionStart, selectionEnd);
    let suffix = message.slice(selectionEnd);

    let newValue: string;
    let newStart = selectionStart;
    let newEnd = selectionEnd;

    if (selection.endsWith(' ')) {
        selection = selection.slice(0, -1);
        suffix = ` ${suffix}`;
        newEnd -= 1;
    }

    if (selection.startsWith(' ')) {
        selection = selection.slice(1);
        prefix = `${prefix} `;
        newStart += 1;
    }

    // Is it italic hot key on existing bold markdown? i.e. italic on **haha**
    let isItalicFollowedByBold = false;
    let delimiter = '';

    if (isForceBold) {
        delimiter = BOLD_MD;
    } else if (isForceItalic) {
        delimiter = ITALIC_MD;
        isItalicFollowedByBold = prefix.endsWith(BOLD_MD) && suffix.startsWith(BOLD_MD);
    }

    // Does the selection have current hotkey's markdown?
    const hasCurrentMarkdown = prefix.endsWith(delimiter) && suffix.startsWith(delimiter);

    // Does current selection have both of the markdown around it? i.e. ***haha***
    const hasItalicAndBold = prefix.endsWith(BOLD_MD + ITALIC_MD) && suffix.startsWith(BOLD_MD + ITALIC_MD);

    if (hasItalicAndBold || (hasCurrentMarkdown && !isItalicFollowedByBold)) {
        // message already has the markdown; remove it
        newValue = prefix.slice(0, prefix.length - delimiter.length) + selection + suffix.slice(delimiter.length);
        newStart -= delimiter.length;
        newEnd -= delimiter.length;
    } else {
        // Add italic or bold markdown
        newValue = prefix + delimiter + selection + delimiter + suffix;
        newStart += delimiter.length;
        newEnd += delimiter.length;
    }

    return {
        message: newValue,
        selectionStart: newStart,
        selectionEnd: newEnd,
    };
}

export const DEFAULT_PLACEHOLDER_URL = 'url';

export function applyLinkMarkdown({selectionEnd, selectionStart, message, url = DEFAULT_PLACEHOLDER_URL}: ApplyLinkMarkdownOptions) {
    // <prefix> <selection> <suffix>
    const prefix = message.slice(0, selectionStart);
    const selection = message.slice(selectionStart, selectionEnd);
    const suffix = message.slice(selectionEnd);

    const delimiterStart = '[';
    const delimiterEnd = `](${url})`;

    // Does the selection have link markdown?
    const hasMarkdown = prefix.endsWith(delimiterStart) && suffix.startsWith(delimiterEnd);

    let newValue: string;
    let newStart: number;
    let newEnd: number;

    // When url is to be selected in [...](url), selection cursors need to shift by this much.
    const urlShift = delimiterStart.length + 2; // ']'.length + ']('.length
    if (hasMarkdown) {
        // message already has the markdown; remove it
        newValue =
            prefix.slice(0, prefix.length - delimiterStart.length) +
            selection +
            suffix.slice(delimiterEnd.length);
        newStart = selectionStart - delimiterStart.length;
        newEnd = selectionEnd - delimiterStart.length;
    } else if (message.length === 0) {
        // no input; Add [|](url)
        newValue = delimiterStart + delimiterEnd;
        newStart = delimiterStart.length;
        newEnd = delimiterStart.length;
    } else if (selectionStart < selectionEnd) {
        // there is something selected; put markdown around it and preserve selection
        newValue = prefix + delimiterStart + selection + delimiterEnd + suffix;
        newStart = selectionEnd + urlShift;
        newEnd = newStart + url.length;
    } else {
        // nothing is selected
        const spaceBefore = prefix.charAt(prefix.length - 1) === ' ';
        const spaceAfter = suffix.charAt(0) === ' ';
        const cursorBeforeWord =
            (selectionStart !== 0 && spaceBefore && !spaceAfter) || (selectionStart === 0 && !spaceAfter);
        const cursorAfterWord =
            (selectionEnd !== message.length && spaceAfter && !spaceBefore) ||
            (selectionEnd === message.length && !spaceBefore);

        if (cursorBeforeWord) {
            // cursor before a word
            const word = message.slice(selectionStart, findWordEnd(message, selectionStart));

            newValue = prefix + delimiterStart + word + delimiterEnd + suffix.slice(word.length);
            newStart = selectionStart + word.length + urlShift;
            newEnd = newStart + urlShift;
        } else if (cursorAfterWord) {
            // cursor after a word
            const cursorAtEndOfLine = selectionStart === selectionEnd && selectionEnd === message.length;
            if (cursorAtEndOfLine) {
                // cursor at end of line
                newValue = message + ' ' + delimiterStart + delimiterEnd;
                newStart = selectionEnd + 1 + delimiterStart.length;
                newEnd = newStart;
            } else {
                // cursor not at end of line
                const word = message.slice(findWordStart(message, selectionStart), selectionStart);

                newValue =
                    prefix.slice(0, prefix.length - word.length) + delimiterStart + word + delimiterEnd + suffix;
                newStart = selectionStart + urlShift;
                newEnd = newStart + urlShift;
            }
        } else {
            // cursor is in between a word
            const wordStart = findWordStart(message, selectionStart);
            const wordEnd = findWordEnd(message, selectionStart);
            const word = message.slice(wordStart, wordEnd);

            newValue = prefix.slice(0, wordStart) + delimiterStart + word + delimiterEnd + message.slice(wordEnd);
            newStart = wordEnd + urlShift;
            newEnd = newStart + urlShift;
        }
    }

    return {
        message: newValue,
        selectionStart: newStart,
        selectionEnd: newEnd,
    };
}

function applyCodeMarkdown({selectionEnd, selectionStart, message}: ApplySpecificMarkdownOptions) {
    if (isSelectionMultiline(message, selectionStart, selectionEnd)) {
        return applyMarkdownToSelection({selectionEnd, selectionStart, message, delimiterStart: '```\n', delimiterEnd: '\n```'});
    }
    return applyMarkdownToSelection({selectionEnd, selectionStart, message, delimiter: '`'});
}

function findWordEnd(text: string, start: number) {
    const wordEnd = text.indexOf(' ', start);
    return wordEnd === -1 ? text.length : wordEnd;
}

function findWordStart(text: string, start: number) {
    const wordStart = text.lastIndexOf(' ', start - 1) + 1;
    return wordStart === -1 ? 0 : wordStart;
}

function isSelectionMultiline(message: string, selectionStart: number, selectionEnd: number) {
    return message.slice(selectionStart, selectionEnd).includes('\n');
}
