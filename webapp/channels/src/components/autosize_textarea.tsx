// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ChangeEvent, FormEvent, CSSProperties, useRef, useEffect, useCallback, HTMLProps} from 'react';
import useDidUpdate from './common/hooks/useDidUpdate';
import {Intersection} from '@mattermost/types/utilities';

type Props = {
    id?: string;
    disabled?: boolean;
    value?: string;
    defaultValue?: string;
    onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void;
    onHeightChange?: (height: number, maxHeight: number) => void;
    onWidthChange?: (width: number) => void;
    onInput?: (e: FormEvent<HTMLTextAreaElement>) => void;
    placeholder?: string;
} & Intersection<HTMLProps<HTMLTextAreaElement>, HTMLProps<HTMLDivElement>>;

const styles: { [Key: string]: CSSProperties} = {
    container: {height: 0, overflow: 'hidden'},
    reference: {height: 'auto', width: '100%'},
    placeholder: {overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.5, pointerEvents: 'none', position: 'absolute', whiteSpace: 'nowrap', background: 'none', borderColor: 'transparent'},
    measuring: {width: 'auto', display: 'inline-block'},
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
    const referenceRef = useRef<HTMLTextAreaElement>(null);
    const measuringRef = useRef<HTMLDivElement>(null);

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

            onHeightChange?.(scrollHeight, parseInt(style.maxHeight || '0', 10));
        }
    };

    const recalculateWidth = () => {
        if (!measuringRef.current) {
            return;
        }

        const width = measuringRef.current?.offsetWidth || -1;
        if (width >= 0) {
            window.requestAnimationFrame(() => {
                onWidthChange?.(width);
            });
        }
    };

    const recalculatePadding = () => {
        if (!referenceRef.current || !textarea.current) {
            return;
        }

        const currentTextarea = textarea.current;
        const {paddingRight} = getComputedStyle(currentTextarea);

        if (paddingRight && paddingRight !== referenceRef.current.style.paddingRight) {
            referenceRef.current.style.paddingRight = paddingRight;
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
    }, []);

    useDidUpdate(() => {
        recalculateHeight();
        recalculateWidth();
        recalculatePadding();
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

    let textareaPlaceholder = null;
    const placeholderAriaLabel = placeholder ? placeholder.toLowerCase() : '';
    if (!value && !defaultValue) {
        textareaPlaceholder = (
            <div
                {...otherProps}
                id={`${id}_placeholder`}
                data-testid={`${id}_placeholder`}
                style={styles.placeholder}
            >
                {placeholder}
            </div>
        );
    }

    return (
        <div>
            {textareaPlaceholder}
            <textarea
                ref={setTextareaRef}
                data-testid={id}
                id={id}
                {...heightProps}
                {...otherProps}
                role='textbox'
                aria-label={placeholderAriaLabel}
                dir='auto'
                disabled={disabled}
                onChange={onChange}
                onInput={onInput}
                value={value}
                defaultValue={defaultValue}
            />
            <div style={styles.container}>
                <textarea
                    ref={referenceRef}
                    id={id + '-reference'}
                    style={styles.reference}
                    dir='auto'
                    disabled={true}
                    rows={1}
                    {...otherProps}
                    value={value || defaultValue}
                    aria-hidden={true}
                    onChange={onChange}
                />
                <div
                    ref={measuringRef}
                    id={id + '-measuring'}
                    style={styles.measuring}
                >
                    {value || defaultValue}
                </div>
            </div>
        </div>
    );
});

export default React.memo(AutosizeTextarea);
