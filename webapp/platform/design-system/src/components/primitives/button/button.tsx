// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {forwardRef, memo, useMemo} from 'react';
import type {ButtonHTMLAttributes, ReactNode} from 'react';

import Spinner from '../spinner';

import './button.scss';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';
export type ButtonEmphasis = 'primary' | 'secondary' | 'tertiary' | 'quaternary' | 'link';

// Map Button sizes to Spinner pixel sizes (using Figma design system values)
const BUTTON_SPINNER_SIZE_MAP = {
    xs: 12,
    sm: 12,
    md: 16,
    lg: 20,
} as const;

export interface ButtonProps {

    /** Button content */
    children?: ReactNode;

    /** Size variant of the button */
    size?: ButtonSize;

    /** Emphasis level of the button */
    emphasis?: ButtonEmphasis;

    /** Visual style variant - inverted for dark backgrounds */
    inverted?: boolean;

    /** Whether the button represents a destructive action */
    destructive?: boolean;

    /** Loading state - shows spinner and disables interaction */
    loading?: boolean;

    /** Icon to display before the button text */
    iconBefore?: ReactNode;

    /** Icon to display after the button text */
    iconAfter?: ReactNode;

    /** Whether the button should take full width of its container */
    fullWidth?: boolean;

    /** Fixed width for the button (e.g., "200px", "10rem") */
    width?: string;
}

type ButtonHTMLProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonProps>;

export interface ButtonComponent extends React.ForwardRefExoticComponent<ButtonProps & ButtonHTMLProps & React.RefAttributes<HTMLButtonElement>> {
    displayName: string;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps & ButtonHTMLProps>(
    (
        {
            children,
            size = 'md',
            emphasis = 'primary',
            inverted = false,
            destructive = false,
            loading = false,
            iconBefore,
            iconAfter,
            fullWidth = false,
            width,
            className,
            disabled,
            ...htmlProps
        },
        ref,
    ) => {
        const isDisabled = disabled || loading;

        const buttonClasses = useMemo(() => classNames(
            'Button',
            `Button--${size}`,
            `Button--${emphasis}`,
            {
                'Button--destructive': destructive,
                'Button--loading': loading,
                'Button--full-width': fullWidth,
                'Button--fixed-width': width,
                'Button--inverted': inverted,
            },
            className,
        ), [size, emphasis, destructive, loading, fullWidth, width, inverted, className]);

        // Separate style from other HTML props to avoid override
        const {style, ...restHtmlProps} = htmlProps;

        const buttonStyle = useMemo(() => {
            return width ? {width, ...style} : style;
        }, [width, style]);

        const iconBeforeClasses = useMemo(() => classNames(
            'Button__icon',
            `Button__icon--${size}`,
            'Button__icon--before',
        ), [size]);

        const iconAfterClasses = useMemo(() => classNames(
            'Button__icon',
            `Button__icon--${size}`,
            'Button__icon--after',
        ), [size]);

        return (
            <button
                ref={ref}
                className={buttonClasses}
                disabled={isDisabled}
                style={buttonStyle}
                aria-busy={loading}
                {...restHtmlProps}
            >
                {loading && (
                    <span className='Button__loading'>
                        <Spinner
                            size={BUTTON_SPINNER_SIZE_MAP[size]}
                            inverted={inverted}
                            aria-label='Loading'
                        />
                    </span>
                )}

                {iconBefore && !loading && (
                    <span className={iconBeforeClasses}>
                        {iconBefore}
                    </span>
                )}

                {children && (
                    <span className='Button__label'>
                        {children}
                    </span>
                )}

                {iconAfter && !loading && (
                    <span className={iconAfterClasses}>
                        {iconAfter}
                    </span>
                )}
            </button>
        );
    },
) as ButtonComponent;

Button.displayName = 'Button';

const MemoButton = memo(Button);
MemoButton.displayName = 'Button';

export default MemoButton;
