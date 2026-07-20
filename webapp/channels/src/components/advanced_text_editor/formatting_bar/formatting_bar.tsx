// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useFloating, offset, useClick, useDismiss, useInteractions} from '@floating-ui/react';
import type {Editor} from '@tiptap/react';
import classNames from 'classnames';
import React, {forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import {CSSTransition} from 'react-transition-group';
import styled from 'styled-components';

import {DotsHorizontalIcon} from '@mattermost/compass-icons/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import type {MarkdownMode} from 'utils/markdown/apply_markdown';

import FormattingIcon, {IconContainer} from './formatting_icon';
import {LayoutModes, useFormattingBarControls} from './hooks';
import LinkPopover from './link_popover';
import TextStyleDropdown from './text_style_dropdown';

export const Separator = styled.div.attrs({'data-testid': 'formatting-bar-separator'})`
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
    overflow: hidden;
    flex-wrap: nowrap;
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

export interface FormattingBarHandle {
    openLinkPopover: () => void;
}

interface FormattingBarProps {

    /**
     * Apply a formatting toggle for the given markdown mode. The parent decides
     * whether this targets the legacy markdown textbox or the WYSIWYG editor.
     */
    applyFormatting: (mode: MarkdownMode) => void;

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
     * AI actions menu rendered at the far left of the formatting bar
     */
    aiActionsMenu?: React.ReactNode;

    /**
     * When in WYSIWYG mode, the parent passes a getter for the live TipTap
     * editor. The bar uses it for active-state subscriptions, the heading
     * dropdown, and the link popover. Formatting commands themselves go
     * through `applyFormatting` regardless of editor type.
     */
    getEditor?: () => Editor | null;
}

const DEFAULT_MIN_MODE_X_COORD = 55;

const WYSIWYG_NODE_FOR_MODE: Partial<Record<MarkdownMode, string>> = {
    bold: 'bold',
    italic: 'italic',
    strike: 'strike',
    code: 'codeBlock',
    quote: 'blockquote',
    heading: 'heading',
    ul: 'bulletList',
    ol: 'orderedList',
    link: 'link',
};

function computeActiveModes(editor: Editor | null, modes: MarkdownMode[]): Partial<Record<MarkdownMode, boolean>> {
    const result: Partial<Record<MarkdownMode, boolean>> = {};
    if (!editor) {
        return result;
    }
    for (const mode of modes) {
        const node = WYSIWYG_NODE_FOR_MODE[mode];
        if (node) {
            result[mode] = editor.isActive(node);
        }
    }
    return result;
}

const ALL_FORMATTING_MODES: MarkdownMode[] = ['bold', 'italic', 'strike', 'heading', 'link', 'code', 'quote', 'ul', 'ol'];

const FormattingBar = forwardRef<FormattingBarHandle, FormattingBarProps>((props, ref) => {
    const {
        applyFormatting,
        disableControls,
        location,
        additionalControls,
        aiActionsMenu,
        getEditor,
    } = props;
    const [showHiddenControls, setShowHiddenControls] = useState(false);
    const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);

    const additionalControlsCount = useMemo(() => {
        return Array.isArray(additionalControls) ? additionalControls.filter(Boolean).length : 0;
    }, [additionalControls]);

    const {formattingBarRef, controls, hiddenControls, layoutMode, showTextStyleDropdown} = useFormattingBarControls(additionalControlsCount, location, Boolean(getEditor));

    const editorInstance = getEditor?.() ?? null;
    const [activeModes, setActiveModes] = useState<Partial<Record<MarkdownMode, boolean>>>(() =>
        computeActiveModes(editorInstance, ALL_FORMATTING_MODES),
    );

    useEffect(() => {
        const editor = getEditor?.();
        if (!editor || editor.isDestroyed) {
            setActiveModes({});
            return undefined;
        }

        const recompute = () => {
            const next = computeActiveModes(editor, ALL_FORMATTING_MODES);
            setActiveModes((prev) => {
                for (const mode of ALL_FORMATTING_MODES) {
                    if (prev[mode] !== next[mode]) {
                        return next;
                    }
                }
                return prev;
            });
        };

        recompute();
        editor.on('selectionUpdate', recompute);
        editor.on('transaction', recompute);

        return () => {
            editor.off('selectionUpdate', recompute);
            editor.off('transaction', recompute);
        };
    }, [getEditor]);

    useImperativeHandle(ref, () => ({
        openLinkPopover: () => {
            if (getEditor?.()) {
                setLinkPopoverOpen(true);
            }
        },
    }), [getEditor]);

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

        if (mode === 'link' && getEditor?.()) {
            setLinkPopoverOpen(true);
            return;
        }

        applyFormatting(mode);

        if (showHiddenControls) {
            setShowHiddenControls(true);
        }
    }, [applyFormatting, disableControls, getEditor, showHiddenControls]);

    const leftPosition = layoutMode === LayoutModes.Min ? (x ?? 0) + DEFAULT_MIN_MODE_X_COORD : x ?? 0;

    const hiddenControlsContainerStyles: React.CSSProperties = {
        position: strategy,
        top: y ?? 0,
        left: leftPosition,
    };

    const showSeparators = layoutMode === LayoutModes.Wide;

    const renderFormattingIcon = (mode: MarkdownMode, key?: React.Key) => {
        const isActive = getEditor ? activeModes[mode] : undefined;
        return (
            <FormattingIcon
                key={key ?? mode}
                mode={mode}
                className='control'
                onClick={makeFormattingHandler(mode)}
                disabled={disableControls}
                isActive={isActive}
            />
        );
    };

    return (
        <FormattingBarContainer
            ref={formattingBarRef}
            data-testid='formattingBarContainer'
        >
            {aiActionsMenu}
            {aiActionsMenu && showSeparators && <Separator/>}
            {getEditor && showTextStyleDropdown && (
                <>
                    <TextStyleDropdown
                        getWysiwygEditor={getEditor}
                        disabled={disableControls}
                    />
                    {showSeparators && <Separator/>}
                </>
            )}
            {controls.map((mode) => (
                <React.Fragment key={mode}>
                    {renderFormattingIcon(mode)}
                    {mode === 'heading' && showSeparators && <Separator/>}
                </React.Fragment>
            ))}

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
                    {hiddenControls.map((mode) => renderFormattingIcon(mode))}
                </HiddenControlsContainer>
            </CSSTransition>

            {linkPopoverOpen && editorInstance && !editorInstance.isDestroyed && (
                <LinkPopover
                    editor={editorInstance}
                    onClose={() => setLinkPopoverOpen(false)}
                />
            )}
        </FormattingBarContainer>
    );
});

FormattingBar.displayName = 'FormattingBar';

export default memo(FormattingBar);
