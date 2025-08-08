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

    const [isOpened, setIsOpened] = useState(false);
    const [valueFromState, setValueFromState] = useState(valueFromProps);

    useEffect(() => {
        const checkClick = (e: MouseEvent): void => {
            if (!colorPicker.current || !colorPicker.current.contains(e.target as Element)) {
                setIsOpened(false);
            }
        };

        /**
         * Since 'isOpened' is changed by a click event, this 'useEffect' runs before the screen is painted
         * therefore, 'checkClick' is fired before the component is mounted which in turn calls 'setIsOpened(false)'.
         * It's not possible to update the state of an unmounted component. 'setTimeout' ensures the event listener is
         * added after the screen is painted and the component mounted. The delay (1) is just the smallest number possible
         * so the listeners are attached as soon as possible.
         * https://react.dev/reference/react/useEffect#:~:text=If%20your%20Effect%20is%20caused%20by%20an%20interaction%20(like%20a%20click)%2C%20React%20may%20run%20your%20Effect%20before%20the%20browser%20paints%20the%20updated%20screen.
         * */
        setTimeout(() => {
            if (isOpened) {
                document.addEventListener('click', checkClick, {capture: true});
            }
        }, 1);

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
                    ref={colorPicker}
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
