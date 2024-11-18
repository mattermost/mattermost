// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import MuiMenuList from '@mui/material/MenuList';
import React, {
    useState,
    useEffect,
    useCallback,
} from 'react';
import type {
    ReactNode,
    MouseEvent,
    KeyboardEvent,
} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';

import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import {openModal, closeModal} from 'actions/views/modals';
import {getIsMobileView} from 'selectors/views/browser';

import CompassDesignProvider from 'components/compass_design_provider';
import WithTooltip from 'components/with_tooltip';

import Constants, {A11yClassNames} from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';

import {MenuContext, useMenuContextValue} from './menu_context';
import {MuiMenuStyled} from './menu_styled';

const MENU_OPEN_ANIMATION_DURATION = 150;
const MENU_CLOSE_ANIMATION_DURATION = 100;

type MenuButtonProps = {
    id: string;
    dateTestId?: string;
    'aria-label'?: string;
    disabled?: boolean;
    class?: string;
    as?: keyof JSX.IntrinsicElements;
    children: ReactNode;
}

type MenuButtonTooltipProps = {
    id: string;
    placement?: 'top' | 'bottom' | 'left' | 'right';
    class?: string;
    text: string;
}

type MenuProps = {
    id: string;
    'aria-label'?: string;

    /**
     * @warning Make the styling of your components such a way that they dont need this handler
     */
    onToggle?: (isOpen: boolean) => void;
    onKeyDown?: (event: KeyboardEvent<HTMLDivElement>, forceCloseMenu?: () => void) => void;
    width?: string;
}

const defaultAnchorOrigin = {vertical: 'bottom', horizontal: 'left'};
const defaultTransformOrigin = {vertical: 'top', horizontal: 'left'};

type VerticalOrigin = 'top' | 'center' | 'bottom';
type HorizontalOrigin = 'left' | 'center' | 'right';

interface Props {
    menuButton: MenuButtonProps;
    menuButtonTooltip?: MenuButtonTooltipProps;
    menu: MenuProps;
    children: ReactNode[];

    // Use MUI Anchor Playgroup to try various anchorOrigin
    // and transformOrigin values - https://mui.com/material-ui/react-popover/#anchor-playground
    anchorOrigin?: {
        vertical: VerticalOrigin;
        horizontal: HorizontalOrigin;
    };
    transformOrigin?: {
        vertical: VerticalOrigin;
        horizontal: HorizontalOrigin;
    };
    hideTooltipWhenDisabled?: boolean;
}

/**
 * @example
 * import * as Menu from 'components/menu';
 *
 * <Menu.Container>
 *  <Menu.Item>
 *  <Menu.Item>
 *  <Menu.Separator/>
 * </Menu.Item>
 */
