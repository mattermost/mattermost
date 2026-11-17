// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {flip, FloatingPortal, offset, shift, useFloating} from '@floating-ui/react';
import React, {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {defineMessage, useIntl} from 'react-intl';
import {useDispatch, useStore} from 'react-redux';

import {FormatQuoteOpenIcon} from '@mattermost/compass-icons/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {quoteTextFromPost} from 'actions/views/drafts';
import {canQuoteFromPost} from 'selectors/drafts';

import {RootHtmlPortalId} from 'utils/constants';

import type {GlobalState} from 'types/store';

import {getQuotableSelection} from './get_quotable_selection';
import type {QuotableSelection} from './get_quotable_selection';

import './quote_selection_button.scss';

const BUTTON_OFFSET = 6;
const VIEWPORT_PADDING = 8;

// Delay before showing the button for a selection made without the mouse (keyboard, screen reader)
// so that it doesn't flicker while the selection is still being extended.
const KEYBOARD_SELECTION_DELAY = 300;

function isEditable(element: Element | null) {
    return Boolean(element?.closest('input, textarea, [contenteditable="true"]'));
}

const quoteSelectionLabel = defineMessage({
    id: 'quote_selection_button.label',
    defaultMessage: 'Quote selection',
    description: 'Tooltip and accessible name of the floating button shown next to text selected in a message, which inserts the selected text as a quote into the message box.',
});

/**
 * Shows a floating button next to text selected in a post's message. Clicking it quotes the
 * selection into the message box of the channel or thread the post is shown in.
 */
const QuoteSelectionButton = () => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const store = useStore<GlobalState>();

    const [selection, setSelection] = useState<QuotableSelection | null>(null);
    const buttonRef = useRef<HTMLButtonElement | null>(null);

    // Where the focus was before tabbing to the button, so that it can be returned there.
    const returnFocusRef = useRef<HTMLElement | null>(null);
    const isShownRef = useRef(false);
    useLayoutEffect(() => {
        isShownRef.current = Boolean(selection);
    }, [selection]);

    const {refs, floatingStyles, placement} = useFloating({
        open: Boolean(selection),
        placement: selection?.isBackward ? 'top' : 'bottom',
        middleware: [
            offset(BUTTON_OFFSET),
            flip({padding: VIEWPORT_PADDING}),
            shift({padding: VIEWPORT_PADDING}),
        ],
    });

    useLayoutEffect(() => {
        if (!selection) {
            return;
        }

        const {x, y, height} = selection.focusRect;
        refs.setPositionReference({
            getBoundingClientRect: () => new DOMRect(x, y, 0, height),
        });
    }, [selection, refs]);

    // Only offer to quote when the message box the quote would go into can be used to post.
    const findQuotableSelection = useCallback(() => {
        const quotable = getQuotableSelection(window.getSelection());
        return quotable && canQuoteFromPost(store.getState(), quotable.postId, quotable.isRHS) ? quotable : null;
    }, [store]);

    const hide = useCallback(() => {
        if (buttonRef.current && buttonRef.current === document.activeElement) {
            const returnFocus = returnFocusRef.current;
            if (returnFocus?.isConnected) {
                returnFocus.focus();
            } else {
                buttonRef.current.blur();
            }
        }
        returnFocusRef.current = null;
        setSelection(null);
    }, []);

    useEffect(() => {
        let isMouseDown = false;
        let keyboardSelectionTimeout: ReturnType<typeof setTimeout> | undefined;

        const handleMouseDown = (e: MouseEvent) => {
            if (e.button === 0) {
                isMouseDown = true;
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (e.button !== 0) {
                return;
            }
            isMouseDown = false;
            if (buttonRef.current?.contains(e.target as Node)) {
                return;
            }

            // The selection isn't final until the mouseup has been handled, such as when clicking
            // inside of an existing selection to clear it.
            setTimeout(() => setSelection(findQuotableSelection()));
        };

        const handleSelectionChange = () => {
            clearTimeout(keyboardSelectionTimeout);

            // Focusing the button may clear the text selection. The quoted text is already kept.
            if (buttonRef.current && buttonRef.current === document.activeElement) {
                return;
            }

            if (window.getSelection()?.isCollapsed ?? true) {
                hide();
                return;
            }

            // Selections made with the mouse are handled on mouseup
            if (!isMouseDown) {
                keyboardSelectionTimeout = setTimeout(() => setSelection(findQuotableSelection()), KEYBOARD_SELECTION_DELAY);
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            const button = buttonRef.current;
            if (e.key === 'Escape') {
                hide();
                return;
            }

            if (e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey || !isShownRef.current || !button) {
                return;
            }

            if (document.activeElement === button) {
                // Leaving the button in either direction dismisses it and goes back to where the focus was
                e.preventDefault();
                hide();
            } else if (!e.shiftKey && !isEditable(document.activeElement)) {
                // The button is rendered at the end of the document, so move the focus to it directly
                e.preventDefault();
                returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
                button.focus();
            }
        };

        document.addEventListener('mousedown', handleMouseDown, true);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('selectionchange', handleSelectionChange);
        document.addEventListener('keydown', handleKeyDown);

        // The button is positioned once, so hide it when the selected text moves.
        document.addEventListener('scroll', hide, true);
        window.addEventListener('resize', hide);

        return () => {
            clearTimeout(keyboardSelectionTimeout);
            document.removeEventListener('mousedown', handleMouseDown, true);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('selectionchange', handleSelectionChange);
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('scroll', hide, true);
            window.removeEventListener('resize', hide);
        };
    }, [findQuotableSelection, hide]);

    const setButtonRef = useCallback((node: HTMLButtonElement | null) => {
        buttonRef.current = node;
        refs.setFloating(node);
    }, [refs]);

    // Keep the text selected while the button is being pressed.
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
    }, []);

    const handleButtonKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            hide();
        }
    }, [hide]);

    const handleClick = useCallback(() => {
        if (!selection) {
            return;
        }

        dispatch(quoteTextFromPost(selection.postId, selection.isRHS, selection.text));
        returnFocusRef.current = null;
        window.getSelection()?.removeAllRanges();
        setSelection(null);
    }, [dispatch, selection]);

    if (!selection) {
        return null;
    }

    // Focus is moved to and from the button explicitly (see handleKeyDown), so the portal doesn't
    // need to manage the tab order.
    return (
        <FloatingPortal
            id={RootHtmlPortalId}
            preserveTabOrder={false}
        >
            <WithTooltip
                title={quoteSelectionLabel}
                forcedPlacement={placement.startsWith('top') ? 'top' : 'bottom'}
            >
                <button
                    ref={setButtonRef}
                    type='button'
                    className='QuoteSelectionButton'
                    data-placement={placement}
                    style={floatingStyles}
                    aria-label={formatMessage(quoteSelectionLabel)}
                    onMouseDown={handleMouseDown}
                    onKeyDown={handleButtonKeyDown}
                    onClick={handleClick}
                >
                    <FormatQuoteOpenIcon size={16}/>
                </button>
            </WithTooltip>
        </FloatingPortal>
    );
};

export default QuoteSelectionButton;
