// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {ReactComponentLike} from 'prop-types';
import React, {useEffect, useRef} from 'react';
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
const QuickInput = React.memo(({
    delayInputUpdate = false,
    value = '',
    clearable = false,
    autoFocus,
    forwardedRef,
    inputComponent,
    clearClassName,
    clearableWithoutValue,
    ...props
}: Props) => {
    /**
     * Refs are the equivalent of instance properties in a class.
     * https://legacy.reactjs.org/docs/hooks-faq.html#is-there-something-like-instance-variables
     */
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | undefined>();

    /*
        Using a ref here so the useEffect runs only once when the component
        mounts instead of passing the 'autoFocus' prop to the effect which
        will run it every time the autoFocus prop changes since 'autoFocus'
        prop will have to be passed as a dependency.
    */
    const autoFocusRef = useRef(autoFocus);

    useEffect(() => {
        if (autoFocusRef.current) {
            requestAnimationFrame(() => {
                inputRef.current?.focus();
            });
        }
    }, []);

    /*
        Storing this value in a ref so it's not required as dependency
        in the 'useEffect' that runs when 'value' changes, otherwise,
        'delayInputUpdate' changing would re-run the effect.

        A separate 'useEffect' updates the ref so it gets the latest
        value whenever delayInputUpdateRef changes.
    */
    const delayInputUpdateRef = useRef(delayInputUpdate);

    useEffect(() => {
        delayInputUpdateRef.current = delayInputUpdate;
    }, [delayInputUpdate]);

    useEffect(() => {
        const updateInputFromProps = () => {
            if (!inputRef.current || inputRef.current.value === value) {
                return;
            }

            inputRef.current.value = value;
        };

        if (delayInputUpdateRef.current) {
            requestAnimationFrame(updateInputFromProps);
        } else {
            updateInputFromProps();
        }
    }, [value]);

    const setInputRef = (input: HTMLInputElement) => {
        if (forwardedRef) {
            if (typeof forwardedRef === 'function') {
                forwardedRef(input);
            } else {
                forwardedRef.current = input;
            }
        }

        inputRef.current = input;
    };

    const onClear = (e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (props.onClear) {
            props.onClear();
        }

        inputRef.current?.focus();
    };

    let clearableTooltipText = props.clearableTooltipText || '';

    if (!clearableTooltipText) {
        clearableTooltipText = (
            <FormattedMessage
                id={'input.clear'}
                defaultMessage='Clear'
            />
        );
    }

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
            ref: setInputRef,
            defaultValue: value, // Only set the defaultValue since the real one will be updated using componentDidUpdate
        },
    );

    const showClearButton = props.onClear && (clearableWithoutValue || (clearable && value));

    return (
        <div className='input-wrapper'>
            {inputElement}
            {showClearButton && (
                <WithTooltip title={clearableTooltipText}>
                    <button
                        data-testid='input-clear'
                        className={classNames(clearClassName, 'input-clear visible')}
                        onClick={onClear}
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
});

type ForwardedProps = Omit<React.ComponentPropsWithoutRef<typeof QuickInput>, 'forwardedRef'>;

const forwarded = React.forwardRef<HTMLInputElement | HTMLTextAreaElement, ForwardedProps>((props, ref) => (
    <QuickInput
        forwardedRef={ref}
        {...props}
    />
));
forwarded.displayName = 'QuickInput';

export default forwarded;
