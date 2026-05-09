// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useState, memo, useMemo, useEffect} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import glyphMap, {AlertCircleOutlineIcon, PlusIcon, TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import type {PostPriorityLabel, PostPriorityMetadata, PostPriorityValue} from '@mattermost/types/posts';
import {PostPriority} from '@mattermost/types/posts';

import {patchConfig} from 'mattermost-redux/actions/admin';
import {getClientConfig} from 'mattermost-redux/actions/general';
import {Permissions} from 'mattermost-redux/constants';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getPersistentNotificationIntervalMinutes, getPostPriorityLabels, isPersistentNotificationsEnabled, isPostAcknowledgementsEnabled} from 'mattermost-redux/selectors/entities/posts';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';
import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles';

import {IconContainer} from 'components/advanced_text_editor/formatting_bar/formatting_icon';
import CompassDesignProvider from 'components/compass_design_provider';
import * as Menu from 'components/menu';

import Constants from 'utils/constants';
import * as Keyboard from 'utils/keyboard';

import type {GlobalState} from 'types/store';

import {Header, MenuItem, StyledCheckIcon, ToggleItem, StandardIcon, ImportantIcon, UrgentIcon, AcknowledgementIcon, PersistentNotificationsIcon, Footer} from './post_priority_picker_item';

import './post_priority_picker.scss';

type Props = {
    settings?: PostPriorityMetadata;
    onClose: () => void;
    onApply: (props: PostPriorityMetadata) => void;
    disabled: boolean;
}

function parsePostPriorityLabels(configuredLabels: string | undefined, fallbackLabels: PostPriorityLabel[]) {
    if (!configuredLabels) {
        return fallbackLabels;
    }

    try {
        const labels = JSON.parse(configuredLabels) as PostPriorityLabel[];
        return Array.isArray(labels) ? labels : fallbackLabels;
    } catch {
        return fallbackLabels;
    }
}

