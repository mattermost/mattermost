// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {ReactComponentLike} from 'prop-types';
import React from 'react';
import type {ReactNode} from 'react';
import {FormattedMessage} from 'react-intl';

import AutosizeTextarea from 'components/autosize_textarea';
import WithTooltip from 'components/with_tooltip';

export type Props = {

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
    clearableTooltipText?: string | ReactNode;

    /**
     * Callback to clear the input value, and used in tandem with the clearable prop above.
     */
    onClear?: () => void;

    /**
     * ClassName for the clear button container
     */
    clearClassName?: string;

    /**
     * Callback to handle the change event of the input
     */
    onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;

    /**
     * Callback to handle the key up of the input
     */
    onKeyUp?: (event: React.KeyboardEvent) => void;

    /**
     * Callback to handle the key down of the input
     */
    onKeyDown?: (event: React.KeyboardEvent) => void;

    /**
     * When true, and an onClear callback is defined, show an X on the input field even if
     * the input is empty.
     */
    clearableWithoutValue?: boolean;

    forwardedRef?: ((instance: HTMLInputElement | HTMLTextAreaElement | null) => void) | React.MutableRefObject<HTMLInputElement | HTMLTextAreaElement | null> | null;

    maxLength?: number;
    className?: string;
    placeholder?: string;
    autoFocus?: boolean;
    type?: string;
    id?: string;
    onInput?: (e?: React.FormEvent<HTMLInputElement>) => void;
    tabIndex?: number;
}

// A component that can be used to make controlled inputs that function properly in certain
// environments (ie. IE11) where typing quickly would sometimes miss inputs
export class QuickInput extends React.PureComponent<Props> {
    private input?: HTMLInputElement | HTMLTextAreaElement;

    static defaultProps = {
        delayInputUpdate: false,
        value: '',
        clearable: false,
    };

    componentDidMount() {
        if (this.props.autoFocus) {
            requestAnimationFrame(() => {
                this.input?.focus();
            });
        }
    }

    componentDidUpdate(prevProps: Props) {
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

        this.input.value = this.props.value;
    };

    private setInputRef = (input: HTMLInputElement) => {
        if (this.props.forwardedRef) {
            if (typeof this.props.forwardedRef === 'function') {
                this.props.forwardedRef(input);
            } else {
                this.props.forwardedRef.current = input;
            }
        }

        this.input = input;
    };

    private onClear = (e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (this.props.onClear) {
            this.props.onClear();
        }

        this.input?.focus();
    };

    render() {
        let clearableTooltipText = this.props.clearableTooltipText || '';
        if (!clearableTooltipText) {
            clearableTooltipText = (
                <FormattedMessage
                    id={'input.clear'}
                    defaultMessage='Clear'
                />
            );
        }

        const {
            value,
            inputComponent,
            clearable,
            clearClassName,
            clearableWithoutValue,
            ...props
        } = this.props;

        Reflect.deleteProperty(props, 'delayInputUpdate');
        Reflect.deleteProperty(props, 'onClear');
        Reflect.deleteProperty(props, 'clearableTooltipText');
        Reflect.deleteProperty(props, 'channelId');
        Reflect.deleteProperty(props, 'clearClassName');
        Reflect.deleteProperty(props, 'tooltipPosition');
        Reflect.deleteProperty(props, 'forwardedRef');

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

        return (
            <div className='input-wrapper'>
                {inputElement}
                {showClearButton && (
                    <WithTooltip title={clearableTooltipText}>
                        <button
                            data-testid='input-clear'
                            className={classNames(clearClassName, 'input-clear visible')}
                            onClick={this.onClear}
                        >
                            <span
                                className='input-clear-x'
                                aria-hidden='true'
                            >
                                <i className='icon icon-close-circle'/>
                            </span>
                        </button>
                    </WithTooltip>
                )}
            </div>
        );
    }
}

type ForwardedProps = Omit<React.ComponentPropsWithoutRef<typeof QuickInput>, 'forwardedRef'>;

const forwarded = React.forwardRef<HTMLInputElement | HTMLTextAreaElement, ForwardedProps>((props, ref) => (
    <QuickInput
        forwardedRef={ref}
        {...props}
    />
));
forwarded.displayName = 'QuickInput';

export default forwarded;
