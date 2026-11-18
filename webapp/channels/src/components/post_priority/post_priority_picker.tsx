// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import MuiMenuList from '@mui/material/MenuList';
import MuiPopover from '@mui/material/Popover';
import React, {useCallback, useContext, useState, memo, useMemo, useEffect, useRef} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {AlertCircleOutlineIcon, ChevronRightIcon} from '@mattermost/compass-icons/components';
import {Icon} from '@mattermost/compass-ui/components/icon';
import type {PostPriorityMetadata} from '@mattermost/types/posts';
import {PostPriority} from '@mattermost/types/posts';

import {getPersistentNotificationIntervalMinutes, isPersistentNotificationsEnabled, isPostAcknowledgementsEnabled} from 'mattermost-redux/selectors/entities/posts';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import {submenuPointerDestination, useComposerSubmenuHover, useDelayedSubmenuClose} from 'components/advanced_text_editor/composer_submenu_hover';
import CompassDesignProvider from 'components/compass_design_provider';
import * as Menu from 'components/menu';
import {MenuContext} from 'components/menu/menu_context';

import Constants from 'utils/constants';
import * as Keyboard from 'utils/keyboard';

import {Header, MenuItem, StyledCheckIcon, ToggleItem, StandardIcon, ImportantIcon, UrgentIcon, AcknowledgementIcon, PersistentNotificationsIcon, Footer} from './post_priority_picker_item';

import './post_priority_picker.scss';

const PostPriorityMenuTrigger = Menu.createMenuIconButtonTrigger({size: 'small'});

const PRIORITY_ROW_ID = 'message-priority';

type Props = {
    settings?: PostPriorityMetadata;
    onClose: () => void;
    onApply: (props: PostPriorityMetadata) => void;
    disabled: boolean;

    // `button` is the formatting-bar control. `item` is a row in the composer + menu.
    presentation?: 'button' | 'item';
};

