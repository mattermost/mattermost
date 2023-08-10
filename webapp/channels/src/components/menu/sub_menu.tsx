// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import MuiMenuList from '@mui/material/MenuList';
import React, {
    useState,
    useEffect,
    useMemo,
    useCallback,
} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';

import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import {openModal, closeModal} from 'actions/views/modals';
import {getIsMobileView} from 'selectors/views/browser';
import {isAnyModalOpen} from 'selectors/views/modals';

import CompassDesignProvider from 'components/compass_design_provider';

import Constants, {A11yClassNames} from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';

import {SubMenuContext} from './menu_context';
import {MenuItem} from './menu_item';
import {MuiMenuStyled} from './menu_styled';

import type {Props as MenuItemProps} from './menu_item';
import type {PopoverOrigin} from '@mui/material/Popover';
import type {
    ReactNode,
    MouseEvent,
    KeyboardEvent} from 'react';

import './sub_menu.scss';

interface Props {
    id: MenuItemProps['id'];
    leadingElement?: MenuItemProps['leadingElement'];
    labels: MenuItemProps['labels'];
    trailingElements?: MenuItemProps['trailingElements'];
    isDestructive?: MenuItemProps['isDestructive'];

    // Menu props
    menuId: string;
    menuAriaLabel?: string;
    forceOpenOnLeft?: boolean; // Most of the times this is not needed, since submenu position is calculated and placed

    children: ReactNode;
}

export function SubMenu(props: Props) {
    const {
        id,
        leadingElement,
        labels,
        trailingElements,
        isDestructive,
        menuId,
        menuAriaLabel,
        forceOpenOnLeft,
        children,
        ...rest
    } = props;

    const [anchorElement, setAnchorElement] = useState<null | HTMLElement>(null);
    const isSubMenuOpen = Boolean(anchorElement);

    const isMobileView = useSelector(getIsMobileView);
    const anyModalOpen = useSelector(isAnyModalOpen);

    const dispatch = useDispatch();

    useEffect(() => {
        if (anyModalOpen && !isMobileView) {
            setAnchorElement(null);
        }
    }, [anyModalOpen, isMobileView]);

    const originOfAnchorAndTransform = useMemo(() => {
        return getOriginOfAnchorAndTransform(forceOpenOnLeft, anchorElement);
    }, [anchorElement, forceOpenOnLeft]);

    // Handler function injected in the menu items to close the submenu
    const closeSubMenu = useCallback(() => {
        setAnchorElement(null);
    }, []);

    const providerValue = useMemo(() => {
        return {
            close: closeSubMenu,
            isOpen: Boolean(anchorElement),
        };
    }, [anchorElement, closeSubMenu]);

    const hasSubmenuItems = Boolean(children);
    if (!hasSubmenuItems) {
        return null;
    }

    function handleMouseEnter(event: MouseEvent<HTMLLIElement>) {
        event.preventDefault();
        setAnchorElement(event.currentTarget);
    }

    function handleMouseLeave(event: MouseEvent<HTMLLIElement>) {
        event.preventDefault();
        setAnchorElement(null);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLLIElement>) {
        if (
            isKeyPressed(event, Constants.KeyCodes.ENTER) ||
            isKeyPressed(event, Constants.KeyCodes.SPACE) ||
            isKeyPressed(event, Constants.KeyCodes.RIGHT)
        ) {
            event.preventDefault();
            setAnchorElement(event.currentTarget);
        }
    }

    function handleSubMenuKeyDown(event: KeyboardEvent<HTMLUListElement>) {
        if (isKeyPressed(event, Constants.KeyCodes.UP) || isKeyPressed(event, Constants.KeyCodes.DOWN)) {
            // Stop the event from propagating upwards since that causes navigation to move by 2 items at a time
            event.stopPropagation();
        } else if (isKeyPressed(event, Constants.KeyCodes.ESCAPE) || isKeyPressed(event, Constants.KeyCodes.LEFT)) {
            event.preventDefault();
            setAnchorElement(null);
        }
    }

    // This is used in MobileView to open the submenu in a modal
    function handleOnClick() {
        dispatch(openModal<SubMenuModalProps>({
            modalId: menuId,
            dialogType: SubMenuModal,
            dialogProps: {
                menuId,
                menuAriaLabel,
                children,
            },
        }));
    }

    const passedInTriggerButtonProps = {
        id,
        'aria-controls': menuId,
        'aria-haspopup': true,
        'aria-expanded': isSubMenuOpen,
        disableRipple: true,
        leadingElement,
        labels,
        trailingElements,
        isDestructive,
        onClick: isMobileView ? handleOnClick : undefined, // OnClicks on parent menuItem of subMenu is only needed in mobile view
    };

    if (isMobileView) {
        return (<MenuItem {...passedInTriggerButtonProps}/>);
    }

    return (
        <MenuItem
            {...rest} // pass through other props which might be coming in from the material-ui
            {...passedInTriggerButtonProps}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onKeyDown={handleKeyDown}
        >
            <MuiMenuStyled
                anchorEl={anchorElement}
                open={isSubMenuOpen}
                asSubMenu={true}
                anchorOrigin={originOfAnchorAndTransform.anchorOrigin}
                transformOrigin={originOfAnchorAndTransform.transformOrigin}
                sx={{pointerEvents: 'none'}}
            >
                {/* This component is needed here to re enable pointer events for the submenu items which we had to disable above as */}
                {/* pointer turns to default as soon as it leaves the parent menu */}
                {/* Notice we dont use the below component in menu.tsx  */}
                <MuiMenuList
                    id={menuId}
                    component='ul'
                    aria-label={menuAriaLabel}
                    className={A11yClassNames.POPUP}
                    onKeyDown={handleSubMenuKeyDown}
                    sx={{
                        pointerEvents: 'auto', // reset pointer events to default from here on
                        paddingTop: 0,
                        paddingBottom: 0,
                    }}
                >
                    <SubMenuContext.Provider value={providerValue}>
                        {children}
                    </SubMenuContext.Provider>
                </MuiMenuList>
            </MuiMenuStyled>
        </MenuItem>
    );
}

