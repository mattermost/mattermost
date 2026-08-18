// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {useIntl} from 'react-intl';

import {CloseCircleIcon} from '@mattermost/compass-icons/components';

import type {ResolvedChannelAttribute} from 'mattermost-redux/selectors/entities/properties';
import {getPropertyFieldLabel} from 'mattermost-redux/utils/property_utils';

import type {BannerSegment} from './banner_template';
import {attributeToken, parseBannerTemplate} from './banner_template';
import BannerTokenControls from './banner_token_controls';

import './banner_text_editor.scss';

const TOKEN_ATTRIBUTE = 'data-token';

// Caret position as an offset into the editor's visible text, chips counting as their
// label. Node-based positions do not survive the rebuild that follows an insertion.
function readCaretOffset(editor: HTMLElement): number | null {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return null;
    }

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.startContainer)) {
        return null;
    }

    const measured = range.cloneRange();
    measured.selectNodeContents(editor);
    measured.setEnd(range.startContainer, range.startOffset);

    return measured.toString().length;
}

function restoreCaretOffset(editor: HTMLElement, offset: number) {
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);

    let remaining = offset;
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const length = node.nodeValue?.length ?? 0;

        // A chip's label is inside it but is not editable, so the caret lands after it.
        const chip = node.parentElement?.closest(`[${TOKEN_ATTRIBUTE}]`);
        if (chip) {
            if (remaining <= length) {
                range.setStartAfter(chip);
                range.collapse(true);
                break;
            }
            remaining -= length;
            continue;
        }

        if (remaining <= length) {
            range.setStart(node, remaining);
            range.collapse(true);
            break;
        }
        remaining -= length;
    }

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
}

// Visible length of a segment: a chip reads as its label, which is what the caret
// offsets returned by readCaretOffset are measured in.
function visibleLength(segment: BannerSegment, labels: Map<string, string>): number {
    if (segment.type === 'text') {
        return segment.text.length;
    }
    return (labels.get(segment.name) ?? segment.name).length;
}

// Converts a caret offset in visible text into an offset into the template string.
// A caret inside a chip's label snaps to just after that chip, matching where
// restoreCaretOffset puts it.
function templateOffsetFor(segments: BannerSegment[], labels: Map<string, string>, visibleOffset: number): number {
    let visible = 0;
    let template = 0;

    for (const segment of segments) {
        const length = visibleLength(segment, labels);

        if (visibleOffset <= visible + length) {
            if (segment.type === 'text') {
                return template + (visibleOffset - visible);
            }
            return visibleOffset === visible ? template : template + attributeToken(segment.name).length;
        }

        visible += length;
        template += segment.type === 'text' ? segment.text.length : attributeToken(segment.name).length;
    }

    return template;
}

type Props = {

    // The banner text as authored, tokens included.
    value: string;

    // Every channel attribute with this channel's value, unset ones included.
    attributes: ResolvedChannelAttribute[];

    onChange: (next: string) => void;

    disabled?: boolean;
    maxLength?: number;
    hasError?: boolean;
};

/**
 * Banner text as chips and literal text in one editable line.
 *
 * A token is a chip labelled with the attribute's display name, so an author reads
 * "Classification" rather than "{{classification}}" while the stored template stays
 * keyed on the machine name. contentEditable is the only way to interleave atomic
 * chips with free text in a single caret flow; everything below exists to keep that
 * DOM and the template string in agreement.
 */