function buildPriorityLabelId(name: string) {
    return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function getPriorityLabelText(label: PostPriorityLabel, formatMessage: ReturnType<typeof useIntl>['formatMessage']) {
    if (label.id === PostPriority.IMPORTANT) {
        return formatMessage({id: 'post_priority.priority.important', defaultMessage: label.name || 'Important'});
    }

    if (label.id === PostPriority.URGENT) {
        return formatMessage({id: 'post_priority.priority.urgent', defaultMessage: label.name || 'Urgent'});
    }

    return label.name;
}

function PriorityMenuIcon({label}: {label: PostPriorityLabel}) {
    if (label.id === PostPriority.IMPORTANT) {
        return <ImportantIcon size={18}/>;
    }

    if (label.id === PostPriority.URGENT) {
        return <UrgentIcon size={18}/>;
    }

    const Icon = label.icon ? glyphMap[label.icon as keyof typeof glyphMap] : undefined;
    if (Icon) {
        return <Icon size={18}/>;
    }

    return <AlertCircleOutlineIcon size={18}/>;
}

function isSystemPriorityLabel(label: PostPriorityLabel) {
    return label.id === PostPriority.IMPORTANT || label.id === PostPriority.URGENT || Boolean(label.system_name);
}

function PostPriorityPicker({
    onApply,
    onClose,
    settings,
    disabled,
}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const [pickerOpen, setPickerOpen] = useState(false);
    const [priority, setPriority] = useState<PostPriorityValue | ''>(settings?.priority || '');
    const [requestedAck, setRequestedAck] = useState<boolean>(settings?.requested_ack || false);
    const [persistentNotifications, setPersistentNotifications] = useState<boolean>(settings?.persistent_notifications || false);
    const [isCreatingLabel, setIsCreatingLabel] = useState(false);
    const [newLabelName, setNewLabelName] = useState('');
    const [newLabelError, setNewLabelError] = useState('');
    const [isSavingLabel, setIsSavingLabel] = useState(false);
    const [deletingLabelId, setDeletingLabelId] = useState('');
    const [labelActionError, setLabelActionError] = useState('');

    const theme = useSelector(getTheme);
    const postAcknowledgementsEnabled = useSelector(isPostAcknowledgementsEnabled);
    const persistentNotificationsEnabled = useSelector(isPersistentNotificationsEnabled) && postAcknowledgementsEnabled;
    const interval = useSelector(getPersistentNotificationIntervalMinutes);
    const postPriorityLabels = useSelector(getPostPriorityLabels);
    const configuredPostPriorityLabels = useSelector((state: GlobalState) => getConfig(state).PostPriorityLabels);
    const canCreatePriorityLabels = useSelector((state: GlobalState) => haveISystemPermission(state, {permission: Permissions.MANAGE_SYSTEM}));

    const messagePriority = formatMessage({id: 'shortcuts.msgs.formatting_bar.post_priority', defaultMessage: 'Message priority'});

    const handleClose = useCallback(() => {
        setPickerOpen(false);
        onClose();
    }, [onClose]);

    const makeOnSelectPriority = useCallback((type?: PostPriorityValue) => (e: React.MouseEvent<HTMLLIElement> | React.KeyboardEvent<HTMLLIElement>) => {
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

    const handleCreateLabel = useCallback(async () => {
        const name = newLabelName.trim();
        const id = buildPriorityLabelId(name);

        if (!name || !id) {
            setNewLabelError(formatMessage({id: 'post_priority.picker.create_label.empty_error', defaultMessage: 'Enter a label name'}));
            return;
        }

        const existingLabels = parsePostPriorityLabels(configuredPostPriorityLabels, postPriorityLabels);
        if (existingLabels.some((label) => label.id.toLowerCase() === id.toLowerCase())) {
            setNewLabelError(formatMessage({id: 'post_priority.picker.create_label.duplicate_error', defaultMessage: 'A label with this name already exists'}));
            return;
        }

        setIsSavingLabel(true);
        setNewLabelError('');
        setLabelActionError('');

        const updatedLabels = [
            ...existingLabels,
            {
                id,
                name,
                variant: 'default',
                sort_order: existingLabels.length,
            },
        ];

        const {error} = await dispatch(patchConfig({
            ServiceSettings: {
                PostPriorityLabels: JSON.stringify(updatedLabels),
            },
        }));

        if (error) {
            setNewLabelError(error.message);
            setIsSavingLabel(false);
            return;
        }

        await dispatch(getClientConfig());
        setPriority(id);
        setPersistentNotifications(false);
        setNewLabelName('');
        setIsCreatingLabel(false);
        setIsSavingLabel(false);

        if (!postAcknowledgementsEnabled) {
            onApply({
                priority: id,
                requested_ack: false,
                persistent_notifications: false,
            });
            handleClose();
        }
    }, [configuredPostPriorityLabels, dispatch, formatMessage, handleClose, newLabelName, onApply, postAcknowledgementsEnabled, postPriorityLabels]);

    const handleDeleteLabel = useCallback(async (label: PostPriorityLabel) => {
        if (isSystemPriorityLabel(label)) {
            return;
        }

        setDeletingLabelId(label.id);
        setLabelActionError('');

        const existingLabels = parsePostPriorityLabels(configuredPostPriorityLabels, postPriorityLabels);
        const updatedLabels = existingLabels.filter((item) => item.id !== label.id);

        const {error} = await dispatch(patchConfig({
            ServiceSettings: {
                PostPriorityLabels: JSON.stringify(updatedLabels),
            },
        }));

        if (error) {
            setLabelActionError(error.message);
            setDeletingLabelId('');
            return;
        }

        await dispatch(getClientConfig());

        if (priority === label.id) {
            setPriority('');
            setPersistentNotifications(false);

            if (!postAcknowledgementsEnabled) {
                onApply({
                    priority: '',
                    requested_ack: false,
                    persistent_notifications: false,
                });
            }
        }

        setDeletingLabelId('');
    }, [configuredPostPriorityLabels, dispatch, onApply, postAcknowledgementsEnabled, postPriorityLabels, priority]);

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
        ...postPriorityLabels.map((label) => (
            <MenuItem
                key={`menu-item-priority-${label.id}`}
                id={`menu-item-priority-${label.id}`}
                role='menuitemradio'
                aria-checked={priority === label.id}
                onClick={makeOnSelectPriority(label.id)}
                trailingElements={<>
                    {priority === label.id && <StyledCheckIcon size={18}/>}
                    {canCreatePriorityLabels && !isSystemPriorityLabel(label) && (
                        <button
                            type='button'
                            className='PostPriorityPicker__deleteLabelButton'
                            disabled={deletingLabelId === label.id}
                            aria-label={formatMessage({id: 'post_priority.picker.delete_label', defaultMessage: 'Delete label'})}
                            title={formatMessage({id: 'post_priority.picker.delete_label', defaultMessage: 'Delete label'})}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteLabel(label);
                            }}
                            onKeyDown={(e) => e.stopPropagation()}
                        >
                            <TrashCanOutlineIcon size={14}/>
                        </button>
                    )}
                </>}
                leadingElement={<PriorityMenuIcon label={label}/>}
                labels={<span>{getPriorityLabelText(label, formatMessage)}</span>}
            />
        )),
    ], [canCreatePriorityLabels, deletingLabelId, formatMessage, handleDeleteLabel, makeOnSelectPriority, postPriorityLabels, priority]);

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
        if (pickerOpen) {
            setPriority(settings?.priority || '');
            setPersistentNotifications(settings?.persistent_notifications || false);
            setRequestedAck(settings?.requested_ack || false);
            setIsCreatingLabel(false);
            setNewLabelName('');
            setNewLabelError('');
            setLabelActionError('');
        }
    }, [pickerOpen, settings]);

    const createLabelItem = useMemo(() => {
        if (!canCreatePriorityLabels) {
            return null;
        }

        if (!isCreatingLabel) {
            return [
                <Menu.Separator
                    key='menu-item-create-label-separator'
                    component='li'
                />,
                <li
                    key='menu-item-create-label'
                    id='menu-item-create-label'
                    role='none'
                >
                    <button
                        type='button'
                        className='PostPriorityPicker__createLabelButton'
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsCreatingLabel(true);
                        }}
                        onKeyDown={(e) => e.stopPropagation()}
                    >
                        <PlusIcon size={18}/>
                        <span>
                            <FormattedMessage
                                id='post_priority.picker.create_label'
                                defaultMessage='Create label'
                            />
                        </span>
                    </button>
                </li>,
                labelActionError && (
                    <li
                        key='menu-item-label-action-error'
                        className='PostPriorityPicker__labelActionError'
                    >
                        {labelActionError}
                    </li>
                ),
            ];
        }

        return [
            <Menu.Separator
                key='menu-item-create-label-separator'
                component='li'
            />,
            <li
                key='menu-item-create-label-form'
                className='PostPriorityPicker__createLabel'
                onClick={(e) => e.stopPropagation()}
            >
                <input
                    className='PostPriorityPicker__createLabelInput'
                    type='text'
                    value={newLabelName}
                    autoFocus={true}
                    disabled={isSavingLabel}
                    placeholder={formatMessage({id: 'post_priority.picker.create_label.placeholder', defaultMessage: 'Label name'})}
                    onChange={(e) => {
                        setNewLabelName(e.target.value);
                        setNewLabelError('');
                    }}
                    onKeyDown={(e) => {
                        e.stopPropagation();
                        if (Keyboard.isKeyPressed(e, Constants.KeyCodes.ENTER)) {
                            e.preventDefault();
                            handleCreateLabel();
                        }
                    }}
                />
                {newLabelError && (
                    <div className='PostPriorityPicker__createLabelError'>
                        {newLabelError}
                    </div>
                )}
                <div className='PostPriorityPicker__createLabelActions'>
                    <button
                        type='button'
                        className='PostPriorityPicker__cancel'
                        disabled={isSavingLabel}
                        onClick={() => {
                            setIsCreatingLabel(false);
                            setNewLabelName('');
                            setNewLabelError('');
                        }}
                    >
                        <FormattedMessage
                            id='post_priority.picker.cancel'
                            defaultMessage='Cancel'
                        />
                    </button>
                    <button
                        type='button'
                        className='PostPriorityPicker__apply'
                        disabled={isSavingLabel}
                        onClick={handleCreateLabel}
                    >
                        <FormattedMessage
                            id='post_priority.picker.create_label.save'
                            defaultMessage='Create'
                        />
                    </button>
                </div>
            </li>,
        ];
    }, [canCreatePriorityLabels, formatMessage, handleCreateLabel, isCreatingLabel, isSavingLabel, newLabelError, newLabelName]);

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
                [...menuItems, ...menuCheckboxItems, ...(createLabelItem || [])]
            }
        </Menu.Container>
    </CompassDesignProvider>);
}

export default memo(PostPriorityPicker);
