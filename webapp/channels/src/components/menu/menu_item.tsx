// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactElement, ReactNode, Children, KeyboardEvent, MouseEvent} from 'react';
import {styled} from '@mui/material/styles';
import MuiMenuItem from '@mui/material/MenuItem';
import type {MenuItemProps as MuiMenuItemProps} from '@mui/material/MenuItem';

import Constants from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';

export interface Props extends MuiMenuItemProps {

    /**
     * To support quick recognition of menu item. Could be icon, avatar or emoji.
     */
    leadingElement?: ReactNode;

    /**
     * There can be two labels for a menu item - primaryLabel and secondaryLabel.
     * If only one element is passed, it will be primaryLabel. And if another element is passed, it will be secondaryLabel.
     * @example
     * <Menu.Item labels={<FormattedMessage id="primary.label" defaultMessage="primary Label"/>}/>
     *
     * @example
     * <Menu.Item labels={
     *  <>
     *   <FormattedMessage id="primary.label" defaultMessage="primary Label"/>
     *   <FormattedMessage id="secondary.label" defaultMessage="secondary Label"/>
     * </>
     * }/>
     *
     * @note
     * Wraps the labels with element such as span, div etc. to support styling instead of passing text node directly.
     */
    labels: ReactElement;

    /**
     * for some cases we have explicit requirement for labels to be in row instead of stack
     */
    isLabelsRowLayout?: boolean;

    /**
     * The meta data element to display extra information about menu item. Could be chevron, shortcut or badge.
     * It is formed with subMenuDetail and trailingElement. If only one is passed, it will be tailingElement. If two are
     * passed, first will be subMenuDetail and second will be trailingElement.
     *
     * @example
     * <Menu.Item trailingElements={<ChevronRightIcon/>}/>
     *
     * @example
     * <Menu.Item trailingElements={
     *  <>
     *   <FormattedMessage id="submenu.detail" defaultMessage="submenu detail"/>
     *   <ChevronRightIcon/>
     * </>
     * }/>
     */
    trailingElements?: ReactNode;

    /**
     * For actions of menu item that are destructive in nature and harder to undo.
     */
    isDestructive?: boolean;

    onClick: (event: MouseEvent<HTMLLIElement> | KeyboardEvent<HTMLLIElement>) => void;

    /**
     * ONLY to support submenus. Avoid passing children to this component. Support for children is only added to support submenus.
     */
    children?: ReactNode;
}

/**
 * To be used as a child of Menu component.
 * Checkout Compass's Menu Item(compass.mattermost.com)  for terminology, styling and usage guidelines.
 *
 * @example
 * <Menu.Container>
 *    <Menu.Item/>
 * </Menu.Container>
 */
export function MenuItem(props: Props) {
    const {
        leadingElement,
        labels,
        trailingElements,
        isDestructive,
        isLabelsRowLayout,
        children,
        onClick,
        ...restProps
    } = props;

    // When both primary and secondary labels are passed, we need to apply minor changes to the styling. Check below in styled component for more details.
    const hasSecondaryLabel = labels && labels.props && labels.props.children && Children.count(labels.props.children) === 2;

    function handleClick(event: MouseEvent<HTMLLIElement> | KeyboardEvent<HTMLLIElement>) {
        if (isCorrectKeyPressedOnMenuItem(event)) {
            onClick(event);
        }
    }

    return (
        <MenuItemStyled
            disableRipple={true}
            disableTouchRipple={true}
            isDestructive={isDestructive}
            hasSecondaryLabel={hasSecondaryLabel}
            isLabelsRowLayout={isLabelsRowLayout}
            onKeyDown={handleClick}
            onMouseDown={handleClick}
            {...restProps}
        >
            {leadingElement && <div className='leading-element'>{leadingElement}</div>}
            <div className='label-elements'>{labels}</div>
            {trailingElements && <div className='trailing-elements'>{trailingElements}</div>}
            {children}
        </MenuItemStyled>
    );
}

interface MenuItemStyledProps extends MuiMenuItemProps {
    isDestructive?: boolean;
    hasSecondaryLabel?: boolean;
    isLabelsRowLayout?: boolean;
}

