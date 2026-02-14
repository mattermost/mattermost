// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useFloating, offset, useClick, useDismiss, useInteractions} from '@floating-ui/react';
import classNames from 'classnames';
import React, {memo, useCallback, useEffect, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {CSSTransition} from 'react-transition-group';
import styled from 'styled-components';

import {DotsHorizontalIcon} from '@mattermost/compass-icons/components';

import WithTooltip from 'components/with_tooltip';

import type {ApplyMarkdownOptions, MarkdownMode} from 'utils/markdown/apply_markdown';

import FormattingIcon, {IconContainer} from './formatting_icon';
import {useFormattingBarControls} from './hooks';
import Link from './link';

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
}

const DEFAULT_MIN_MODE_X_COORD = 55;

const FormattingBar = (props: FormattingBarProps): JSX.Element => {
    const {
        applyMarkdown,
        getCurrentSelection,
        getCurrentMessage,
        disableControls,
        location,
        additionalControls,
    } = props;
    const [showHiddenControls, setShowHiddenControls] = useState(false);
    const formattingBarRef = useRef<HTMLDivElement>(null);
    const {controls, hiddenControls, wideMode} = useFormattingBarControls(formattingBarRef);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [selection, setSelection] = useState<{start?: number; end?: number; text: string}>({text: ''});

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
    }, [wideMode, update, showHiddenControls]);

    const hasHiddenControls = wideMode !== 'wide';

    /**
     * wrapping this factory in useCallback prevents it from constantly getting a new
     * function signature as if we would define it directly in the props of
     * the FormattingIcon component. This should improve render-performance
     */
    const makeFormattingHandler = useCallback((mode: MarkdownMode) => () => {
        // if the formatting is disabled just return without doing anything
        if (disableControls) {
            return;
        }

        // get the current selection values and return early (doing nothing) when we don't get valid values
        const {start, end} = getCurrentSelection();

        if (start === null || start === undefined || end === null || end === undefined) {
            return;
        }

        const value = getCurrentMessage();

        applyMarkdown({
            markdownMode: mode,
            selectionStart: start,
            selectionEnd: end,
            message: value,
        });

        // if hidden controls are currently open close them
        if (showHiddenControls) {
            setShowHiddenControls(true);
        }
    }, [getCurrentSelection, getCurrentMessage, applyMarkdown, showHiddenControls, disableControls]);

    const leftPosition = wideMode === 'min' ? (x ?? 0) + DEFAULT_MIN_MODE_X_COORD : x ?? 0;

    const hiddenControlsContainerStyles: React.CSSProperties = {
        position: strategy,
        top: y ?? 0,
        left: leftPosition,
    };

    const showSeparators = wideMode === 'wide';

    const handleLinkModalToggle = (isOpen: boolean) => {
        if (isOpen) {
            const {start, end} = getCurrentSelection();
            const message = getCurrentMessage();
            const text = (start !== undefined && end !== undefined) ? message.substring(start, end) : '';

            setSelection({start, end, text});
        }
        setIsLinkModalOpen(isOpen);
    };

    const handleLinkApply = ({text, link}: {text: string; link: string}) => {
        const {start, end} = selection;

        if (start === undefined || end === undefined) {
            return;
        }

        applyMarkdown({
            markdownMode: 'link',
            selectionStart: start,
            selectionEnd: end,
            message: getCurrentMessage(),
            url: link,
            text,
        });
    };

    return (
        <FormattingBarContainer
            ref={formattingBarRef}
            data-testid='formattingBarContainer'
        >
            {controls.map((mode) => {
                return (
                    <React.Fragment key={mode}>
                        <FormattingIcon
                            mode={mode}
                            className='control'
                            onClick={makeFormattingHandler(mode)}
                            disabled={disableControls}
                        />
                        {mode === 'heading' && (
                            <>
                                {showSeparators && <Separator/>}
                                <Link
                                    onToggle={handleLinkModalToggle}
                                    isMenuOpen={isLinkModalOpen}
                                    selectionText={selection.text}
                                    onApply={handleLinkApply}
                                />
                            </>
                        )}
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
