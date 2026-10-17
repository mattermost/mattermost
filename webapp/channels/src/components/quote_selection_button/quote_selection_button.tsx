// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {flip, FloatingPortal, offset, shift, useFloating} from '@floating-ui/react';
import React, {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {defineMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {FormatQuoteOpenIcon} from '@mattermost/compass-icons/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {quoteTextFromPost} from 'actions/views/drafts';

import {RootHtmlPortalId} from 'utils/constants';

import {getQuotableSelection} from './get_quotable_selection';
import type {QuotableSelection} from './get_quotable_selection';

import './quote_selection_button.scss';

const BUTTON_OFFSET = 6;
const VIEWPORT_PADDING = 8;

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

    const [selection, setSelection] = useState<QuotableSelection | null>(null);
    const buttonRef = useRef<HTMLButtonElement | null>(null);

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

    useEffect(() => {
        const hide = () => setSelection(null);

        const handleMouseUp = (e: MouseEvent) => {
            if (e.button !== 0 || buttonRef.current?.contains(e.target as Node)) {
                return;
            }

            // The selection isn't final until the mouseup has been handled, such as when clicking
            // inside of an existing selection to clear it.
            setTimeout(() => setSelection(getQuotableSelection(window.getSelection())));
        };

        const handleSelectionChange = () => {
            if (window.getSelection()?.isCollapsed ?? true) {
                hide();
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                hide();
            }
        };

        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('selectionchange', handleSelectionChange);
        document.addEventListener('keydown', handleKeyDown);

        // The button is positioned once, so hide it when the selected text moves.
        document.addEventListener('scroll', hide, true);
        window.addEventListener('resize', hide);

        return () => {
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('selectionchange', handleSelectionChange);
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('scroll', hide, true);
            window.removeEventListener('resize', hide);
        };
    }, []);

    const setButtonRef = useCallback((node: HTMLButtonElement | null) => {
        buttonRef.current = node;
        refs.setFloating(node);
    }, [refs]);

    // Keep the text selected while the button is being pressed.
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
    }, []);

    const handleClick = useCallback(() => {
        if (!selection) {
            return;
        }

        dispatch(quoteTextFromPost(selection.postId, selection.isRHS, selection.text));
        window.getSelection()?.removeAllRanges();
        setSelection(null);
    }, [dispatch, selection]);

    if (!selection) {
        return null;
    }

    return (
        <FloatingPortal id={RootHtmlPortalId}>
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
                    onClick={handleClick}
                >
                    <FormatQuoteOpenIcon size={16}/>
                </button>
            </WithTooltip>
        </FloatingPortal>
    );
};

export default QuoteSelectionButton;