interface SubMenuModalProps {
    menuId: Props['menuId'];
    menuAriaLabel?: Props['menuAriaLabel'];
    children: Props['children'];
}

function SubMenuModal(props: SubMenuModalProps) {
    const dispatch = useDispatch();

    const theme = useSelector(getTheme);

    function handleModalClose() {
        dispatch(closeModal(props.menuId));
    }

    return (
        <CompassDesignProvider theme={theme}>
            <GenericModal
                id={props.menuId}
                ariaLabel={props.menuAriaLabel}
                onExited={handleModalClose}
                backdrop={true}
                className='menuModal'
            >
                <MuiMenuList
                    aria-hidden={true}
                    onClick={handleModalClose}
                >
                    {props.children}
                </MuiMenuList>
            </GenericModal>
        </CompassDesignProvider>
    );
}

const openAtLeft = {
    anchorOrigin: {
        vertical: 'top',
        horizontal: 'left',
    } as PopoverOrigin,
    transformOrigin: {
        vertical: 'top',
        horizontal: 'right',
    } as PopoverOrigin,
};

const openAtRight = {
    anchorOrigin: {
        vertical: 'top',
        horizontal: 'right',
    } as PopoverOrigin,
    transformOrigin: {
        vertical: 'top',
        horizontal: 'left',
    } as PopoverOrigin,
};

function getOriginOfAnchorAndTransform(forceOpenOnLeft = false, anchorElement: HTMLElement | null): {anchorOrigin: PopoverOrigin; transformOrigin: PopoverOrigin} {
    if (!anchorElement) {
        return openAtRight;
    }

    if (forceOpenOnLeft) {
        return openAtLeft;
    }

    if (window && window.innerWidth) {
        const windowWidth = window.innerWidth;
        const anchorElementLeft = anchorElement?.getBoundingClientRect()?.left ?? 0;
        const anchorElementRight = anchorElement?.getBoundingClientRect()?.right ?? 0;

        const leftSpace = anchorElementLeft;
        const rightSpace = windowWidth - anchorElementRight;

        if (rightSpace < leftSpace) {
            return openAtLeft;
        }

        return openAtRight;
    }

    return openAtRight;
}