const MenuItemStyled = styled(MuiMenuItem, {
    shouldForwardProp: (prop) => prop !== 'isDestructive' &&
        prop !== 'hasSecondaryLabel' && prop !== 'isLabelsRowLayout',
})<MenuItemStyledProps>(
    ({isDestructive = false, hasSecondaryLabel = false, isLabelsRowLayout = false}) => {
        const hasOnlyPrimaryLabel = !hasSecondaryLabel;
        const isRegular = !isDestructive;

        return ({
            '&.MuiMenuItem-root': {
                fontFamily: '"Open Sans", sans-serif',
                color: isRegular ? 'var(--center-channel-color)' : 'var(--error-text)',
                padding: '6px 20px',
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'nowrap',
                justifyContent: 'flex-start',
                alignItems: hasOnlyPrimaryLabel || isLabelsRowLayout ? 'center' : 'flex-start',
                minHeight: '36px',
                maxHeight: '56px',

                // aria expanded to add the active styling on parent sub menu item
                '&.Mui-active, &[aria-expanded="true"]': {
                    'background-color': isRegular ? 'rgba(var(--button-bg-rgb), 0.08)' : 'background-color: rgba(var(--error-text-color-rgb), 0.16)',
                },

                '&:hover': {
                    backgroundColor: isRegular ? 'rgba(var(--center-channel-color-rgb), 0.08)' : 'var(--error-text)',
                    color: isDestructive && 'var(--button-color)',
                },

                '&.Mui-disabled': {
                    color: 'rgba(var(--center-channel-color-rgb), 0.32)',
                },

                '&.Mui-focusVisible': {
                    boxShadow: isRegular ? '0 0 0 2px var(--sidebar-text-active-border) inset' : '0 0 0 2px rgba(var(--button-color-rgb), 0.16) inset',
                    backgroundColor: isRegular ? 'var(--center-channel-bg)' : 'var(--error-text)',
                    color: isDestructive && 'var(--button-color)',
                },
                '&.Mui-focusVisible .label-elements>:last-child, &.Mui-focusVisible .label-elements>:first-child, &.Mui-focusVisible .label-elements>:only-child': {
                    color: isDestructive && 'var(--button-color)',
                },
                '&.Mui-focusVisible .leading-element': {
                    color: isDestructive && 'var(--button-color)',
                },

                '&>.leading-element': {
                    width: '18px',
                    height: '18px',
                    marginInlineEnd: '10px',
                    color: isRegular ? 'rgba(var(--center-channel-color-rgb), 0.56)' : 'var(--error-text)',
                },
                '&:hover .leading-element': {
                    color: isRegular ? 'rgba(var(--center-channel-color-rgb), 0.72)' : 'var(--button-color)',
                },

                '&>.label-elements': {
                    display: 'flex',
                    flex: '1 0 auto',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    flexWrap: 'nowrap',
                    alignSelf: 'stretch',
                    fontWeight: 400,
                    textAlign: 'start',
                    gap: '4px',
                    lineHeight: '16px',
                },

                '&>.label-elements>:last-child': {
                    fontSize: '12px',
                    color: isRegular ? 'rgba(var(--center-channel-color-rgb), 0.56)' : 'var(--error-text)',
                },
                '&:hover .label-elements>:last-child': {
                    color: isDestructive && 'var(--button-color)',
                },

                '&>.label-elements>:first-child, &>.label-elements>:only-child': {
                    fontSize: '14px',
                    color: isRegular ? 'var(--center-channel-color)' : 'var(--error-text)',
                },
                '&:hover .label-elements>:first-child, &:hover .label-elements>:only-child': {
                    color: isDestructive && 'var(--button-color)',
                },

                '&>.trailing-elements': {
                    display: 'flex',
                    flexDirection: 'row',
                    flexWrap: 'nowrap',
                    justifyContent: 'flex-end',
                    color: isRegular ? 'rgba(var(--center-channel-color-rgb), 0.56)' : 'var(--error-text)',
                    gap: '4px',
                    marginInlineStart: '24px',
                    fontSize: '12px',
                    lineHeight: '16px',
                    alignItems: 'center',
                },
                '&:hover .trailing-elements': {
                    color: isRegular ? 'rgba(var(--center-channel-color-rgb), 0.72)' : 'var(--button-color)',
                },
            },
        });
    },
);

/**
 * Use this function to check if the menu item was pressed as per WAI-ARIA guidelines.
 * @param event - The event to check if the menu item was pressed by mouse or keyboard. Either a mouse event or a keyboard event.
 * @returns true if the menu item was pressed by mouse's "Primary" key or keyboard's "Space" or "Enter" key
 **/
function isCorrectKeyPressedOnMenuItem(event: MouseEvent<HTMLLIElement> | KeyboardEvent<HTMLLIElement>) {
    if (event.type === 'keydown') {
        const keyboardEvent = event as KeyboardEvent<HTMLLIElement>;
        if (isKeyPressed(keyboardEvent, Constants.KeyCodes.ENTER) || isKeyPressed(keyboardEvent, Constants.KeyCodes.SPACE)) {
            return true;
        }

        return false;
    } else if (event.type === 'mousedown') {
        const mouseEvent = event as MouseEvent<HTMLLIElement>;
        if (mouseEvent.button === 0) {
            return true;
        }

        return false;
    }

    return false;
}