function PostPriorityPicker({
    onApply,
    onClose,
    settings,
    disabled,
    presentation = 'button',
}: Props) {
    const {formatMessage} = useIntl();
    const menu = useContext(MenuContext);
    const {activeRow, claimRow} = useComposerSubmenuHover();
    const panelRef = useRef<HTMLDivElement>(null);

    const [pickerOpen, setPickerOpen] = useState(false);
    const [itemAnchor, setItemAnchor] = useState<HTMLElement | null>(null);
    const [priority, setPriority] = useState<PostPriority | ''>(settings?.priority || '');
    const [requestedAck, setRequestedAck] = useState<boolean>(settings?.requested_ack || false);
    const [persistentNotifications, setPersistentNotifications] = useState<boolean>(settings?.persistent_notifications || false);

    const theme = useSelector(getTheme);
    const postAcknowledgementsEnabled = useSelector(isPostAcknowledgementsEnabled);
    const persistentNotificationsEnabled = useSelector(isPersistentNotificationsEnabled) && postAcknowledgementsEnabled;
    const interval = useSelector(getPersistentNotificationIntervalMinutes);

    const messagePriority = formatMessage({id: 'shortcuts.msgs.formatting_bar.post_priority', defaultMessage: 'Message priority'});

    const handleClose = useCallback(() => {
        setPickerOpen(false);
        setItemAnchor(null);
        onClose();
        if (presentation === 'item') {
            menu.close?.();
        }
    }, [menu, onClose, presentation]);

    const makeOnSelectPriority = useCallback((type?: PostPriority) => (e: React.MouseEvent<HTMLLIElement> | React.KeyboardEvent<HTMLLIElement>) => {
        e.stopPropagation();
        e.preventDefault();

        setPriority(type || '');

        if (!postAcknowledgementsEnabled) {
            onApply({
                priority: type || '',
                requested_ack: false,
                persistent_notifications: false,
            });
            handleClose();
        } else if (type !== PostPriority.URGENT) {
            setPersistentNotifications(false);
        }
    }, [onApply, handleClose, postAcknowledgementsEnabled]);

    const handleAck = useCallback(() => {
        setRequestedAck(!requestedAck);
    }, [requestedAck]);

    const handlePersistentNotifications = useCallback(() => {
        setPersistentNotifications(!persistentNotifications);
    }, [persistentNotifications]);

    const handleApply = useCallback(() => {
        onApply({
            priority,
            requested_ack: requestedAck,
            persistent_notifications: persistentNotifications,
        });
        handleClose();
    }, [onApply, handleClose, persistentNotifications, priority, requestedAck]);

    const handleFooterButtonAction = useCallback((e: React.KeyboardEvent<HTMLButtonElement>, actionFn: () => void) => {
        if (Keyboard.isKeyPressed(e, Constants.KeyCodes.ENTER)) {
            e.preventDefault();
            actionFn();
        }
    }, []);

    const menuItems = useMemo(() => [
        <MenuItem
            key='menu-item-priority-standard'
            id='menu-item-priority-standard'
            role='menuitemradio'
            aria-checked={!priority}
            onClick={makeOnSelectPriority()}
            trailingElements={!priority && <StyledCheckIcon size={18}/>}
            leadingElement={<StandardIcon size={18}/>}
            labels={
                <FormattedMessage
                    id='post_priority.priority.standard'
                    defaultMessage='Standard'
                />
            }
        />,
        <MenuItem
            key='menu-item-priority-important'
            id='menu-item-priority-important'
            role='menuitemradio'
            aria-checked={priority === PostPriority.IMPORTANT}
            onClick={makeOnSelectPriority(PostPriority.IMPORTANT)}
            trailingElements={priority === PostPriority.IMPORTANT && <StyledCheckIcon size={18}/>}
            leadingElement={<ImportantIcon size={18}/>}
            labels={
                <FormattedMessage
                    id='post_priority.priority.important'
                    defaultMessage='Important'
                />
            }
        />,
        <MenuItem
            key='menu-item-priority-urgent'
            id='menu-item-priority-urgent'
            role='menuitemradio'
            aria-checked={priority === PostPriority.URGENT}
            onClick={makeOnSelectPriority(PostPriority.URGENT)}
            trailingElements={priority === PostPriority.URGENT && <StyledCheckIcon size={18}/>}
            leadingElement={<UrgentIcon size={18}/>}
            labels={
                <FormattedMessage
                    id='post_priority.priority.urgent'
                    defaultMessage='Urgent'
                />
            }
        />,
    ], [makeOnSelectPriority, priority]);

    const menuCheckboxItems = useMemo(() => (postAcknowledgementsEnabled || persistentNotificationsEnabled ? [
        <Menu.Separator
            key='menu-item-checkbox-separator'
            component='li'
        />,
        postAcknowledgementsEnabled ? (
            <ToggleItem
                key='post_priority.requested_ack.item'
                ariaLabel={formatMessage({
                    id: 'post_priority.requested_ack.text',
                    defaultMessage: 'Request acknowledgement',
                })}
                disabled={false}
                onClick={handleAck}
                toggled={requestedAck}
                icon={<AcknowledgementIcon size={18}/>}
                text={formatMessage({
                    id: 'post_priority.requested_ack.text',
                    defaultMessage: 'Request acknowledgement',
                })}
                description={formatMessage({
                    id: 'post_priority.requested_ack.description',
                    defaultMessage: 'An acknowledgement button will appear with your message',
                })}
            />) : null,
        priority === PostPriority.URGENT && persistentNotificationsEnabled ? (
            <ToggleItem
                key='post_priority.persistent_notifications.item'
                ariaLabel={formatMessage({
                    id: 'post_priority.persistent_notifications.text',
                    defaultMessage: 'Send persistent notifications',
                })}
                disabled={priority !== PostPriority.URGENT}
                onClick={handlePersistentNotifications}
                toggled={persistentNotifications}
                icon={<PersistentNotificationsIcon size={18}/>}
                text={formatMessage({
                    id: 'post_priority.persistent_notifications.text',
                    defaultMessage: 'Send persistent notifications',
                })}
                description={formatMessage(
                    {
                        id: 'post_priority.persistent_notifications.description',
                        defaultMessage: 'Recipients will be notified every {interval, plural, one {1 minute} other {{interval} minutes}} until they acknowledge or reply',
                    }, {
                        interval,
                    },
                )}
            />) : null,
    ] : []), [formatMessage, handleAck, handlePersistentNotifications, interval, persistentNotifications, persistentNotificationsEnabled, postAcknowledgementsEnabled, priority, requestedAck]);

    const footer = useMemo(() => postAcknowledgementsEnabled &&
        <div>
            <Menu.Separator/>
            <Footer key='footer'>
                <button
                    type='submit'
                    className='PostPriorityPicker__cancel'
                    onClick={handleClose}
                    onKeyDown={(e) => handleFooterButtonAction(e, handleClose)}
                >
                    <FormattedMessage
                        id='post_priority.picker.cancel'
                        defaultMessage='Cancel'
                    />
                </button>
                <button
                    type='submit'
                    className='PostPriorityPicker__apply'
                    onClick={handleApply}
                    onKeyDown={(e) => handleFooterButtonAction(e, handleApply)}
                >
                    <FormattedMessage
                        id='post_priority.picker.apply'
                        defaultMessage='Apply'
                    />
                </button>
            </Footer>
        </div>, [handleApply, handleClose, handleFooterButtonAction, postAcknowledgementsEnabled]);

    useEffect(() => {
        if (presentation === 'button' && pickerOpen) {
            setPriority(settings?.priority || '');
            setPersistentNotifications(settings?.persistent_notifications || false);
            setRequestedAck(settings?.requested_ack || false);
        }
    }, [pickerOpen, presentation, settings]);

    // Snapshot the saved priority when the + menu row opens its panel, and
    // leave that snapshot alone while the panel stays open.
    useEffect(() => {
        if (presentation === 'item' && itemAnchor) {
            setPriority(settings?.priority || '');
            setPersistentNotifications(settings?.persistent_notifications || false);
            setRequestedAck(settings?.requested_ack || false);
        }

        // settings is read when the panel opens.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [itemAnchor, presentation]);

    const closeItemPanel = useCallback(() => {
        setItemAnchor(null);
    }, []);
    const {cancel: cancelClose, schedule: scheduleClose} = useDelayedSubmenuClose(closeItemPanel);

    const openItem = useCallback((event: React.MouseEvent<HTMLLIElement> | React.KeyboardEvent<HTMLLIElement>) => {
        cancelClose();
        claimRow(PRIORITY_ROW_ID);
        setItemAnchor(event.currentTarget);
    }, [cancelClose, claimRow]);

    const closeItemUnlessInside = useCallback((next: EventTarget | null, anchor: HTMLElement | null) => {
        const destination = submenuPointerDestination(next, panelRef.current, anchor);
        if (destination === 'stay') {
            cancelClose();
            return;
        }
        if (destination === 'close') {
            cancelClose();
            closeItemPanel();
            return;
        }
        scheduleClose();
    }, [cancelClose, closeItemPanel, scheduleClose]);

    // Close when the pointer claims another + row, and when the desktop menu
    // closes. The mobile modal does not provide MenuContext, so a missing
    // close function means this row is not in that desktop menu.
    useEffect(() => {
        if (presentation !== 'item' || !itemAnchor) {
            return;
        }
        const parentClosed = Boolean(menu.close) && !menu.isOpen;
        const anotherRow = activeRow !== null && activeRow !== PRIORITY_ROW_ID;
        if (parentClosed || anotherRow) {
            cancelClose();
            closeItemPanel();
        }
    }, [activeRow, cancelClose, closeItemPanel, itemAnchor, menu.close, menu.isOpen, presentation]);

    const pickerBody = (
        <div className='PostPriorityPicker'>
            <div>
                <Header className='modal-title'>
                    <FormattedMessage
                        id='post_priority.picker.header'
                        defaultMessage='Message priority'
                    />
                </Header>
                <Menu.Separator/>
            </div>
            <MuiMenuList
                id='post.priority.dropdown'
                aria-label={formatMessage({
                    id: 'post_priority.picker.header',
                    defaultMessage: 'Message priority',
                })}
                sx={{py: 0}}
            >
                {menuItems}
                {menuCheckboxItems}
            </MuiMenuList>
            {footer}
        </div>
    );

    if (presentation === 'item') {
        return (
            <CompassDesignProvider theme={theme}>
                <Menu.Item
                    id='messagePriority'
                    aria-haspopup='menu'
                    aria-expanded={Boolean(itemAnchor)}
                    disabled={disabled}
                    disableCloseOnSelect={true}
                    leadingElement={<AlertCircleOutlineIcon size={18}/>}
                    labels={(
                        <FormattedMessage
                            id='shortcuts.msgs.formatting_bar.post_priority'
                            defaultMessage='Message priority'
                        />
                    )}
                    trailingElements={<ChevronRightIcon size={18}/>}
                    onMouseEnter={openItem}
                    onMouseLeave={(event) => closeItemUnlessInside(event.relatedTarget, event.currentTarget)}
                    onClick={openItem}
                    onKeyDown={(event) => {
                        if (Keyboard.isKeyPressed(event, Constants.KeyCodes.ENTER) ||
                            Keyboard.isKeyPressed(event, Constants.KeyCodes.SPACE) ||
                            Keyboard.isKeyPressed(event, Constants.KeyCodes.RIGHT)) {
                            event.preventDefault();
                            openItem(event);
                        }
                    }}
                />
                <MuiPopover
                    open={Boolean(itemAnchor)}
                    anchorEl={itemAnchor}
                    anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                    transformOrigin={{vertical: 'bottom', horizontal: 'left'}}
                    className='menu_menuStyled AsSubMenu'
                    disableAutoFocus={true}
                    disableEnforceFocus={true}
                    disableRestoreFocus={true}
                    hideBackdrop={true}
                    transitionDuration={0}
                    slotProps={{
                        paper: {
                            ref: panelRef,
                            onMouseEnter: cancelClose,
                            onMouseLeave: (event) => closeItemUnlessInside(event.relatedTarget, itemAnchor),
                        },
                    }}
                >
                    <div style={{pointerEvents: 'auto'}}>
                        {pickerBody}
                    </div>
                </MuiPopover>
            </CompassDesignProvider>
        );
    }

    return (<CompassDesignProvider theme={theme}>
        <Menu.Container
            menuButton={{
                id: 'messagePriority',
                as: PostPriorityMenuTrigger,
                class: 'control',
                disabled,
                'aria-label': messagePriority,
                children: <Icon glyph={<AlertCircleOutlineIcon/>}/>,
            }}
            menu={{
                id: 'post.priority.dropdown',
                'aria-label': 'Post priority options',
                width: 'max-content',
                onToggle: setPickerOpen,
                isMenuOpen: pickerOpen,
            }}
            menuButtonTooltip={{
                text: messagePriority,
            }}
            menuHeader={
                <div>
                    <Header className='modal-title'>
                        {formatMessage({
                            id: 'post_priority.picker.header',
                            defaultMessage: 'Message priority',
                        })}
                    </Header>
                    <Menu.Separator/>
                </div>
            }
            anchorOrigin={{
                vertical: 'top',
                horizontal: 'left',
            }}
            transformOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
            }}
            menuFooter={footer}
            closeMenuOnTab={false}
        >
            {
                [...menuItems, ...menuCheckboxItems]
            }
        </Menu.Container>
    </CompassDesignProvider>);
}

export default memo(PostPriorityPicker);
