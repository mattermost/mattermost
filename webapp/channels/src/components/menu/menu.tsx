// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import MuiMenuList from '@mui/material/MenuList';
import MuiPopover from '@mui/material/Popover';
import type {PopoverOrigin, PopoverProps} from '@mui/material/Popover';
import classNames from 'classnames';
import React, {
    useState,
    useEffect,
    useCallback,
    useRef,
} from 'react';
import type {
    ButtonHTMLAttributes,
    ComponentType,
    ReactNode,
    MouseEvent,
    KeyboardEvent,
    Ref,
} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import {openModal, closeModal} from 'actions/views/modals';
import {getIsMobileView} from 'selectors/views/browser';

import CompassDesignProvider from 'components/compass_design_provider';

import Constants, {A11yClassNames} from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';

import {MenuContext, useMenuContextValue} from './menu_context';

import './menu.scss';

export const ELEMENT_ID_FOR_MENU_BACKDROP = 'backdropForMenuComponent';

const MENU_OPEN_ANIMATION_DURATION = 150;
export const MENU_CLOSE_ANIMATION_DURATION = 100;

export type MenuButtonComponentProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    ref: Ref<HTMLButtonElement>;
    'data-testid'?: string;

    /**
     * Forwarded to custom `as` triggers (e.g. Compass IconButton). Ignored for
     * native button/div triggers.
     */
    count?: number;
};

export type MenuButtonProps = {
    id: string;

    /** The trigger's testid path; the menu adds the role (`<testId>--button`). */
    testId?: string;

    /** The trigger's whole testid, for a trigger whose testid has no path yet. */
    dataTestId?: string;
    'aria-label'?: string;
    'aria-describedby'?: string;
    disabled?: boolean;
    class?: string;
    as?: 'button' | 'div' | ComponentType<MenuButtonComponentProps>;
    children?: ReactNode;

    /**
     * Numeric count shown by Compass IconButton triggers (`menuButton.as`).
     * Not applied to native button/div triggers.
     */
    count?: number;

    /**
     * Opt-in passthrough for callers that need to inspect or adjust the
     * trigger before the click opens the menu. The menu itself does not
     * depend on it.
     */
    onMouseDown?: (event: MouseEvent<HTMLElement>) => void;
};

type MenuButtonTooltipProps = {
    isVertical?: boolean;
    class?: string;
    text: string;
    disabled?: boolean;
};

export type MenuProps = {

    /**
     * ID is mandatory as it is used in mobileWebview to open modal equivalent to menu
     */
    id: string;
    'aria-label'?: string;
    className?: string;
    'aria-labelledby'?: string;

    /** The menu's own scope (its list), when its items' testids don't already name it. */
    testId?: string;

    /**
     * @warning Make the styling of your components such a way that they don't need this handler
     */
    onToggle?: (isOpen: boolean) => void;
    onKeyDown?: (event: KeyboardEvent<HTMLDivElement>, forceCloseMenu?: () => void) => void;
    width?: string;
    minWidth?: string;
    maxWidth?: string;
    isMenuOpen?: boolean;

    /**
     * When true, hides the MUI Popover backdrop so elements behind the
     * menu remain interactive (e.g. during drag-and-drop).
     */
    hideBackdrop?: boolean;

    /**
     * When true, the modal root does not capture pointer events, so the
     * trigger stays clickable while the menu is open (e.g. chip remove).
     * The trigger toggles open/close. Escape still closes.
     */
    allowTriggerInteraction?: boolean;

    /**
     * When true, MUI will not restore focus to the previously focused
     * element when the menu closes. Useful when the caller manages
     * focus itself (e.g. keyboard reordering).
     */
    disableRestoreFocus?: boolean;

    /**
     * When true, hovering the trigger opens the menu, and moving the pointer off both the trigger
     * and the menu closes it again. A menu opened this way doesn't take focus or block the page,
     * so hovering past it doesn't interrupt the user. Clicking the trigger, or opening it from the
     * keyboard, still opens it as usual. Ignored in mobile view.
     */
    openOnHover?: boolean;

    /**
     * When false, the menu will not auto-focus the first item on open.
     * Focus stays on the trigger button; ArrowDown moves focus into the list.
     * Defaults to true (standard MUI behavior).
     */
    autoFocusItem?: boolean;

    /**
     * Where the popover is portaled; defaults to document.body. A menu inside a
     * focus-enforcing modal must render within the modal's dialog element, or
     * the modal and the popover fight over focus.
     */
    container?: PopoverProps['container'];
};

