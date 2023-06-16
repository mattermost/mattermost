// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    ReactNode,
    useState,
    MouseEvent,
    useEffect,
    KeyboardEvent,
    SyntheticEvent,
} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import MuiMenuList from '@mui/material/MenuList';

import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import {getIsMobileView} from 'selectors/views/browser';

import {openModal, closeModal} from 'actions/views/modals';

import Constants, {A11yClassNames} from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';

import CompassDesignProvider from 'components/compass_design_provider';
import Tooltip from 'components/tooltip';
import OverlayTrigger from 'components/overlay_trigger';
import {GenericModal} from '@mattermost/components';

import {MuiMenuStyled} from './menu_styled';
import {MenuContext} from './menu_context';

const OVERLAY_TIME_DELAY = 500;
const MENU_OPEN_ANIMATION_DURATION = 150;
export const MENU_CLOSE_ANIMATION_DURATION = 100;

type MenuButtonProps = {
    id: string;
    dateTestId?: string;
    'aria-label'?: string;
    class?: string;
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

interface Props {
    menuButton: MenuButtonProps;
    menuButtonTooltip?: MenuButtonTooltipProps;
    menu: MenuProps;
    children: ReactNode[];
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
    // Also passed on to keydown handler for menu items, in case they want to close the menu
    function closeMenu(): void {
        setAnchorElement(null);
        setDisableAutoFocusItem(false);
    }

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
            const ariaHasExpandedAttribute = target?.getAttribute('aria-expanded') !== null ?? false;

            if (ariaHasPopupAttribute && ariaHasExpandedAttribute) {
                // Avoid closing the sub menu item on enter
            } else {
                setAnchorElement(null);
            }
        }

        if (props.menu.onKeyDown) {
            props.menu.onKeyDown(event, closeMenu);
        }
    }

    function handleMenuButtonClick(event: SyntheticEvent<HTMLButtonElement>) {
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
            setAnchorElement(event.currentTarget);
        }
    }

    // Function to prevent focus-visible from being set on clicking menu items with the mouse
    function handleMenuButtonMouseDown() {
        setDisableAutoFocusItem(true);
    }

    // We construct the menu button so we can set onClick correctly here to support both web and mobile view
    function renderMenuButton() {
        const triggerElement = (
            <button
                id={props.menuButton.id}
                data-testid={props.menuButton.dateTestId}
                aria-controls={props.menu.id}
                aria-haspopup={true}
                aria-expanded={isMenuOpen}
                aria-label={props.menuButton?.['aria-label'] ?? ''}
                className={props.menuButton?.class ?? ''}
                onClick={handleMenuButtonClick}
                onMouseDown={handleMenuButtonMouseDown}
            >
                {props.menuButton.children}
            </button>
        );

        if (props.menuButtonTooltip && props.menuButtonTooltip.text && !isMobileView) {
            return (
                <OverlayTrigger
                    delayShow={OVERLAY_TIME_DELAY}
                    placement={props?.menuButtonTooltip?.placement ?? 'top'}
                    overlay={
                        <Tooltip
                            id={props.menuButtonTooltip.id}
                            className={props.menuButtonTooltip?.class ?? ''}
                        >
                            {props.menuButtonTooltip.text}
                        </Tooltip>
                    }
                    disabled={isMenuOpen}
                >
                    {triggerElement}
                </OverlayTrigger>
            );
        }

        return triggerElement;
    }

    useEffect(() => {
        if (props.menu.onToggle) {
            props.menu.onToggle(isMenuOpen);
        }
    }, [isMenuOpen]);

    if (isMobileView) {
        // In mobile view, the menu is rendered as a modal
        return renderMenuButton();
    }

    return (
        <CompassDesignProvider theme={theme}>
            {renderMenuButton()}
            <MuiMenuStyled
                anchorEl={anchorElement}
                open={isMenuOpen}
                onClose={handleMenuClose}
                onClick={handleMenuClick}
                onKeyDown={handleMenuKeyDown}
                className={A11yClassNames.POPUP}
                width={props.menu.width}
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
                <MenuContext.Provider value={{close: closeMenu, isOpen: isMenuOpen}}>
                    {props.children}
                </MenuContext.Provider>
            </MuiMenuStyled>
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
