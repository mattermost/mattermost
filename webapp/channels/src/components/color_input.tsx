// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useRef, useState, useEffect} from 'react';
import {HexColorPicker} from 'react-colorful';
import tinycolor from 'tinycolor2';

type Props = {
    id: string;
    onChange: (color: string) => void;
    value: string;
    isDisabled?: boolean;
}

export default function ColorInput({id, onChange, value, isDisabled}: Props) {
    const [localValue, setLocalValue] = useState(value);
    const [focused, setFocused] = useState(false);
    const [isOpened, setIsOpened] = useState(false);
    const colorInputRef = useRef<HTMLInputElement>(null);
    const colorPickerRef = useRef<HTMLDivElement>(null);

    // Sync local value with prop when not focused
    useEffect(() => {
        if (!focused && value !== localValue) {
            setLocalValue(value);
        }
    }, [value, focused, localValue]);

    // Handle clicks outside the picker to close it
    useEffect(() => {
        if (!isOpened) {
            return undefined;
        }

        const handleClickOutside = (e: MouseEvent) => {
            if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Element)) {
                setIsOpened(false);
            }
        };

        document.addEventListener('click', handleClickOutside, {capture: true});
        return () => document.removeEventListener('click', handleClickOutside, {capture: true});
    }, [isOpened]);

    const togglePicker = useCallback(() => {
        if (!isOpened && colorInputRef.current) {
            colorInputRef.current.focus();
        }
        setIsOpened((prev) => !prev);
    }, [isOpened]);

    const handleColorPickerChange = useCallback((newColor: string) => {
        setLocalValue(newColor);
        onChange(newColor);
    }, [onChange]);

    const handleTextChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = event.target.value;
        const color = tinycolor(newValue);
        const normalizedColor = '#' + color.toHex();

        if (color.isValid()) {
            onChange(normalizedColor);
        }

        setLocalValue(newValue);
    }, [onChange]);

    const handleFocus = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
        setFocused(true);
        event.target?.setSelectionRange(1, event.target.value.length);
    }, []);

    const handleBlur = useCallback(() => {
        const color = tinycolor(localValue);
        const normalizedColor = '#' + color.toHex();

        if (color.isValid()) {
            onChange(normalizedColor);
            setLocalValue(normalizedColor);
        } else {
            setLocalValue(value);
        }

        setFocused(false);
    }, [localValue, onChange, value]);

    const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            togglePicker();
        }
    }, [togglePicker]);

    // Ensure valid hex for color picker
    const color = tinycolor(localValue);
    const pickerColor = color.isValid() ? '#' + color.toHex() : '#000000';

    return (
        <div className='color-input input-group'>
            <input
                id={`${id}-inputColorValue`}
                ref={colorInputRef}
                className='form-control'
                type='text'
                value={localValue}
                onChange={handleTextChange}
                onBlur={handleBlur}
                onFocus={handleFocus}
                onKeyDown={handleKeyDown}
                maxLength={7}
                disabled={isDisabled}
                data-testid='color-inputColorValue'
            />
            {!isDisabled && (
                <span
                    id={`${id}-squareColorIcon`}
                    className='input-group-addon color-pad'
                    onClick={togglePicker}
                >
                    <i
                        id={`${id}-squareColorIconValue`}
                        className='color-icon'
                        style={{backgroundColor: localValue}}
                    />
                </span>
            )}
            {isOpened && (
                <div
                    ref={colorPickerRef}
                    className='color-popover'
                    id={`${id}-ChromePickerModal`}
                >
                    <HexColorPicker
                        color={pickerColor}
                        onChange={handleColorPickerChange}
                    />
                </div>
            )}
        </div>
    );
}
