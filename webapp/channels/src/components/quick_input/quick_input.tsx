// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {ReactComponentLike} from 'prop-types';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import AutosizeTextarea from 'components/autosize_textarea';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

import Constants from 'utils/constants';

type Props<InputElement extends HTMLInputElement | HTMLTextAreaElement = HTMLInputElement> = {

    /**
     * Whether to delay updating the value of the textbox from props. Should only be used
     * on textboxes that to properly compose CJK characters as the user types.
     */
    delayInputUpdate?: boolean;

    /**
     * An optional React component that will be used instead of an HTML input when rendering
     */
    inputComponent?: ReactComponentLike;

    /**
     * A ref pointing to the underlying input
     */
    inputRef?: React.ForwardedRef<InputElement>;

    /**
     * The string value displayed in this input
     */
    value: string;

    /**
     * When true, and an onClear callback is defined, show an X on the input field that clears
     * the input when clicked.
     */
    clearable?: boolean;

    /**
     * The optional tooltip text to display on the X shown when clearable. Pass a components
     * such as FormattedMessage to localize.
     */
    clearableTooltipText?: React.ReactNode;

    /**
     * Callback to clear the input value, and used in tandem with the clearable prop above.
     */
    onClear?: () => void;

    /**
     * ClassName for the clear button container
     */
    clearClassName?: string;

    /**
     * Position in which the tooltip will be displayed
     */
    tooltipPosition?: 'top' | 'bottom';

    /**
     * When true, and an onClear callback is defined, show an X on the input field even if
     * the input is empty.
     */
    clearableWithoutValue?: boolean;

    // Props from input/textarea
    autoComplete?: string;
    autoFocus?: boolean;
    className?: string;
    id?: string;
    onChange?: React.ChangeEventHandler<InputElement>;
    onCompositionEnd?: React.CompositionEventHandler<InputElement>;
    onCompositionStart?: React.CompositionEventHandler<InputElement>;
    onCompositionUpdate?: React.CompositionEventHandler<InputElement>;
    onInput?: React.FormEventHandler<InputElement>;
    onKeyDown?: React.KeyboardEventHandler<InputElement>;
    onKeyPress?: React.KeyboardEventHandler<InputElement>;
    onKeyUp?: React.KeyboardEventHandler<InputElement>;
    onMouseUp?: React.MouseEventHandler<InputElement>;
    maxLength?: number;
    placeholder?: string;
    type?: string;
};

// A component that can be used to make controlled inputs that function properly in certain
// environments (ie. IE11) where typing quickly would sometimes miss inputs
export default class QuickInput<InputElement extends HTMLInputElement | HTMLTextAreaElement = HTMLInputElement> extends React.PureComponent<Props<InputElement>> {
    private input?: InputElement;

    static defaultProps = {
        value: '',
        tooltipPosition: 'bottom',
    };

    componentDidMount() {
        if (this.props.autoFocus) {
            requestAnimationFrame(() => {
                this.input?.focus();
            });
        }
    }

    componentDidUpdate(prevProps: Props<InputElement>) {
        if (prevProps.value !== this.props.value) {
            if (this.props.delayInputUpdate) {
                requestAnimationFrame(this.updateInputFromProps);
            } else {
                this.updateInputFromProps();
            }
        }
    }

    private updateInputFromProps = () => {
        if (!this.input || this.input.value === this.props.value) {
            return;
        }

        this.input.value = this.props.value ?? '';
    };

    private setInputRef = (input: InputElement) => {
        if (this.props.inputRef) {
            if (typeof this.props.inputRef === 'function') {
                this.props.inputRef(input);
            } else {
                this.props.inputRef.current = input;
            }
        }

        this.input = input;
    };

    private onClear = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (this.props.onClear) {
            this.props.onClear();
        }

        this.input?.focus();
    };

    render() {
        let clearableTooltipText = this.props.clearableTooltipText;
        if (!clearableTooltipText) {
            clearableTooltipText = (
                <FormattedMessage
                    id={'input.clear'}
                    defaultMessage='Clear'
                />
            );
        }

        const clearableTooltip = (
            <Tooltip id={'InputClearTooltip'}>
                {clearableTooltipText}
            </Tooltip>
        );

        const {
            value,
            inputComponent,
            clearable,
            clearClassName,
            tooltipPosition,
            clearableWithoutValue,
            ...props
        } = this.props;

        Reflect.deleteProperty(props, 'delayInputUpdate');
        Reflect.deleteProperty(props, 'onClear');
        Reflect.deleteProperty(props, 'clearableTooltipText');
        Reflect.deleteProperty(props, 'channelId');
        Reflect.deleteProperty(props, 'clearClassName');
        Reflect.deleteProperty(props, 'tooltipPosition');
        Reflect.deleteProperty(props, 'inputRef');

        if (inputComponent !== AutosizeTextarea) {
            Reflect.deleteProperty(props, 'onHeightChange');
            Reflect.deleteProperty(props, 'onWidthChange');
        }

        const inputElement = React.createElement(
            inputComponent || 'input',
            {
                ...props,
                ref: this.setInputRef,
                defaultValue: value, // Only set the defaultValue since the real one will be updated using componentDidUpdate
            },
        );

        const showClearButton = this.props.onClear && (clearableWithoutValue || (clearable && value));
        return (<div className='input-wrapper'>
            {inputElement}
            {showClearButton &&
            <div
                className={classNames(clearClassName, 'input-clear visible')}
                onMouseDown={this.onClear}
                onTouchEnd={this.onClear}
            >
                <OverlayTrigger
                    delayShow={Constants.OVERLAY_TIME_DELAY}
                    placement={tooltipPosition}
                    overlay={clearableTooltip}
                >
                    <span
                        className='input-clear-x'
                        aria-hidden='true'
                        data-testid='quick-input-clear'
                    >
                        <i className='icon icon-close-circle'/>
                    </span>
                </OverlayTrigger>
            </div>
            }
        </div>);
    }
}
