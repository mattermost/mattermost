// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';
import {ChromePicker} from 'react-color';
import type {ColorResult} from 'react-color';
import tinycolor from 'tinycolor2';

type Props = {
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
}: Props) => {
    const colorPicker = useRef<HTMLDivElement>(null);
    const colorInput = useRef<HTMLInputElement>(null);

    const [isFocused, setIsFocused] = useState(false);
    const [isOpened, setIsOpened] = useState(false);
    const [valueFromState, setValueFromState] = useState(valueFromProps);

    if (!isFocused && valueFromProps !== valueFromState) {
        setValueFromState(valueFromProps);
    }

    useEffect(() => {
        const checkClick = (e: MouseEvent): void => {
            if (!colorPicker.current || !colorPicker.current.contains(e.target as Element)) {
                setIsOpened(false);
            }
        };

        if (isOpened) {
            document.addEventListener('click', checkClick, {capture: true});
        }

        return () => {
            document.removeEventListener('click', checkClick);
        };
    }, [isOpened]);

    const togglePicker = () => {
        if (!isOpened && colorInput.current) {
            colorInput.current.focus();
        }
        setIsOpened(!isOpened);
    };

    const handleColorChange = (newColorData: ColorResult) => {
        setIsFocused(false);
        onChangeFromProps(newColorData.hex);
    };

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
        <div className='color-input input-group'>
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
                >
                    <i
                        id={`${id}-squareColorIconValue`}
                        className='color-icon'
                        style={{
                            backgroundColor: valueFromState,
                        }}
                    />
                </span>
            }
            {isOpened && (
                <div
                    ref={colorPicker}
                    className='color-popover'
                    id={`${id}-ChromePickerModal`}
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