export function Menu(props: Props) {
    const theme = useSelector(getTheme);

    const isMobileView = useSelector(getIsMobileView);

    const dispatch = useDispatch();

    const [anchorElement, setAnchorElement] = useState<null | HTMLElement>(null);
    const [disableAutoFocusItem, setDisableAutoFocusItem] = useState(false);
    const isMenuOpen = Boolean(anchorElement);

    // Callback funtion handler called when menu is closed by escapeKeyDown, backdropClick or tabKeyDown
    function handleMenuClose(event: MouseEvent<HTMLDivElement>) {
        event.preventDefault();
        setAnchorElement(null);
        setDisableAutoFocusItem(false);
    }

    // Handle function injected into menu items to close the menu
    const closeMenu = useCallback(() => {
        setAnchorElement(null);
        setDisableAutoFocusItem(false);
    }, []);

    function handleMenuModalClose(modalId: MenuProps['id']) {
        dispatch(closeModal(modalId));
        setAnchorElement(null);
    }

    // Stop sythetic events from bubbling up to the parent
    // @see https://github.com/mui/material-ui/issues/32064
    function handleMenuClick(e: MouseEvent<HTMLLIElement> | KeyboardEvent<HTMLLIElement>) {
        e.stopPropagation();
    }

    function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (isKeyPressed(event, Constants.KeyCodes.ENTER) || isKeyPressed(event, Constants.KeyCodes.SPACE)) {
            const target = event.target as HTMLElement;
            const ariaHasPopupAttribute = target?.getAttribute('aria-haspopup') === 'true';
            const ariaHasExpandedAttribute = target?.getAttribute('aria-expanded') === 'true';

            if (ariaHasPopupAttribute && ariaHasExpandedAttribute) {
                // Avoid closing the sub menu item on enter
            } else {
                setAnchorElement(null);
            }
        }

        if (props.menu.onKeyDown) {
            // We need to pass the closeMenu function to the onKeyDown handler so that the menu can be closed manually
            // This is helpful for cases when menu needs to be closed after certain keybindings are pressed in components which uses menu
            // This however is not the case for mouse events as they are handled/closed by menu item click handlers
            props.menu.onKeyDown(event, closeMenu);
        }
    }

    function handleMenuButtonClick(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();

        if (isMobileView) {
            dispatch(
                openModal<MenuModalProps>({
                    modalId: props.menu.id,
                    dialogType: MenuModal,
                    dialogProps: {
                        menuButtonId: props.menuButton.id,
                        menuId: props.menu.id,
                        menuAriaLabel: props.menu?.['aria-label'] ?? '',
                        onModalClose: handleMenuModalClose,
                        children: props.children,
                        onKeyDown: props.menu.onKeyDown,
                    },
                }),
            );
        } else {
            setAnchorElement(event.currentTarget as HTMLElement);
        }
    }

    // Function to prevent focus-visible from being set on clicking menu items with the mouse
    function handleMenuButtonMouseDown() {
        setDisableAutoFocusItem(true);
    }

    // We construct the menu button so we can set onClick correctly here to support both web and mobile view
    function renderMenuButton() {
        const MenuButtonComponent = props.menuButton?.as ?? 'button';

        const triggerElement = (
            <MenuButtonComponent
                id={props.menuButton.id}
                data-testid={props.menuButton.dateTestId}
                aria-controls={props.menu.id}
                aria-haspopup={true}
                aria-expanded={isMenuOpen}
                disabled={props.menuButton?.disabled ?? false}
                aria-label={props.menuButton?.['aria-label'] ?? ''}
                className={props.menuButton?.class ?? ''}
                onClick={handleMenuButtonClick}
                onMouseDown={handleMenuButtonMouseDown}
            >
                {props.menuButton.children}
            </MenuButtonComponent>
        );

        if (props.menuButtonTooltip && props.menuButtonTooltip.text && !isMobileView) {
            return (
                <WithTooltip
                    id={props.menuButtonTooltip.id}
                    title={props.menuButtonTooltip.text}
                    placement={props?.menuButtonTooltip?.placement ?? 'top'}
                    disabled={props.hideTooltipWhenDisabled ? props.menuButton.disabled || isMenuOpen : isMenuOpen}
                >
                    {triggerElement}
                </WithTooltip>
            );
        }

        return triggerElement;
    }

    useEffect(() => {
        if (props.menu.onToggle) {
            props.menu.onToggle(isMenuOpen);
        }
    }, [isMenuOpen]);

    const providerValue = useMenuContextValue(closeMenu, Boolean(anchorElement));

    if (isMobileView) {
        // In mobile view, the menu is rendered as a modal
        return renderMenuButton();
    }

    return (
        <CompassDesignProvider theme={theme}>
            {renderMenuButton()}
            <MenuContext.Provider value={providerValue}>
                <MuiMenuStyled
                    anchorEl={anchorElement}
                    open={isMenuOpen}
                    onClose={handleMenuClose}
                    onClick={handleMenuClick}
                    onTransitionExited={providerValue.handleClosed}
                    onKeyDown={handleMenuKeyDown}
                    className={A11yClassNames.POPUP}
                    width={props.menu.width}
                    anchorOrigin={props.anchorOrigin || defaultAnchorOrigin}
                    transformOrigin={props.transformOrigin || defaultTransformOrigin}
                    disableAutoFocusItem={disableAutoFocusItem} // This is not anti-pattern, see handleMenuButtonMouseDown
                    MenuListProps={{
                        id: props.menu.id,
                        'aria-label': props.menu?.['aria-label'] ?? '',
                    }}
                    TransitionProps={{
                        mountOnEnter: true,
                        unmountOnExit: true,
                        timeout: {
                            enter: MENU_OPEN_ANIMATION_DURATION,
                            exit: MENU_CLOSE_ANIMATION_DURATION,
                        },
                    }}
                >
                    {props.children}
                </MuiMenuStyled>
            </MenuContext.Provider>
        </CompassDesignProvider>
    );
}

interface MenuModalProps {
    menuButtonId: MenuButtonProps['id'];
    menuId: MenuProps['id'];
    menuAriaLabel: MenuProps['aria-label'];
    onModalClose: (modalId: MenuProps['id']) => void;
    children: Props['children'];
    onKeyDown?: MenuProps['onKeyDown'];
}

function MenuModal(props: MenuModalProps) {
    const theme = useSelector(getTheme);

    function closeMenuModal() {
        props.onModalClose(props.menuId);
    }

    function handleModalClickCapture(event: MouseEvent<HTMLDivElement>) {
        if (event && event.currentTarget.contains(event.target as Node)) {
            for (const currentElement of event.currentTarget.children) {
                if (currentElement.contains(event.target as Node) && !currentElement.ariaHasPopup) {
                    // We check for property ariaHasPopup because we don't want to close the menu
                    // if the user clicks on a submenu item or menu item which open modal. And let submenu component handle the click.
                    closeMenuModal();
                    break;
                }
            }
        }
    }

    function handleKeydown(event?: React.KeyboardEvent<HTMLDivElement>) {
        if (event && props.onKeyDown) {
            props.onKeyDown(event, closeMenuModal);
        }
    }

    return (
        <CompassDesignProvider theme={theme}>
            <GenericModal
                id={props.menuId}
                className='menuModal'
                backdrop={true}
                ariaLabel={props.menuAriaLabel}
                onExited={closeMenuModal}
                enforceFocus={false}
                handleKeydown={handleKeydown}
            >
                <MuiMenuList // serves as backdrop for modals
                    component='div'
                    aria-labelledby={props.menuButtonId}
                    onClick={handleModalClickCapture}
                >
                    {props.children}
                </MuiMenuList>
            </GenericModal>
        </CompassDesignProvider>
    );
}
