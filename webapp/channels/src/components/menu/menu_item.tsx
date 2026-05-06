// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import MuiMenuItem from '@mui/material/MenuItem';
import type {MenuItemProps as MuiMenuItemProps} from '@mui/material/MenuItem';
import {styled} from '@mui/material/styles';
import cloneDeep from 'lodash/cloneDeep';
import React, {
    Children,
    forwardRef,
    useContext,
    useRef,
} from 'react';
import type {
    ReactElement,
    ReactNode,
    KeyboardEvent,
    MouseEvent,
    AriaRole,
} from 'react';
import {useSelector} from 'react-redux';

import {getIsMobileView} from 'selectors/views/browser';

import Constants, {EventTypes} from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';

import {MenuContext, SubMenuContext} from './menu_context';

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

    onClick?: (event: MouseEvent<HTMLLIElement> | KeyboardEvent<HTMLLIElement>) => void;

    role?: AriaRole;

    forceCloseOnSelect?: boolean;

    /**
     * When true, selecting this item will not close the menu.
     * Inverse of forceCloseOnSelect for non-checkbox/radio roles.
     */
    disableCloseOnSelect?: boolean;

    /**
     * ONLY to support submenus. Avoid passing children to this component. Support for children is only added to support submenus.
     */
    children?: ReactNode;
}

/**
 * The props for the first menu item to be passed in.
 * @example
 * <Menu.Container>
 *     <WrapperOfMenuFirstItem/> <-- Container passes the props to the first item
 *     <Menu.Item/>
 * </Menu.Container>
 */
export type FirstMenuItemProps = Omit<
Props,
| 'onClick'
| 'leadingElement'
| 'labels'
| 'trailingElements'
| 'isDestructive'
| 'isLabelsRowLayout'
| 'children'
>;

/**
 * To be used as a child of Menu component.
 * Checkout Compass's Menu Item(compass.mattermost.com) for terminology, styling and usage guidelines.
 *
 * @example <caption>Using a menu in a component</caption>
 * <Menu.Container>
 *     <Menu.Item/>
 * </Menu.Container>
 * @example <caption>Wrapping a menu item in another component</caption>
 * // Remember to pass all unused props into the Menu.Item to ensure MUI props for a11y are passed properly
 * const ConsoleLogItem = ({message, ...otherProps}) => ({
 *     <Menu.Item
 *         onClick={() => console.log(message)}
 *         {...otherProps}
 *     />
 * });
 *
 */
