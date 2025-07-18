// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {ReactComponentLike} from 'prop-types';
import React, {useCallback, useEffect, useRef} from 'react';
import type {ReactNode} from 'react';
import {FormattedMessage} from 'react-intl';

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
    value?: string;

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
    role?: string;
}

const defaultClearableTooltipText = (
    <FormattedMessage
        id={'input.clear'}
        defaultMessage='Clear'
    />);

// A component that can be used to make controlled inputs that function properly in certain
// environments (ie. IE11) where typing quickly would sometimes miss inputs
export const QuickInput = React.memo(({
    delayInputUpdate = false,
    value = '',
    clearable = false,
    autoFocus,
    forwardedRef,
    inputComponent,
    clearClassName,
    clearableWithoutValue,
    clearableTooltipText,
    onClear: onClearFromProps,
    ...restProps
}: Props) => {
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

    useEffect(() => {
        if (autoFocus) {
            requestAnimationFrame(() => {
                inputRef.current?.focus();
            });
        }

        /* eslint-disable-next-line react-hooks/exhaustive-deps --
         * This 'useEffect' should only run once during mount.
         **/
    }, []);

    useEffect(() => {
        const updateInputFromProps = () => {
            if (!inputRef.current || inputRef.current.value === value) {
                return;
            }

            inputRef.current.value = value;
        };

        if (delayInputUpdate) {
            requestAnimationFrame(updateInputFromProps);
        } else {
            updateInputFromProps();
        }

        /* eslint-disable-next-line react-hooks/exhaustive-deps --
         * This 'useEffect' should run only when 'value' prop changes.
         **/
    }, [value]);

    const setInputRef = useCallback((input: HTMLInputElement) => {
        if (forwardedRef) {
            if (typeof forwardedRef === 'function') {
                forwardedRef(input);
            } else {
                forwardedRef.current = input;
            }
        }

        inputRef.current = input;
    }, [forwardedRef]);

    const onClear = useCallback((e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (onClearFromProps) {
            onClearFromProps();
        }

        inputRef.current?.focus();
    }, [onClearFromProps]);

    const showClearButton = onClearFromProps && (clearableWithoutValue || (clearable && value));

    const inputElement = React.createElement(
        inputComponent || 'input',
        {
            ...restProps,
            ref: setInputRef,
            defaultValue: value, // Only set the defaultValue since the real one will be updated using the 'useEffect' above
        },
    );

    return (
        <div className='input-wrapper'>
            {inputElement}
            {showClearButton && (
                <WithTooltip title={clearableTooltipText || defaultClearableTooltipText}>
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
