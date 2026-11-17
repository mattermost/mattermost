// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {forwardRef, useCallback, useEffect, useRef} from 'react';

import {CreationOutlineIcon} from '@mattermost/compass-icons/components';

import Input from 'components/widgets/inputs/input/input';

type Props = {
    value: string;
    placeholder: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
};

// A fully controlled input re-asserts its value into the DOM on every render, which discards
// the text an IME is still composing when an unrelated re-render lands mid-composition. That
// drops, doubles, or splits multi-byte (CJK) characters while typing quickly. This input stays
// uncontrolled and syncs the value imperatively instead — the same approach QuickInput uses for
// the message box — so ongoing composition is never overwritten (MM-70289).
//
// The value prop can also lag behind what was typed (the formatting bar re-renders this input
// from a deferred render), so a value the input already reported through onChange is an echo of
// older input and is never written back; only other values are external changes to apply.
const RewritePromptInput = forwardRef<HTMLInputElement, Props>(({value, placeholder, onChange, onKeyDown}, ref) => {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const isComposingRef = useRef(false);
    const reportedValuesRef = useRef<string[]>([]);

    useEffect(() => {
        const reportedValues = reportedValuesRef.current;
        const echoIndex = reportedValues.indexOf(value);
        if (echoIndex !== -1) {
            reportedValues.splice(0, echoIndex + 1);
            return;
        }
        reportedValues.length = 0;

        if (isComposingRef.current) {
            return;
        }
        if (inputRef.current && inputRef.current.value !== value) {
            inputRef.current.value = value;
        }
    }, [value]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        reportedValuesRef.current.push(e.target.value);
        onChange(e);
    }, [onChange]);

    const setInputRef = useCallback((node: HTMLInputElement | HTMLTextAreaElement | null) => {
        inputRef.current = node as HTMLInputElement | null;

        if (typeof ref === 'function') {
            ref(node as HTMLInputElement | null);
        } else if (ref) {
            (ref as React.MutableRefObject<HTMLInputElement | null>).current = node as HTMLInputElement | null;
        }
    }, [ref]);

    const handleCompositionStart = useCallback(() => {
        isComposingRef.current = true;
    }, []);

    const handleCompositionEnd = useCallback(() => {
        isComposingRef.current = false;
    }, []);

    return (
        <Input
            ref={setInputRef}
            inputPrefix={<CreationOutlineIcon size={18}/>}
            label={placeholder}
            placeholder={placeholder}
            defaultValue={value}
            onChange={handleChange}
            onKeyDown={onKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
        />
    );
});
RewritePromptInput.displayName = 'RewritePromptInput';

export default RewritePromptInput;
