// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useEffect, useRef, useState} from 'react';
import {ChromePicker} from 'react-color';
import type {ColorResult} from 'react-color';
import tinycolor from 'tinycolor2';

import './classification_color_input.scss';

export type ClassificationColorInputProps = {
    id: string;
    value: string;
    onChange: (color: string) => void;
    swatchAriaLabel: string;
    isDisabled?: boolean;
};

function ClassificationColorInput({id, value, onChange, swatchAriaLabel, isDisabled}: ClassificationColorInputProps) {
    const [focused, setFocused] = useState(false);
    const [isOpened, setIsOpened] = useState(false);
    const [localValue, setLocalValue] = useState(value);
    const popoverRef = useRef<HTMLDivElement>(null);
    const hexInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!focused) {
            setLocalValue(value);
        }
    }, [value, focused]);

    useEffect(() => {
        if (isDisabled) {
            setIsOpened(false);
        }
    }, [isDisabled]);

    const handleChromeChange = useCallback(
        (newColorData: ColorResult) => {
            const hex = newColorData.hex;
            setFocused(false);
            setLocalValue(hex);
            onChange(hex);
        },
        [onChange],
    );

    const handleHexChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const next = event.target.value;
            const color = tinycolor(next);
            if (color.isValid()) {
                onChange('#' + color.toHex());
            }
            setLocalValue(next);
        },
        [onChange],
    );

    const handleHexFocus = useCallback(
        (event: React.FocusEvent<HTMLInputElement>) => {
            if (!isDisabled) {
                setIsOpened(true);
            }
            setFocused(true);
            const el = event.target;
            if (el.value.length > 1) {
                el.setSelectionRange(1, el.value.length);
            }
        },
        [isDisabled],
    );

    const handleHexBlur = useCallback(
        (event: React.FocusEvent<HTMLInputElement>) => {
            const related = event.relatedTarget as Node | null;
            if (popoverRef.current && related && popoverRef.current.contains(related)) {
                return;
            }
            setIsOpened(false);
            const color = tinycolor(localValue);
            if (color.isValid()) {
                const normalized = '#' + color.toHex();
                onChange(normalized);
                setLocalValue(normalized);
            } else {
                setLocalValue(value);
            }
            setFocused(false);
        },
        [localValue, onChange, value],
    );

    const handleSwatchClick = useCallback(() => {
        if (isDisabled) {
            return;
        }
        const hexEl = hexInputRef.current;
        if (isOpened && document.activeElement === hexEl) {
            hexEl?.blur();
            return;
        }
        hexEl?.focus();
    }, [isDisabled, isOpened]);

    const handleHexKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.currentTarget.blur();
        }
    }, []);

    return (
        <div className='ClassificationColorInput'>
            <div className='ClassificationColorInput__control'>
                {!isDisabled && (
                    <button
                        type='button'
                        id={`${id}-squareColorIcon`}
                        className='ClassificationColorInput__swatch'
                        style={{
                            backgroundColor: localValue,
                            borderColor: tinycolor(localValue).darken(5).toHexString(),
                        }}
                        aria-label={swatchAriaLabel}
                        aria-expanded={isOpened}
                        aria-haspopup='dialog'
                        onClick={handleSwatchClick}
                    />
                )}
                <input
                    id={`${id}-inputColorValue`}
                    ref={hexInputRef}
                    className='ClassificationColorInput__hex'
                    type='text'
                    value={localValue}
                    onChange={handleHexChange}
                    onBlur={handleHexBlur}
                    onFocus={handleHexFocus}
                    onKeyDown={handleHexKeyDown}
                    maxLength={7}
                    disabled={isDisabled}
                    data-testid='color-inputColorValue'
                />
            </div>
            {isOpened && !isDisabled && (
                <>
                    {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- mousedown preventDefault matches ColorInput (picker before blur) */}
                    <div
                        ref={popoverRef}
                        className='ClassificationColorInput__popover'
                        id={`${id}-ChromePickerModal`}
                        onMouseDown={(e) => e.preventDefault()}
                    >
                        <ChromePicker
                            color={localValue}
                            onChange={handleChromeChange}
                            disableAlpha={true}
                        />
                    </div>
                </>
            )}
        </div>
    );
}

export default memo(ClassificationColorInput);
