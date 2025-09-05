// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {forwardRef, memo} from 'react';
import type {ButtonHTMLAttributes, ReactNode} from 'react';

import './button.scss';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';
export type ButtonEmphasis = 'primary' | 'secondary' | 'tertiary' | 'quaternary' | 'link';
// Removed ButtonStyle type - now using inverted boolean prop

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
            className,
            disabled,
            ...htmlProps
        },
        ref,
    ) => {
        const isDisabled = disabled || loading;
        
        const buttonClasses = classNames(
            'Button',
            `Button--${size}`,
            `Button--${emphasis}`,
            {
                'Button--destructive': destructive,
                'Button--loading': loading,
                'Button--full-width': fullWidth,
                'Button--inverted': inverted,
            },
            className,
        );

        return (
            <button
                ref={ref}
                className={buttonClasses}
                disabled={isDisabled}
                {...htmlProps}
            >
                {iconBefore && (
                    <span className="Button__icon Button__icon--before">
                        {iconBefore}
                    </span>
                )}
                
                {children && (
                    <span className="Button__label">
                        {children}
                    </span>
                )}
                
                {loading && (
                    <span className="Button__loading">
                        <i className="spinner" />
                    </span>
                )}
                
                {iconAfter && !loading && (
                    <span className="Button__icon Button__icon--after">
                        {iconAfter}
                    </span>
                )}
            </button>
        );
    },
) as ButtonComponent;

Button.displayName = 'Button';

export default memo(Button);