export const MenuItem = forwardRef<HTMLLIElement, Props>((props, ref) => {
    const {
        leadingElement,
        labels,
        trailingElements,
        isDestructive,
        isLabelsRowLayout,
        children,
        onClick,
        role = 'menuitem',
        forceCloseOnSelect = false,
        disableCloseOnSelect = false,
        ...otherProps
    } = props;

    const menuContext = useContext(MenuContext);
    const subMenuContext = useContext(SubMenuContext);

    const isMobileView = useSelector(getIsMobileView);

    // MUI ButtonBase calls both onKeyDown and onClick with the same
    // keydown event for Enter, so handleClick runs twice per activation.
    // Dedupe by native event identity — no timing hacks needed, and the
    // ref is naturally cleared when a new event comes through.
    const lastHandledEventRef = useRef<Event | null>(null);

    function handleClick(event: MouseEvent<HTMLLIElement> | KeyboardEvent<HTMLLIElement>) {
        if (isCorrectKeyPressedOnMenuItem(event)) {
            // If the menu item is a checkbox or radio button, we don't want to close the menu when it is clicked.
            // unless forceCloseOnSelect is set to true.
            // see https://www.w3.org/WAI/ARIA/apg/patterns/menubar/
            if (disableCloseOnSelect || (isRoleCheckboxOrRadio(role) && !forceCloseOnSelect)) {
                event.stopPropagation();
            } else {
                // close submenu first if it is open
                if (subMenuContext.close) {
                    subMenuContext.close();
                }

                // And then close the menu
                if (menuContext.close) {
                    menuContext.close();
                }
            }

            if (onClick && event.nativeEvent !== lastHandledEventRef.current) {
                lastHandledEventRef.current = event.nativeEvent;

                // Execute immediately when the menu isn't closing on select
                // (mobile modal, checkbox/radio, or disableCloseOnSelect).
                // Otherwise defer to after the close animation.
                if (isMobileView || isRoleCheckboxOrRadio(role) || disableCloseOnSelect) {
                    onClick(event);
                } else {
                    // Clone the event since we delay the click handler until after the menu has closed.
                    const clonedEvent = cloneDeep(event);

                    menuContext.addOnClosedListener(() => {
                        onClick(clonedEvent);
                    });
                }
            }
        }
    }

    // When both primary and secondary labels are passed, we need to apply minor changes to the styling. Check below in styled component for more details.
    // we count after converting to array as it removes falsy values from labels.props.children
    const hasSecondaryLabel = labels &&
        labels.props &&
        labels.props.children &&
        Children.count(Children.toArray(labels.props.children)) === 2;

    return (
        <MenuItemStyled
            ref={ref}
            disableRipple={true}
            disableTouchRipple={true}
            isDestructive={isDestructive}
            hasSecondaryLabel={hasSecondaryLabel}
            isLabelsRowLayout={isLabelsRowLayout}
            onClick={handleClick}
            onKeyDown={handleClick}
            role={role}
            {...otherProps}
        >
            {leadingElement && <div className='leading-element'>{leadingElement}</div>}
            <div className='label-elements'>{labels}</div>
            {trailingElements && <div className='trailing-elements'>{trailingElements}</div>}
            {children}
        </MenuItemStyled>
    );
});
MenuItem.displayName = 'MenuItem';

interface MenuItemStyledProps extends MuiMenuItemProps {
    isDestructive?: boolean;
    hasSecondaryLabel?: boolean;
    isLabelsRowLayout?: boolean;
}

export const MenuItemStyled = styled(MuiMenuItem, {
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
                '&.Mui-focusVisible .leading-element, &.Mui-focusVisible .trailing-elements': {
                    color: isDestructive && 'var(--button-color)',
                },

                '&>.leading-element': {
                    width: '18px',
                    height: '18px',
                    marginInlineEnd: '10px',
                    color: isRegular ? 'rgba(var(--center-channel-color-rgb), 0.64)' : 'var(--error-text)',
                },
                '&:hover .leading-element': {
                    color: isRegular ? 'rgba(var(--center-channel-color-rgb), 0.8)' : 'var(--button-color)',
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
                    color: isRegular ? 'rgba(var(--center-channel-color-rgb), 0.75)' : 'var(--error-text)',
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
                    color: isRegular ? 'rgba(var(--center-channel-color-rgb), 0.75)' : 'var(--error-text)',
                    marginInlineStart: '24px',
                    gap: '4px',
                    fontSize: '12px',
                    lineHeight: '16px',
                    alignItems: 'center',
                },
                '&:hover .trailing-elements': {
                    color: isRegular ? 'rgba(var(--center-channel-color-rgb), 0.75)' : 'var(--button-color)',
                },
            },
        });
    },
);

/**
 * Checks if the menu item was activated per WAI-ARIA guidelines.
 * Returns true for primary mouse click or Enter/Space keydown.
 */
function isCorrectKeyPressedOnMenuItem(event: MouseEvent<HTMLLIElement> | KeyboardEvent<HTMLLIElement>) {
    if (event.type === EventTypes.KEY_DOWN) {
        const keyboardEvent = event as KeyboardEvent<HTMLLIElement>;
        return isKeyPressed(keyboardEvent, Constants.KeyCodes.ENTER) || isKeyPressed(keyboardEvent, Constants.KeyCodes.SPACE);
    }
    if (event.type === EventTypes.CLICK) {
        return (event as MouseEvent<HTMLLIElement>).button === 0;
    }
    return false;
}

function isRoleCheckboxOrRadio(role: AriaRole) {
    return role === 'menuitemcheckbox' || role === 'menuitemradio';
}

