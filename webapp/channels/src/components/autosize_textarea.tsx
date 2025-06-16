// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChangeEvent, FormEvent, HTMLProps} from 'react';
import React, {useRef, useEffect, useCallback, useState} from 'react';

import type {Intersection} from '@mattermost/types/utilities';

type Props = {
    id?: string;
    className?: string;
    disabled?: boolean;
    value?: string;
    defaultValue?: string;
    onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void;
    onHeightChange?: (height: number, maxHeight: number) => void;
    onWidthChange?: (width: number) => void;
    onInput?: (e: FormEvent<HTMLTextAreaElement>) => void;
    placeholder?: string;
} & Intersection<HTMLProps<HTMLTextAreaElement>, HTMLProps<HTMLDivElement>>;

const styles = {
    container: {
        height: 0,
        overflow: 'hidden',
    },
    reference: {
        height: 'auto',
        width: 'auto',
        display: 'inline-block',
        position: 'relative' as const,
        transform: 'translateY(-100%)',
        wordBreak: 'break-word' as const,
    },
    placeholder: {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        opacity: 0.75,
        pointerEvents: 'none' as const,
        position: 'absolute' as const,
        whiteSpace: 'nowrap' as const,
        background: 'none',
        borderColor: 'transparent',
    },
    textArea: {
        overflowY: 'hidden' as const,
    },
    textAreaWithScroll: {
        overflowY: 'auto' as const,
    },
};

const AutosizeTextarea = React.forwardRef<HTMLTextAreaElement, Props>(({

    // TODO: The provided `id` is sometimes hard-coded and used to interface with the
    // component, e.g. `post_textbox`, so it can't be changed. This would ideally be
    // abstracted to avoid passing in an `id` prop at all, but we intentionally maintain
    // the old behaviour to address ABC-213.
    id = 'autosize_textarea',
    disabled,
    value,
    defaultValue,
    onChange,
    onHeightChange,
    onWidthChange,
    onInput,
    placeholder,
    ...otherProps
}: Props, ref) => {
    const height = useRef(0);
    const textarea = useRef<HTMLTextAreaElement>();
    const referenceRef = useRef<HTMLDivElement>(null);
    const [showScrollbar, setShowScrollbar] = useState(false);

    const recalculateHeight = () => {
        if (!referenceRef.current || !textarea.current) {
            return;
        }

        const scrollHeight = referenceRef.current.scrollHeight;
        const currentTextarea = textarea.current;

        if (scrollHeight > 0 && scrollHeight !== height.current) {
            const style = getComputedStyle(currentTextarea);

            // Directly change the height to avoid circular rerenders
            currentTextarea.style.height = `${scrollHeight}px`;

            height.current = scrollHeight;

            // Only show scrollbar if content height exceeds 44px
            setShowScrollbar(scrollHeight > 44);

            onHeightChange?.(scrollHeight, parseInt(style.maxHeight || '0', 10));
        }
    };

    const recalculateWidth = () => {
        if (!referenceRef.current) {
            return;
        }

        const width = referenceRef.current?.offsetWidth || -1;
        if (width >= 0) {
            window.requestAnimationFrame(() => {
                onWidthChange?.(width);
            });
        }
    };

    const setTextareaRef = useCallback((textareaRef: HTMLTextAreaElement) => {
        if (ref) {
            if (typeof ref === 'function') {
                ref(textareaRef);
            } else {
                ref.current = textareaRef;
            }
        }

        textarea.current = textareaRef;
    }, [ref]);

    useEffect(() => {
        recalculateHeight();
        recalculateWidth();
    });

    const heightProps = {
        rows: 0,
        height: 0,
    };

    if (height.current <= 0) {
        // Set an initial number of rows so that the textarea doesn't appear too large when its first rendered
        heightProps.rows = 1;
    } else {
        heightProps.height = height.current;
    }

    let referenceValue = value || defaultValue;
    if (referenceValue?.endsWith('\n')) {
        // In a div, the browser doesn't always count characters at the end of a line when measuring the dimensions
        // of text. In the spec, they refer to those characters as "hanging". No matter what value we set for the
        // `white-space` of a div, a single newline at the end of the div will always hang.
        //
        // The textarea doesn't have that behaviour, so we need to trick the reference div into measuring that
        // newline, and it seems like the best way to do that is by adding a second newline because only the final
        // one hangs.
        referenceValue += '\n';
    }

    return (
        <div >
            <textarea
                ref={setTextareaRef}
                data-testid={id}
                id={id}
                {...heightProps}
                {...otherProps}
                placeholder={placeholder}
                role='textbox'
                dir='auto'
                disabled={disabled}
                onChange={onChange}
                onInput={onInput}
                value={value}
                defaultValue={defaultValue}
                style={showScrollbar ? styles.textAreaWithScroll : styles.textArea}
            />
            <div style={styles.container}>
                <div
                    ref={referenceRef}
                    id={id + '-reference'}
                    className={otherProps.className}
                    style={styles.reference}
                    dir='auto'
                    disabled={true}
                    aria-hidden={true}
                >
                    {referenceValue}
                </div>
            </div>
        </div>
    );
});

export default React.memo(AutosizeTextarea);
