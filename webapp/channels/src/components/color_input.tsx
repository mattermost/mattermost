// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ChromePicker} from 'react-color';
import type {ColorResult} from 'react-color';
import tinycolor from 'tinycolor2';

export interface ColorInputProps {
    id: string;
    onChange: (color: string) => void;
    value: string;
    isDisabled?: boolean;
}

const ColorInput = ({
    id,
    onChange: onChangeFromProps,
    value: valueFromProps,
    isDisabled,
}: ColorInputProps) => {
    const container = useRef<HTMLDivElement>(null);
    const colorInput = useRef<HTMLInputElement>(null);

    const [isFocused, setIsFocused] = useState(false);
    const [isOpened, setIsOpened] = useState(false);
    const [valueFromState, setValueFromState] = useState(valueFromProps);

    if (!isFocused && valueFromProps !== valueFromState) {
        setValueFromState(valueFromProps);
    }

    useEffect(() => {
        if (!isOpened) {
            return () => {};
        }

        const checkClick = (e: MouseEvent): void => {
            if (!container.current || !container.current.contains(e.target as Element)) {
                setIsOpened(false);
            }
        };

        document.addEventListener('mousedown', checkClick);

        return () => {
            document.removeEventListener('mousedown', checkClick);
        };
    }, [isOpened]);

    const togglePicker = () => {
        colorInput.current?.focus();
        setIsOpened(true);
    };

    const handleColorChange = useCallback((newColorData: ColorResult) => {
        setIsFocused(false);
        onChangeFromProps(newColorData.hex);
    }, [onChangeFromProps]);

    const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;

        const color = tinycolor(value);
        const normalizedColor = '#' + color.toHex();

        if (color.isValid()) {
            onChangeFromProps(normalizedColor);
        }

        setValueFromState(value);
    };

    const onFocus = (event: React.FocusEvent<HTMLInputElement>): void => {
        setIsFocused(true);

        if (event.target) {
            event.target.setSelectionRange(1, event.target.value.length);
        }
    };

    const onBlur = () => {
        const value = valueFromState;

        const color = tinycolor(value);
        const normalizedColor = '#' + color.toHex();

        if (color.isValid()) {
            onChangeFromProps(normalizedColor);

            setValueFromState(normalizedColor);
        } else {
            setValueFromState(valueFromProps);
        }

        setIsFocused(false);
    };

    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        // open picker on enter or space
        if (event.key === 'Enter' || event.key === ' ') {
            togglePicker();
        }
    };

    return (
        <div
            className='color-input input-group'
            ref={container}
        >
            <input
                id={`${id}-inputColorValue`}
                ref={colorInput}
                className='form-control'
                type='text'
                value={valueFromState}
                onChange={onChange}
                onBlur={onBlur}
                onFocus={onFocus}
                onKeyDown={onKeyDown}
                maxLength={7}
                disabled={isDisabled}
                data-testid='color-inputColorValue'
            />
            {!isDisabled &&
                <span
                    id={`${id}-squareColorIcon`}
                    className='input-group-addon color-pad'
                    onClick={togglePicker}
                    data-testid='color-togglerButton'
                >
                    <i
                        id={`${id}-squareColorIconValue`}
                        className='color-icon'
                        data-testid='color-icon'
                        style={{
                            backgroundColor: valueFromState,
                        }}
                    />
                </span>
            }
            {isOpened && (
                <div
                    className='color-popover'
                    id={`${id}-ChromePickerModal`}
                    data-testid='color-popover'
                >
                    <ChromePicker
                        color={valueFromState}
                        onChange={handleColorChange}
                        disableAlpha={true}
                    />
                </div>
            )}
        </div>
    );
};

export default React.memo(ColorInput);