const BannerTextEditor = ({value, attributes, onChange, disabled, maxLength, hasError}: Props) => {
    const {formatMessage} = useIntl();
    const editorRef = useRef<HTMLDivElement>(null);

    // Where the caret last was, as an offset into the visible text. An integer, not
    // a Range: a Range points at nodes, and every insert remounts the editor, so a
    // saved one is stale by the time the menu closes and the insert runs.
    const caretRef = useRef<number | null>(null);

    // What this component last emitted, so its own echo is not mistaken for an
    // external edit.
    const emittedRef = useRef(value);

    // The DOM is rendered from this snapshot, never from `value` directly. While the
    // user types, the browser owns the editor's children; re-rendering them from a
    // changed prop would make React patch the text node it is sitting in, which
    // collapses the caret to the start of the line. The snapshot therefore only moves
    // when the value changes from outside — and then the key remounts the editor,
    // so React never has to reconcile text it did not write.
    const [snapshot, setSnapshot] = useState(() => ({segments: parseBannerTemplate(value), key: 0}));

    // A rebuild remounts the editor, which drops focus. Left alone, the caret lands on
    // document.body and the app's type-anywhere handler starts feeding keystrokes to the
    // message box instead. Both are captured before the rebuild and reinstated after it.
    const restoreRef = useRef<{focused: boolean; caret: number | null}>({focused: false, caret: null});

    const labels = useMemo(() => {
        const byName = new Map<string, string>();
        for (const attribute of attributes) {
            byName.set(attribute.field.name, getPropertyFieldLabel(attribute.field));
        }
        return byName;
    }, [attributes]);

    const {segments} = snapshot;

    const rebuild = useCallback((template: string, restore?: {focused: boolean; caret: number | null}) => {
        const editor = editorRef.current;
        restoreRef.current = restore ?? {
            focused: Boolean(editor && document.activeElement === editor),
            caret: editor ? readCaretOffset(editor) : null,
        };
        setSnapshot((prev) => ({segments: parseBannerTemplate(template), key: prev.key + 1}));
    }, []);

    useLayoutEffect(() => {
        const editor = editorRef.current;
        const {focused, caret} = restoreRef.current;
        if (!editor || !focused) {
            return;
        }

        editor.focus();
        if (caret !== null) {
            restoreCaretOffset(editor, caret);
        }
    }, [snapshot.key]);

    // The same attribute can appear twice in one banner, so a chip's key is its
    // name plus which occurrence it is.
    const chipKeys = useMemo(() => {
        const seen = new Map<string, number>();
        return segments.map((segment) => {
            if (segment.type !== 'token') {
                return '';
            }
            const occurrence = (seen.get(segment.name) ?? 0) + 1;
            seen.set(segment.name, occurrence);
            return `${segment.name}#${occurrence}`;
        });
    }, [segments]);

    useEffect(() => {
        if (value !== emittedRef.current) {
            emittedRef.current = value;
            rebuild(value);
        }
    }, [rebuild, value]);

    const serialize = useCallback((): string => {
        const editor = editorRef.current;
        if (!editor) {
            return '';
        }

        let template = '';
        editor.childNodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                template += node.nodeValue ?? '';
                return;
            }
            if (!(node instanceof HTMLElement)) {
                return;
            }
            const token = node.getAttribute(TOKEN_ATTRIBUTE);

            // Pasted or browser-injected markup contributes its text, never its markup.
            template += token ? `{{${token}}}` : node.textContent ?? '';
        });

        return template;
    }, []);

    const emit = useCallback(() => {
        const editor = editorRef.current;
        const next = serialize();
        if (editor) {
            caretRef.current = readCaretOffset(editor);
        }
        emittedRef.current = next;
        onChange(next);
    }, [onChange, serialize]);

    const rememberCaret = useCallback(() => {
        const editor = editorRef.current;
        if (!editor) {
            return;
        }
        const offset = readCaretOffset(editor);
        if (offset !== null) {
            caretRef.current = offset;
        }
    }, []);

    const handleInsertToken = useCallback((token: string) => {
        const editor = editorRef.current;
        if (!editor || disabled) {
            return;
        }

        const name = token.replace(/[{}]/g, '');
        const label = labels.get(name) ?? name;

        // Spliced into the template rather than inserted into the DOM: the template is
        // what gets saved, and rebuilding from it is the only way the new chip arrives
        // with its remove control and contentEditable=false.
        const template = serialize();
        const segments = parseBannerTemplate(template);
        const visibleTotal = segments.reduce((total, segment) => total + visibleLength(segment, labels), 0);
        const caret = Math.min(caretRef.current ?? visibleTotal, visibleTotal);
        const at = templateOffsetFor(segments, labels, caret);

        const next = template.slice(0, at) + attributeToken(name) + template.slice(at);
        emittedRef.current = next;
        onChange(next);

        // The menu took focus, so the editor is refocused regardless, with the caret
        // left after the chip just inserted.
        caretRef.current = caret + label.length;
        rebuild(next, {focused: true, caret: caretRef.current});
    }, [disabled, labels, onChange, rebuild, serialize]);

    // Reads the chip out of the DOM rather than off a segment index: the DOM is the
    // live document once the user has typed into it, and the snapshot may be older.
    const handleRemoveToken = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        const chip = event.currentTarget.closest(`[${TOKEN_ATTRIBUTE}]`);
        if (!chip) {
            return;
        }
        chip.remove();
        caretRef.current = null;

        const next = serialize();
        emittedRef.current = next;
        onChange(next);
        rebuild(next);
    }, [onChange, rebuild, serialize]);

    const handlePaste = useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
        // Plain text only: pasted markup would serialize as its text anyway, and
        // pasting a styled fragment into a one-line banner is never the intent.
        event.preventDefault();
        const text = event.clipboardData.getData('text/plain').replace(/\s+/g, ' ');
        document.execCommand('insertText', false, text);
    }, []);

    const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
        // The banner is a single line; Enter would insert a <br> that serializes to nothing.
        if (event.key === 'Enter') {
            event.preventDefault();
            return;
        }

        if (maxLength !== undefined && serialize().length >= maxLength && event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
            event.preventDefault();
        }
    }, [maxLength, serialize]);

    return (
        <div className='BannerTextEditor'>
            <div
                className={classNames('BannerTextEditor__field', {
                    'BannerTextEditor__field--error': hasError,
                    'BannerTextEditor__field--disabled': disabled,
                })}
            >
                <div
                    key={snapshot.key}
                    ref={editorRef}
                    className='BannerTextEditor__input'
                    contentEditable={!disabled}
                    suppressContentEditableWarning={true}
                    role='textbox'
                    tabIndex={disabled ? -1 : 0}
                    aria-multiline='false'
                    aria-label={formatMessage({id: 'channel_banner.banner_text.label', defaultMessage: 'Banner text'})}
                    data-testid='bannerTextEditor'
                    data-placeholder={formatMessage({id: 'channel_banner.banner_text.placeholder', defaultMessage: 'Channel banner text'})}
                    onInput={emit}
                    onBlur={rememberCaret}
                    onKeyUp={rememberCaret}
                    onMouseUp={rememberCaret}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                >
                    {segments.map((segment, index) => {
                        if (segment.type === 'text') {
                            return segment.text;
                        }

                        const label = labels.get(segment.name) ?? segment.name;

                        return (
                            <span
                                key={chipKeys[index]}
                                className='BannerTextEditor__chip'
                                contentEditable={false}
                                data-token={segment.name}
                                data-testid={`bannerTextEditorChip-${segment.name}`}
                            >
                                {label}
                                {!disabled && (
                                    <button
                                        type='button'
                                        className='BannerTextEditor__chipRemove'
                                        aria-label={formatMessage(
                                            {id: 'channel_attributes.banner.remove_attribute', defaultMessage: 'Remove {label}'},
                                            {label},
                                        )}
                                        data-testid={`bannerTextEditorChipRemove-${segment.name}`}
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={handleRemoveToken}
                                    >
                                        <CloseCircleIcon size={12}/>
                                    </button>
                                )}
                            </span>
                        );
                    })}
                </div>

                <div className='BannerTextEditor__actions'>
                    <BannerTokenControls
                        attributes={attributes}
                        onInsertToken={handleInsertToken}
                        disabled={disabled}
                    />
                </div>
            </div>
        </div>
    );
};

export default BannerTextEditor;