const defaultAnchorOrigin = {vertical: 'bottom', horizontal: 'left'} as PopoverOrigin;

// How long the pointer rests on an openOnHover trigger before its menu opens, and how long it can be
// off both the trigger and the menu (crossing the gap between them, say) before the menu closes.
const HOVER_OPEN_DELAY = 100;
const HOVER_CLOSE_DELAY = 200;

// Menus opened by hovering are mounted in a container of their own. The popover hides everything
// sharing its container from assistive technology, so this keeps the rest of the page available.
function getHoverMenuContainer() {
    const id = 'hoverMenuContainer';
    let container = document.getElementById(id);
    if (!container) {
        container = document.createElement('div');
        container.id = id;
        document.body.appendChild(container);
    }
    return container;
}
const defaultTransformOrigin = {vertical: 'top', horizontal: 'left'} as PopoverOrigin;

interface Props {
    menuButton: MenuButtonProps;
    menuButtonTooltip?: MenuButtonTooltipProps;
    menuHeader?: ReactNode;
    menuFooter?: ReactNode;
    menu: MenuProps;
    children: ReactNode | ReactNode[];
    closeMenuOnTab?: boolean;

    // Use MUI Anchor Playgroup to try various anchorOrigin
    // and transformOrigin values - https://mui.com/material-ui/react-popover/#anchor-playground
    anchorOrigin?: PopoverOrigin;
    transformOrigin?: PopoverOrigin;
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
    const {closeMenuOnTab = true} = props;
    const theme = useSelector(getTheme);

    const isMobileView = useSelector(getIsMobileView);

    const dispatch = useDispatch();

    // Initialize from prop so initial mount with isMenuOpen={true} opens.
    const [isMenuOpen, setIsMenuOpen] = useState(props.menu.isMenuOpen === true);

    // Whether the menu is open because the pointer is over it (openOnHover), rather than from a click
    // or the keyboard. Mirrored in a ref for the hover timers.
    const [openedByHover, setOpenedByHover] = useState(false);
    const openedByHoverRef = useRef(false);

    // Set from a hover-open until the menu has closed, or a click takes it over. Mounting in the hover
    // container (see getHoverMenuContainer) is part of it, and switching that while the menu closes
    // would remount it and drop the chosen item's click handler. A click takeover does switch it, as a
    // fresh popover: the modal only hides the page, locks scrolling, takes focus and remembers what to
    // refocus when it opens, so the menu then behaves exactly as if the click had opened it.
    const [hoverSession, setHoverSession] = useState(false);
    const hoverTimer = useRef<number | undefined>(undefined);
    const hoverEnabled = Boolean(props.menu.openOnHover) && !isMobileView;

    // State (not ref) so MUI's anchorEl reacts when the button mounts.
    const [menuButton, setMenuButton] = useState<HTMLElement | null>(null);

    // Mirror the controlled prop into internal state on transition.
    // undefined → no sync; release of control keeps the current state.
    // Pattern: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
    const [prevControlled, setPrevControlled] = useState(props.menu.isMenuOpen);
    if (prevControlled !== props.menu.isMenuOpen) {
        setPrevControlled(props.menu.isMenuOpen);
        if (props.menu.isMenuOpen === true) {
            setIsMenuOpen(true);
        } else if (props.menu.isMenuOpen === false) {
            setIsMenuOpen(false);
        }
    }

    function setHoverOpened(byHover: boolean) {
        openedByHoverRef.current = byHover;
        setOpenedByHover(byHover);
    }

    function handleHoverEnter() {
        if (!hoverEnabled) {
            return;
        }
        window.clearTimeout(hoverTimer.current);
        if (!isMenuOpen) {
            hoverTimer.current = window.setTimeout(() => {
                setHoverOpened(true);
                setHoverSession(true);
                setIsMenuOpen(true);
            }, HOVER_OPEN_DELAY);
        }
    }

