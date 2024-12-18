// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useState, memo, useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {AlertCircleOutlineIcon} from '@mattermost/compass-icons/components';
import type {PostPriorityMetadata} from '@mattermost/types/posts';
import {PostPriority} from '@mattermost/types/posts';

import {getPersistentNotificationIntervalMinutes, isPersistentNotificationsEnabled, isPostAcknowledgementsEnabled} from 'mattermost-redux/selectors/entities/posts';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import {IconContainer} from 'components/advanced_text_editor/formatting_bar/formatting_icon';
import CompassDesignProvider from 'components/compass_design_provider';
import * as Menu from 'components/menu';

import Constants from 'utils/constants';
import * as Keyboard from 'utils/keyboard';

import {Header, MenuItem, StyledCheckIcon, ToggleItem, StandardIcon, ImportantIcon, UrgentIcon, AcknowledgementIcon, PersistentNotificationsIcon, Footer} from './post_priority_picker_item';

import './post_priority_picker.scss';

type Props = {
    settings?: PostPriorityMetadata;
    onClose: () => void;
    onApply: (props: PostPriorityMetadata) => void;
    disabled: boolean;
}

function PostPriorityPicker({
    onApply,
    onClose,
    settings,
    disabled,
}: Props) {
    const {formatMessage} = useIntl();

    const [pickerOpen, setPickerOpen] = useState(false);
    const [priority, setPriority] = useState<PostPriority|''>(settings?.priority || '');
    const [requestedAck, setRequestedAck] = useState<boolean>(settings?.requested_ack || false);
    const [persistentNotifications, setPersistentNotifications] = useState<boolean>(settings?.persistent_notifications || false);

    const theme = useSelector(getTheme);
    const postAcknowledgementsEnabled = useSelector(isPostAcknowledgementsEnabled);
    const persistentNotificationsEnabled = useSelector(isPersistentNotificationsEnabled) && postAcknowledgementsEnabled;
    const interval = useSelector(getPersistentNotificationIntervalMinutes);

    const messagePriority = formatMessage({id: 'shortcuts.msgs.formatting_bar.post_priority', defaultMessage: 'Message priority'});

    const handleClose = useCallback(() => {
        setPickerOpen(false);
        onClose();
    }, [onClose]);

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

    return (<CompassDesignProvider theme={theme}>
        <Menu.Container
            menuButton={{
                id: 'messagePriority',
                as: 'div',
                children: (
                    <IconContainer
                        id='messagePriority'
                        className={classNames({control: true, active: pickerOpen})}
                        disabled={disabled}
                        type='button'
                        aria-label={messagePriority}
                    >
                        <AlertCircleOutlineIcon
                            size={18}
                            color='currentColor'
                        />
                    </IconContainer>),
            }}
            menu={{
                id: 'post.priority.dropdown',
                'aria-label': 'Post priority options',
                width: 'max-content',
                onToggle: setPickerOpen,
                isMenuOpen: pickerOpen,
            }}
            menuButtonTooltip={{
                id: 'postPriorityPickerOverlayTooltip',
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
                horizontal: 'center',
            }}
            transformOrigin={{
                vertical: 'bottom',
                horizontal: 'center',
            }}
            menuFooter={footer}
        >
            {
                [...menuItems, ...menuCheckboxItems]
            }
        </Menu.Container>
    </CompassDesignProvider>);
}

export default memo(PostPriorityPicker);
