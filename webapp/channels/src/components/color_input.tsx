// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {ChromePicker} from 'react-color';
import type {ColorResult} from 'react-color';
import tinycolor from 'tinycolor2';

type Props = {
    id: string;
    onChange: (color: string) => void;
    value: string;
    isDisabled?: boolean;
}

type State = {
    focused: boolean;
    isOpened: boolean;
    value: string;
}

export default class ColorInput extends React.PureComponent<Props, State> {
    private colorPicker: React.RefObject<HTMLDivElement>;
    private colorInput: React.RefObject<HTMLInputElement>;

    public constructor(props: Props) {
        super(props);
        this.colorPicker = React.createRef();
        this.colorInput = React.createRef();

        this.state = {
            focused: false,
            isOpened: false,
            value: props.value,
        };
    }

    static getDerivedStateFromProps(props: Props, state: State) {
        if (!state.focused && props.value !== state.value) {
            return {
                value: props.value,
            };
        }

        return null;
    }

    public componentDidUpdate(prevProps: Props, prevState: State) {
        const {isOpened: prevIsOpened} = prevState;
        const {isOpened} = this.state;

        if (isOpened !== prevIsOpened) {
            if (isOpened) {
                // Add a slight delay before adding the click handler to prevent immediate closing
                setTimeout(() => {
                    document.addEventListener('click', this.checkClick, {capture: true});
                }, 10);
            } else {
                document.removeEventListener('click', this.checkClick, {capture: true});
            }
        }
    }

    private checkClick = (e: MouseEvent): void => {
        // Don't close if clicking on the color icon itself (that's handled by togglePicker)
        const colorIcon = document.getElementById(`${this.props.id}-squareColorIcon`);
        if (colorIcon && colorIcon.contains(e.target as Element)) {
            return;
        }
        
        // Close if clicking outside the picker
        if (!this.colorPicker.current || !this.colorPicker.current.contains(e.target as Element)) {
            this.setState({isOpened: false});
        }
    };

    private togglePicker = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent the event from propagating to document
        
        const shouldOpen = !this.state.isOpened;
        
        // Focus the input if we're opening the picker
        if (shouldOpen && this.colorInput.current) {
            this.colorInput.current.focus();
        }
        
        this.setState({isOpened: shouldOpen});
    };

    public handleColorChange = (newColorData: ColorResult) => {
        this.setState({focused: false});
        this.props.onChange(newColorData.hex);
    };

    private onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;

        const color = tinycolor(value);
        const normalizedColor = '#' + color.toHex();

        if (color.isValid()) {
            this.props.onChange(normalizedColor);
        }

        this.setState({value});
    };

    private onFocus = (event: React.FocusEvent<HTMLInputElement>): void => {
        this.setState({
            focused: true,
        });

        if (event.target) {
            event.target.setSelectionRange(1, event.target.value.length);
        }
    };

    private onBlur = () => {
        const value = this.state.value;

        const color = tinycolor(value);
        const normalizedColor = '#' + color.toHex();

        if (color.isValid()) {
            this.props.onChange(normalizedColor);

            this.setState({
                value: normalizedColor,
            });
        } else {
            this.setState({
                value: this.props.value,
            });
        }

        this.setState({
            focused: false,
        });
    };

    private onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        // open picker on enter or space
        if (event.key === 'Enter' || event.key === ' ') {
            this.togglePicker();
        }
    };

    public render() {
        const {id} = this.props;
        const {isOpened, value} = this.state;

        return (
            <div className='color-input input-group'>
                <input
                    id={`${id}-inputColorValue`}
                    ref={this.colorInput}
                    className='form-control'
                    type='text'
                    value={value}
                    onChange={this.onChange}
                    onBlur={this.onBlur}
                    onFocus={this.onFocus}
                    onKeyDown={this.onKeyDown}
                    maxLength={7}
                    disabled={this.props.isDisabled}
                    data-testid='color-inputColorValue'

                />
                {!this.props.isDisabled &&
                    <span
                        id={`${id}-squareColorIcon`}
                        className='input-group-addon color-pad'
                        onClick={this.togglePicker}
                        role="button"
                        aria-haspopup="true"
                        aria-expanded={isOpened ? 'true' : 'false'}
                    >
                        <i
                            id={`${id}-squareColorIconValue`}
                            className='color-icon'
                            style={{
                                backgroundColor: value,
                            }}
                        />
                    </span>
                }
                {isOpened && (
                    <div
                        ref={this.colorPicker}
                        className='color-popover'
                        id={`${id}-ChromePickerModal`}
                    >
                        <ChromePicker
                            color={value}
                            onChange={this.handleColorChange}
                            disableAlpha={true}
                        />
                    </div>
                )}
            </div>
        );
    }
}