    function handleHoverLeave() {
        if (!hoverEnabled) {
            return;
        }
        window.clearTimeout(hoverTimer.current);

        // A menu opened by a click or the keyboard stays open until it's dismissed.
        hoverTimer.current = window.setTimeout(() => {
            if (openedByHoverRef.current) {
                setIsMenuOpen(false);
            }
        }, HOVER_CLOSE_DELAY);
    }

    useEffect(() => {
        if (!isMenuOpen) {
            setHoverOpened(false);
        }
    }, [isMenuOpen]);

    // Focus stays where it was under a hover-opened menu, so Escape there wouldn't reach the menu.
    useEffect(() => {
        if (!openedByHover) {
            return undefined;
        }
        const closeOnEscape = (event: globalThis.KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('keydown', closeOnEscape);
        return () => document.removeEventListener('keydown', closeOnEscape);
    }, [openedByHover]);

    useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

    // Callback function handler called when menu is closed by escapeKeyDown, backdropClick or tabKeyDown
    function handleMenuClose(event: MouseEvent<HTMLDivElement>) {
        // When hideBackdrop is active (during DnD), block all MUI-initiated close.
        // The menu is controlled exclusively via isMenuOpen in this mode.
        if (props.menu.hideBackdrop) {
            event.preventDefault();
            return;
        }

        event.preventDefault();
        setIsMenuOpen(false);
    }

    // Handle function injected into menu items to close the menu
    const closeMenu = useCallback(() => {
        setIsMenuOpen(false);
    }, []);

    function handleMenuModalClose(modalId: MenuProps['id']) {
        dispatch(closeModal(modalId));
        setIsMenuOpen(false);
    }

    // Stop synthetic events from bubbling up to the parent
    // @see https://github.com/mui/material-ui/issues/32064
    function handleMenuClick(e: MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>) {
        e.stopPropagation();
    }

    // MUI MenuList handles arrow keys internally. This handler runs AFTER
    // MenuList's own onKeyDown (MUI calls our onKeyDown prop at the end).
    // Stop propagation so the arrow event doesn't also reach the Popover's
    // onKeyDown, which could cause double-movement.
    function handleMenuListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
        if (isKeyPressed(event, Constants.KeyCodes.UP) || isKeyPressed(event, Constants.KeyCodes.DOWN)) {
            event.stopPropagation();
        }

        // If a menu item already handled Space/Enter (e.g. keyboard reorder),
        // stop it from reaching the Popover which would close the menu.
        if (event.defaultPrevented && (isKeyPressed(event, Constants.KeyCodes.SPACE) || isKeyPressed(event, Constants.KeyCodes.ENTER))) {
            event.stopPropagation();
        }
    }

    function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (isKeyPressed(event, Constants.KeyCodes.ENTER) || isKeyPressed(event, Constants.KeyCodes.SPACE)) {
            const target = event.target as HTMLElement;
            const ariaHasPopupAttribute = target?.getAttribute('aria-haspopup') === 'true';
            const ariaHasExpandedAttribute = target?.getAttribute('aria-expanded') === 'true';

            if (ariaHasPopupAttribute && ariaHasExpandedAttribute) {
                // Avoid closing the sub menu item on enter
            } else {
                setIsMenuOpen(false);
            }
        }

        if (props.menu.onKeyDown) {
            // We need to pass the closeMenu function to the onKeyDown handler so that the menu can be closed manually
            // This is helpful for cases when menu needs to be closed after certain keybindings are pressed in components which uses menu
            // This however is not the case for mouse events as they are handled/closed by menu item click handlers
            props.menu.onKeyDown(event, closeMenu);
        }

