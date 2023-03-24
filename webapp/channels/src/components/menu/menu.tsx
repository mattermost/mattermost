// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    ReactNode,
    useState,
    MouseEvent,
    useEffect,
    KeyboardEvent,
    SyntheticEvent,
    KeyboardEventHandler,
} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import MuiMenuList from '@mui/material/MenuList';

import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import {getIsMobileView} from 'selectors/views/browser';

import {openModal, closeModal} from 'actions/views/modals';

import Constants, {A11yClassNames} from 'utils/constants';
import {isKeyPressed} from 'utils/utils';

import CompassDesignProvider from 'components/compass_design_provider';
import Tooltip from 'components/tooltip';
import OverlayTrigger from 'components/overlay_trigger';
import GenericModal from 'components/generic_modal';

import {MuiMenuStyled} from './menu_styled';

const OVERLAY_TIME_DELAY = 500;
const MENU_OPEN_ANIMATION_DURATION = 150;
const MENU_CLOSE_ANIMATION_DURATION = 100;

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
    closeMenuManually?: boolean;
    onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
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

    function handleMenuClose(event: MouseEvent<HTMLDivElement>) {
        event.preventDefault();
        setAnchorElement(null);
        setDisableAutoFocusItem(false);
    }

    function handleMenuModalClose(modalId: MenuProps['id']) {
        dispatch(closeModal(modalId));
        setAnchorElement(null);
    }

    function handleMenuClick() {
        setAnchorElement(null);
    }

    useEffect(() => {
        if (props.menu.closeMenuManually) {
            setAnchorElement(null);
            if (isMobileView) {
                handleMenuModalClose(props.menu.id);
            }
        }
    }, [props.menu.closeMenuManually]);

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
        props.menu.onKeyDown?.(event);
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

    function handleMenuButtonMouseDown() {
        // This is needed to prevent focus-visible being set on clicking menuitems with mouse
        setDisableAutoFocusItem(true);
    }

    function renderMenuButton() {
        // We construct the menu button so we can set onClick correctly here to support both web and mobile view
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
                width={props.menu.width}
            >
                {props.children}
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
    onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
}

function MenuModal(props: MenuModalProps) {
    const theme = useSelector(getTheme);

    function handleModalExited() {
        props.onModalClose(props.menuId);
    }

    function handleModalClickCapture(event: MouseEvent<HTMLDivElement>) {
        if (event && event.currentTarget.contains(event.target as Node)) {
            for (const currentElement of event.currentTarget.children) {
                if (currentElement.contains(event.target as Node) && !currentElement.ariaHasPopup) {
                    // We check for property ariaHasPopup because we don't want to close the menu
                    // if the user clicks on a submenu item or menu item which open modal. And let submenu component handle the click.
                    handleModalExited();
                    break;
                }
            }
        }
    }
    function handleKeydown(event?: React.KeyboardEvent<HTMLDivElement>) {
        if (event && props.onKeyDown) {
            props.onKeyDown(event);
        }
    }

    return (
        <CompassDesignProvider theme={theme}>
            <GenericModal
                id={props.menuId}
                className='menuModal'
                backdrop={true}
                ariaLabel={props.menuAriaLabel}
                onExited={handleModalExited}
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
