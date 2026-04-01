// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useFloating, offset, useClick, useDismiss, useInteractions} from '@floating-ui/react';
import type {Editor} from '@tiptap/react';
import classNames from 'classnames';
import React, {memo, useCallback, useEffect, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import {CSSTransition} from 'react-transition-group';
import styled from 'styled-components';

import {DotsHorizontalIcon} from '@mattermost/compass-icons/components';

import WithTooltip from 'components/with_tooltip';

import type {ApplyMarkdownOptions, MarkdownMode} from 'utils/markdown/apply_markdown';

import FormattingIcon, {IconContainer} from './formatting_icon';
import {LayoutModes, useFormattingBarControls} from './hooks';
import TextStyleDropdown from './text_style_dropdown';

export const Separator = styled.div`
    display: block;
    position: relative;
    width: 1px;
    height: 24px;
    background: rgba(var(--center-channel-color-rgb), 0.16);
`;

export const FormattingBarSpacer = styled.div`
    display: flex;
    height: 48px;
    transition: height 0.25s ease;
    align-items: end;
    background: var(--center-channel-bg);
`;

const FormattingBarContainer = styled.div`
    display: flex;
    height: 48px;
    padding-left: 7px;
    background: transparent;
    align-items: center;
    gap: 2px;
    transform-origin: top;
    transition: height 0.25s ease;
`;

const HiddenControlsContainer = styled.div`
    padding: 5px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    border-radius: 4px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    background: var(--center-channel-bg);
    z-index: -1;

    transition: transform 250ms ease, opacity 250ms ease;
    transform: scale(0);
    opacity: 0;
    display: flex;

    &.scale-enter {
        transform: scale(0);
        opacity: 0;
        z-index: 20;
    }

    &.scale-enter-active {
        transform: scale(1);
        opacity: 1;
        z-index: 20;
    }

    &.scale-enter-done {
        transform: scale(1);
        opacity: 1;
        z-index: 20;
    }

    &.scale-exit {
        transform: scale(1);
        opacity: 1;
        z-index: 20;
    }

    &.scale-exit-active {
        transform: scale(0);
        opacity: 0;
        z-index: 20;
    }

    &.scale-exit-done {
        transform: scale(0);
        opacity: 0;
        z-index: -1;
    }
`;

interface FormattingBarProps {

    /**
     * the current inputValue
     * This is needed to apply the markdown to the correct place
     */
    getCurrentMessage: () => string;

    /**
     * The textbox element tied to the advanced texteditor
     * NOTE: Since the only thing we need from that is the current selection
     *       range we should probably refactor this and only pass down the
     *       selectionStart and selectionEnd values
     */
    getCurrentSelection: () => {start: number; end: number};

    /**
     * the handler function that applies the markdown to the value
     */
    applyMarkdown: (options: ApplyMarkdownOptions) => void;

    /**
     * disable formatting controls when the texteditor is in preview state
     */
    disableControls: boolean;

    /**
     * location of the advanced text editor in the UI (center channel / RHS)
     */
    location: string;

    /**
     * controls that enhance the message,
     * e.g: message priority picker
     */
    additionalControls?: React.ReactNodeArray;

    /**
     * Returns the TipTap editor instance for WYSIWYG mode.
     * When provided, formatting commands are dispatched directly to the editor
     * instead of going through markdown string manipulation.
     */
    getWysiwygEditor?: () => Editor | null;
}

const DEFAULT_MIN_MODE_X_COORD = 55;

function applyWysiwygCommand(editor: Editor, mode: MarkdownMode): boolean {
    switch (mode) {
    case 'bold':
        editor.chain().focus().toggleBold().run();
        return true;
    case 'italic':
        editor.chain().focus().toggleItalic().run();
        return true;
    case 'strike':
        editor.chain().focus().toggleStrike().run();
        return true;
    case 'heading':
        editor.chain().focus().toggleHeading({level: 3}).run();
        return true;
    case 'code':
        editor.chain().focus().toggleCodeBlock().run();
        return true;
    case 'quote':
        editor.chain().focus().toggleBlockquote().run();
        return true;
    case 'ul':
        editor.chain().focus().toggleBulletList().run();
        return true;
    case 'ol':
        editor.chain().focus().toggleOrderedList().run();
        return true;
    case 'link':
        if (editor.isActive('link')) {
            editor.chain().focus().unsetLink().run();
        }
        return true;
    default:
        return false;
    }
}

const FormattingBar = (props: FormattingBarProps): JSX.Element => {
    const {
        applyMarkdown,
        getCurrentSelection,
        getCurrentMessage,
        disableControls,
        location,
        additionalControls,
        getWysiwygEditor,
    } = props;
    const [showHiddenControls, setShowHiddenControls] = useState(false);

    const additionalControlsCount = useMemo(() => {
        return Array.isArray(additionalControls) ? additionalControls.filter(Boolean).length : 0;
    }, [additionalControls]);

    const {formattingBarRef, controls, hiddenControls, layoutMode} = useFormattingBarControls(additionalControlsCount, location);

    const {formatMessage} = useIntl();
    const HiddenControlsButtonAriaLabel = formatMessage({id: 'accessibility.button.hidden_controls_button', defaultMessage: 'show hidden formatting options'});

    const {x, y, strategy, update, context, refs: {setReference, setFloating}} = useFloating<HTMLButtonElement>({
        open: showHiddenControls,
        onOpenChange: setShowHiddenControls,
        placement: 'top',
        middleware: [offset({mainAxis: 4})],
    });

    const click = useClick(context);
    const {getReferenceProps: getClickReferenceProps, getFloatingProps: getClickFloatingProps} = useInteractions([
        click,
    ]);

    const dismiss = useDismiss(context);
    const {getReferenceProps: getDismissReferenceProps, getFloatingProps: getDismissFloatingProps} = useInteractions([
        dismiss,
    ]);

    useEffect(() => {
        update?.();
    }, [layoutMode, update, showHiddenControls]);

    const hasHiddenControls = layoutMode !== LayoutModes.Wide;

    /**
     * wrapping this factory in useCallback prevents it from constantly getting a new
     * function signature as if we would define it directly in the props of
     * the FormattingIcon component. This should improve render-performance
     */
    const makeFormattingHandler = useCallback((mode: MarkdownMode) => () => {
        if (disableControls) {
            return;
        }

        const wysiwygEditor = getWysiwygEditor?.();
        if (wysiwygEditor && !wysiwygEditor.isDestroyed) {
            applyWysiwygCommand(wysiwygEditor, mode);
            if (showHiddenControls) {
                setShowHiddenControls(true);
            }
            return;
        }

        const {start, end} = getCurrentSelection();

        if (start === null || end === null) {
            return;
        }

        const value = getCurrentMessage();

        applyMarkdown({
            markdownMode: mode,
            selectionStart: start,
            selectionEnd: end,
            message: value,
        });

        if (showHiddenControls) {
            setShowHiddenControls(true);
        }
    }, [getCurrentSelection, getCurrentMessage, applyMarkdown, showHiddenControls, disableControls, getWysiwygEditor]);

    const leftPosition = layoutMode === LayoutModes.Min ? (x ?? 0) + DEFAULT_MIN_MODE_X_COORD : x ?? 0;

    const hiddenControlsContainerStyles: React.CSSProperties = {
        position: strategy,
        top: y ?? 0,
        left: leftPosition,
    };

    const showSeparators = layoutMode === LayoutModes.Wide;

    return (
        <FormattingBarContainer
            ref={formattingBarRef}
            data-testid='formattingBarContainer'
        >
            {getWysiwygEditor && (
                <>
                    <TextStyleDropdown
                        getWysiwygEditor={getWysiwygEditor}
                        disabled={disableControls}
                    />
                    {showSeparators && <Separator/>}
                </>
            )}
            {controls.map((mode) => {
                return (
                    <React.Fragment key={mode}>
                        <FormattingIcon
                            mode={mode}
                            className='control'
                            onClick={makeFormattingHandler(mode)}
                            disabled={disableControls}
                        />
                        {mode === 'heading' && showSeparators && <Separator/>}
                    </React.Fragment>
                );
            })}

            {Array.isArray(additionalControls) && additionalControls.length > 0 && (
                <>
                    {showSeparators && <Separator/>}
                    {additionalControls}
                </>
            )}

            {hasHiddenControls && (
                <>
                    <WithTooltip
                        title={formatMessage({
                            id: 'shortcuts.msgs.formatting_bar.more_formatting_options',
                            defaultMessage: 'More formatting options',
                        })}
                        disabled={showHiddenControls}
                    >
                        <IconContainer
                            id={'HiddenControlsButton' + location}
                            ref={setReference}
                            className={classNames({active: showHiddenControls})}
                            aria-label={HiddenControlsButtonAriaLabel}
                            type='button'
                            {...getClickReferenceProps()}
                            {...getDismissReferenceProps()}
                        >
                            <DotsHorizontalIcon
                                color={'currentColor'}
                                size={18}
                            />
                        </IconContainer>
                    </WithTooltip>
                </>
            )}

            <CSSTransition
                timeout={250}
                classNames='scale'
                in={showHiddenControls}
                unmountOnExit={true}
            >
                <HiddenControlsContainer
                    ref={setFloating}
                    style={hiddenControlsContainerStyles}
                    {...getClickFloatingProps()}
                    {...getDismissFloatingProps()}
                >
                    {hiddenControls.map((mode) => {
                        return (
                            <FormattingIcon
                                key={mode}
                                mode={mode}
                                className='control'
                                onClick={makeFormattingHandler(mode)}
                                disabled={disableControls}
                            />
                        );
                    })}
                </HiddenControlsContainer>
            </CSSTransition>
        </FormattingBarContainer>
    );
};

export default memo(FormattingBar);