        // To handle closing the menu when TAB is pressed by default.
        // This is added as MUI popover component does not automatically close the menu when TAB is pressed.
        // `closeMenuOnTab` is used in case if we want to opt out from closing the menu on TAB.
        if (closeMenuOnTab && isKeyPressed(event, Constants.KeyCodes.TAB)) {
            closeMenu();
        }
    }

    function handleMenuButtonClick(event: MouseEvent | KeyboardEvent) {
        // Check before preventDefault so Enter/Space on a descendant remove
        // button can still fire the native button activation.
        if ((event.target as HTMLElement).closest?.('[data-menu-prevent-open]')) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        // A click turns a menu opened by hovering into one opened as usual.
        window.clearTimeout(hoverTimer.current);
        setHoverOpened(false);
        setHoverSession(false);

        if (isMobileView) {
            dispatch(
                openModal<MenuModalProps>({
                    modalId: props.menu.id,
                    dialogType: MenuModal,
                    dialogProps: {
                        menuButtonId: props.menuButton.id,
                        menuId: props.menu.id,
                        menuAriaLabel: props.menu?.['aria-label'] ?? '',
                        className: props.menu.className,
                        onModalClose: handleMenuModalClose,
                        children: props.children,
                        onKeyDown: props.menu.onKeyDown,
                        menuHeader: props.menuHeader,
                        menuFooter: props.menuFooter,
                    },
                }),
            );
        } else if (props.menu.allowTriggerInteraction) {
            setIsMenuOpen((open) => !open);
        } else {
            setIsMenuOpen(true);
        }
    }

    function handleMenuButtonKeyDown(event: KeyboardEvent) {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }

        // Only the trigger itself should open/toggle — not a focused chip remove.
        if (event.target !== event.currentTarget) {
            return;
        }

        handleMenuButtonClick(event);
    }

    // We construct the menu button so we can set onClick correctly here to support both web and mobile view
    function renderMenuButton() {
        const MenuButtonComponent = props.menuButton?.as ?? 'button';
        const isDivTrigger = MenuButtonComponent === 'div';
        const isDisabled = props.menuButton?.disabled ?? false;
        let divTabIndex: number | undefined;
        if (isDivTrigger) {
            divTabIndex = isDisabled ? -1 : 0;
        }

        const isNativeTrigger = MenuButtonComponent === 'button' || MenuButtonComponent === 'div';
        const customTriggerProps = isNativeTrigger ? undefined : {count: props.menuButton.count};

        const triggerElement = (
            <MenuButtonComponent
                ref={setMenuButton}
                id={props.menuButton.id}
                data-testid={props.menuButton.testId ? `${props.menuButton.testId}--button` : props.menuButton.dataTestId}
                aria-controls={props.menu.id}
                aria-haspopup={true}
                aria-expanded={isMenuOpen}

                // Native <button> uses disabled. Div triggers are not form
                // controls, so they expose aria-disabled for AT instead.
                disabled={isDivTrigger ? undefined : isDisabled}
                aria-disabled={isDivTrigger ? isDisabled : undefined}
                role={isDivTrigger ? 'button' : undefined}
                tabIndex={divTabIndex}
                aria-label={props.menuButton?.['aria-label']}
                aria-describedby={props.menuButton?.['aria-describedby']}
                className={props.menuButton?.class ?? ''}
                onMouseDown={props.menuButton?.onMouseDown}
                onMouseEnter={isDisabled ? undefined : handleHoverEnter}
                onMouseLeave={isDisabled ? undefined : handleHoverLeave}
                onClick={isDisabled ? undefined : handleMenuButtonClick}
                onKeyDown={isDivTrigger && !isDisabled ? handleMenuButtonKeyDown : undefined}
                {...customTriggerProps}
            >
                {props.menuButton.children}
            </MenuButtonComponent>
        );

        if (props.menuButtonTooltip && props.menuButtonTooltip.text && !isMobileView) {
            return (
                <WithTooltip
                    title={props.menuButtonTooltip.text}
                    isVertical={props.menuButtonTooltip?.isVertical ?? true}
                    disabled={isMenuOpen || props.menuButton?.disabled}
                    className={props.menuButtonTooltip.class}
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

    const providerValue = useMenuContextValue(closeMenu, isMenuOpen);
    const pointerEventsPassThrough = Boolean(props.menu.hideBackdrop || props.menu.allowTriggerInteraction || openedByHover);
    const paperStyle = pointerEventsPassThrough ? {pointerEvents: 'auto' as const} : undefined;

    if (isMobileView) {
        // In mobile view, the menu is rendered as a modal
        return renderMenuButton();
    }

    return (
        <CompassDesignProvider theme={theme}>
            {renderMenuButton()}
            <MenuContext.Provider value={providerValue}>
                {/* Wait for the anchor; gate on menuButton only so MUI's
                    open/close transitions still run. */}
                {menuButton && (
                    <MuiPopover

                        // A new popover when a click takes over a hover-opened menu (see hoverSession).
                        key={hoverSession ? 'hover' : 'click'}
                        anchorEl={menuButton}
                        container={hoverSession ? getHoverMenuContainer : props.menu.container}
                        open={isMenuOpen}
                        onClose={handleMenuClose}
                        onClick={handleMenuClick}
                        onKeyDown={handleMenuKeyDown}
                        className={classNames(A11yClassNames.POPUP, 'menu_menuStyled')}
                        marginThreshold={0}
                        anchorOrigin={props.anchorOrigin || defaultAnchorOrigin}
                        transformOrigin={props.transformOrigin || defaultTransformOrigin}
                        hideBackdrop={props.menu.hideBackdrop || openedByHover}
                        disableRestoreFocus={props.menu.disableRestoreFocus || openedByHover}

                        // Opened by hovering, the menu leaves focus and scrolling where they were.
                        disableAutoFocus={openedByHover}
                        disableEnforceFocus={openedByHover}
                        disableScrollLock={openedByHover}

                        // hideBackdrop (DnD) and allowTriggerInteraction (chip
                        // remove) both need the modal root to stop eating clicks
                        // so the trigger behind it stays usable. Paper stays
                        // interactive so the list itself still receives them.
                        style={pointerEventsPassThrough ? {pointerEvents: 'none'} : undefined}
                        PaperProps={{
                            style: paperStyle,
                            onMouseEnter: hoverEnabled ? handleHoverEnter : undefined,
                            onMouseLeave: hoverEnabled ? handleHoverLeave : undefined,
                        }}
                        TransitionProps={{
                            mountOnEnter: true,
                            unmountOnExit: true,
                            timeout: {
                                enter: MENU_OPEN_ANIMATION_DURATION,
                                exit: MENU_CLOSE_ANIMATION_DURATION,
                            },
                        }}
                        slotProps={{
                            root: {
                                slotProps: {
                                    backdrop: {
                                        id: ELEMENT_ID_FOR_MENU_BACKDROP,

                                        // Popover normally sets this itself, but passing our own
                                        // backdrop props replaces its defaults.
                                        invisible: true,
                                    },
                                },
                            },
                        }}
                        onTransitionExited={() => {
                            providerValue.handleClosed();

                            // Only once closed: switching containers remounts the menu.
                            setHoverSession(false);
                        }}
                    >
                        {props.menuHeader}
                        <MuiMenuList
                            id={props.menu.id}
                            data-testid={props.menu.testId}
                            aria-label={props.menu?.['aria-label']}
                            aria-labelledby={props.menu['aria-labelledby']}
                            className={props.menu.className}
                            style={{
                                width: props.menu.width,
                                minWidth: props.menu.minWidth,
                                maxWidth: props.menu.maxWidth,
                            }}
                            autoFocusItem={(props.menu.autoFocusItem ?? true) && isMenuOpen && !openedByHover}
                            onKeyDown={handleMenuListKeyDown}
                        >
                            {props.children}
                        </MuiMenuList>
                        {props.menuFooter}
                    </MuiPopover>
                )}
            </MenuContext.Provider>
        </CompassDesignProvider>
    );
}

interface MenuModalProps {
    menuButtonId: MenuButtonProps['id'];
    menuId: MenuProps['id'];
    menuAriaLabel: MenuProps['aria-label'];
    className: MenuProps['className'];
    onModalClose: (modalId: MenuProps['id']) => void;
    children: Props['children'];
    onKeyDown?: MenuProps['onKeyDown'];
    menuHeader?: Props['menuHeader'];
    menuFooter?: Props['menuFooter'];
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
                    className={props.className}
                >
                    {props.menuHeader}
                    {props.children}
                    {props.menuFooter}
                </MuiMenuList>
            </GenericModal>
        </CompassDesignProvider>
    );
}
