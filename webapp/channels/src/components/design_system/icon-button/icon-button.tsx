// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {forwardRef, memo} from 'react';
import type {ButtonHTMLAttributes, ReactNode} from 'react';

import './icon-button.scss';

export type IconButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
    /** Icon size and overall button dimensions */
    size?: IconButtonSize;
    
    /** Internal padding variation */
    padding?: 'default' | 'compact';
    
    /** Toggle state for buttons that can be toggled on/off */
    toggled?: boolean;
    
    /** Destructive action styling (error/danger color scheme) */
    destructive?: boolean;
    
    /** Visual style variant - inverted for dark backgrounds */
    inverted?: boolean;
    
    /** Border radius style */
    rounded?: boolean;
    
    /** Icon to display (React component, SVG, or icon identifier) */
    icon: ReactNode | string;
    
    /** Accessible label for screen readers */
    'aria-label': string;
    
    /** Optional tooltip text */
    title?: string;
    
    /** Click handler */
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    
    /** Disabled state */
    disabled?: boolean;
    
    /** Loading state - shows spinner and disables interaction */
    loading?: boolean;
    
    /** Additional CSS classes */
    className?: string;
    
    /** Button type */
    type?: 'button' | 'submit' | 'reset';
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
    ({ 
        size = 'md',
        padding = 'default',
        toggled = false,
        destructive = false,
        inverted = false,
        rounded = false,
        icon,
        disabled = false,
        loading = false,
        className,
        'aria-label': ariaLabel,
        ...htmlProps 
    }, ref) => {
        const isDisabled = disabled || loading;
        
        const buttonClasses = classNames(
            'IconButton',
            `IconButton--${size}`,
            {
                'IconButton--toggled': toggled,
                'IconButton--destructive': destructive,
                'IconButton--inverted': inverted,
                'IconButton--rounded': rounded,
                'IconButton--compact': padding === 'compact',
                'IconButton--loading': loading,
            },
            className,
        );

        return (
            <button
                ref={ref}
                className={buttonClasses}
                disabled={isDisabled}
                aria-label={ariaLabel}
                aria-pressed={toggled}
                {...htmlProps}
            >
                {loading ? (
                    <span
                        className={classNames(
                            'IconButton__spinner',
                            `IconButton__spinner--${size}`,
                            {
                                'IconButton__spinner--inverted': inverted,
                            },
                        )}
                    />
                ) : (
                    <span className={`IconButton__icon IconButton__icon--${size}`}>
                        {icon}
                    </span>
                )}
            </button>
        );
    }
);

IconButton.displayName = 'IconButton';

export default memo(IconButton);
export type {IconButtonProps};