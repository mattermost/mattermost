// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {css} from 'styled-components';

export const iconButtonDefinitions = {
    xs: {
        compactSpacing: 4, // 50
        spacing: 6, // 75
        iconSize: 12,
        fontSize: 12, // 75
    },
    sm: {
        compactSpacing: 6, // 75
        spacing: 8, // 100
        iconSize: 16,
        fontSize: 14, // 100
    },
    md: {
        compactSpacing: 8, // 100
        spacing: 10, // 125
        iconSize: 20,
        fontSize: 14, // 100
    },
    lg: {
        compactSpacing: 8, // 100
        spacing: 10, // 125
        iconSize: 28,
        fontSize: 16, // 200
    },
} as const;

const theme = {
    palette: {
        primary: {
            main: 'var(--sidebar-header-bg-rgb)',
            contrast: 'var(--sidebar-header-text-color-rgb)',
        },
        alert: {
            main: 'var(--dnd-indicator-rgb)',
            contrast: '255, 255, 255',
        },
    },
    action: {
        hover: 'var(--sidebar-header-text-color-rgb)',
        disabled: 'var(--sidebar-header-text-color-rgb)',
    },
    text: {
        primary: 'var(--sidebar-header-text-color-rgb)',
    },
    animation: {
        fast: 250,
    },
};

export type IconButtonRootProps = {
    size: 'xs' | 'sm' | 'md' | 'lg';
    compact?: boolean;
    inverted?: boolean;
    toggled?: boolean;
    active?: boolean;
    destructive?: boolean;
    disabled?: boolean;
};

export const IconButtonRoot = styled.button((props: IconButtonRootProps) => {
    const {
        size,
        compact,
        inverted,
        toggled,
        active,
        destructive,
        disabled,
    } = props;
    const {palette, action, text, animation} = theme;

    const isDefault = !inverted && !destructive && !toggled;
    const {main, contrast} = destructive && !toggled ? palette.alert : palette.primary;
    const {spacing, compactSpacing, fontSize} = iconButtonDefinitions[size];

    const colors: Record<string, string> = {
        background: main,
        text: toggled ? contrast : text.primary,
    };

    const opacities: Record<string, Record<string, number>> = {
        background: {
            default: toggled ? 1 : 0,
            hover: toggled ? 0.92 : 0.08,
            active: inverted ? 0.16 : 0.08,
        },
        text: {
            default: toggled ? 1 : 0.56,
            hover: toggled ? 1 : 0.72,
            active: 1,
        },
    };

    if (inverted) {
        colors.background = contrast;
        colors.text = toggled ? main : contrast;
    }

    if (destructive && !toggled) {
        colors.background = main;
        colors.text = inverted ? contrast : main;

        opacities.background.hover = inverted ? 0.8 : 0.08;
        opacities.background.active = inverted ? 1 : 0.16;
    }

    // override some values for disabled icon-buttons
    if (disabled) {
        // set colors to the 'disabled'-grey
        colors.text = action.disabled;

        // icon and text are slightly opaque with disabled buttons
        opacities.background.default = 0;
        opacities.text.default = 0.32;
    }

    const activeStyles = css`
        background: rgba(${colors.background}, ${opacities.background.active});
        color: rgba(${inverted ? contrast : main}, ${opacities.text.active});
    `;

    let actionStyles;
    if (disabled) {
        actionStyles = css`
            cursor: not-allowed;
        `;
    } else {
        actionStyles = css`
            :hover {
                background: rgba(${isDefault ? action.hover : colors.background}, ${opacities.background.hover});
                color: rgba(${colors.text}, ${opacities.text.hover});
            }

            :active {
                ${activeStyles};
            }

            &:focus {
                box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.32),
                    inset 0 0 0 2px rgb(${destructive ? palette.alert.main : main});
            }

            &:focus:not(:focus-visible) {
                box-shadow: none;
            }

            &:focus-visible {
                box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.32),
                    inset 0 0 0 2px rgb(${destructive ? palette.alert.main : main});
            }
        `;
    }

    return css`
        border: none;
        margin: 0;
        // padding: 0;
        width: auto;
        overflow: visible;
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: inherit;
        outline: none;

        display: flex;
        align-items: center;
        justify-content: center;

        cursor: pointer;

        color: rgba(${colors.text}, ${opacities.text.default});
        background: rgba(${colors.background}, ${opacities.background.default});

        border-radius: 4px;
        padding: ${compact ? compactSpacing : spacing}px;

        span {
            margin-left: 6px; // 75
            font-family: Open Sans, sans-serif;
            font-size: ${fontSize}px;
            font-weight: 600;
            line-height: inherit;
        }

        ${actionStyles};

        ${active && activeStyles}

        transition: background ${animation.fast} ease-in-out,
                color ${animation.fast} ease-in-out, box-shadow ${animation.fast} ease-in-out;
    `;
});
