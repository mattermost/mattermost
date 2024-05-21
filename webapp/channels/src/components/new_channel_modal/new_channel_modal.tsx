// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useState} from 'react';
import {Tooltip} from 'react-bootstrap';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {Board} from '@mattermost/types/boards';
import type {ChannelType, Channel} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';

import {setNewChannelWithBoardPreference} from 'mattermost-redux/actions/boards';
import {createChannel} from 'mattermost-redux/actions/channels';
import Permissions from 'mattermost-redux/constants/permissions';
import Preferences from 'mattermost-redux/constants/preferences';
import {get as getPreference} from 'mattermost-redux/selectors/entities/preferences';
import {haveICurrentChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {switchToChannel} from 'actions/views/channel';
import {closeModal} from 'actions/views/modals';

import ChannelNameFormField from 'components/channel_name_form_field/channel_name_form_field';
import OverlayTrigger from 'components/overlay_trigger';
import PublicPrivateSelector from 'components/widgets/public-private-selector/public-private-selector';

import Pluggable from 'plugins/pluggable';
import Constants, {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

import './new_channel_modal.scss';

export function getChannelTypeFromPermissions(canCreatePublicChannel: boolean, canCreatePrivateChannel: boolean) {
    let channelType = Constants.OPEN_CHANNEL;

    if (!canCreatePublicChannel && channelType === Constants.OPEN_CHANNEL) {
        channelType = Constants.PRIVATE_CHANNEL as ChannelType;
    }

    if (!canCreatePrivateChannel && channelType === Constants.PRIVATE_CHANNEL) {
        channelType = Constants.OPEN_CHANNEL as ChannelType;
    }

    return channelType as ChannelType;
}

const enum ServerErrorId {
    CHANNEL_URL_SIZE = 'model.channel.is_valid.1_or_more.app_error',
    CHANNEL_UPDATE_EXISTS = 'store.sql_channel.update.exists.app_error',
    CHANNEL_CREATE_EXISTS = 'store.sql_channel.save_channel.exists.app_error',
    CHANNEL_PURPOSE_SIZE = 'model.channel.is_valid.purpose.app_error',
}

const NewChannelModal = () => {
    const intl = useIntl();
    const {formatMessage} = intl;

    const currentTeamId = useSelector(getCurrentTeam)?.id;

    const canCreatePublicChannel = useSelector((state: GlobalState) => (currentTeamId ? haveICurrentChannelPermission(state, Permissions.CREATE_PUBLIC_CHANNEL) : false));
    const canCreatePrivateChannel = useSelector((state: GlobalState) => (currentTeamId ? haveICurrentChannelPermission(state, Permissions.CREATE_PRIVATE_CHANNEL) : false));
    const dispatch = useDispatch();

    const [type, setType] = useState(getChannelTypeFromPermissions(canCreatePublicChannel, canCreatePrivateChannel));
    const [displayName, setDisplayName] = useState('');
    const [url, setURL] = useState('');
    const [purpose, setPurpose] = useState('');
    const [urlError, setURLError] = useState('');
    const [purposeError, setPurposeError] = useState('');
    const [serverError, setServerError] = useState('');
    const [channelInputError, setChannelInputError] = useState(false);

    // create a board along with the channel
    const pluginsComponentsList = useSelector((state: GlobalState) => state.plugins.components);
    const createBoardFromChannelPlugin = pluginsComponentsList?.CreateBoardFromTemplate;
    const newChannelWithBoardPulsatingDotState = useSelector((state: GlobalState) => getPreference(state, Preferences.APP_BAR, Preferences.NEW_CHANNEL_WITH_BOARD_TOUR_SHOWED, ''));

    const [canCreateFromPluggable, setCanCreateFromPluggable] = useState(true);
    const [actionFromPluggable, setActionFromPluggable] = useState<((currentTeamId: string, channelId: string) => Promise<Board>) | undefined>(undefined);

    const handleURLChange = useCallback((newURL: string) => {
        setURL(newURL);
        setURLError('');
    }, []);

    const handleOnModalConfirm = async () => {
        if (!canCreate || !currentTeamId) {
            return;
        }

        const channel: Channel = {
            team_id: currentTeamId,
            name: url,
            display_name: displayName,
            purpose,
            header: '',
            type,
            create_at: 0,
            creator_id: '',
            delete_at: 0,
            group_constrained: false,
            id: '',
            last_post_at: 0,
            last_root_post_at: 0,
            scheme_id: '',
            update_at: 0,
        };

        try {
            const {data: newChannel, error} = await dispatch(createChannel(channel, ''));
            if (error) {
                onCreateChannelError(error);
                return;
            }

            handleOnModalCancel();

            // If template selected, create a new board from this template
            if (canCreateFromPluggable && createBoardFromChannelPlugin) {
                try {
                    addBoardToChannel(newChannel!.id);
                } catch (e: any) {
                    // eslint-disable-next-line no-console
                    console.log(e.message);
                }
            }
            dispatch(switchToChannel(newChannel!));
        } catch (e) {
            onCreateChannelError({message: formatMessage({id: 'channel_modal.error.generic', defaultMessage: 'Something went wrong. Please try again.'})});
        }
    };

    const addBoardToChannel = async (channelId: string) => {
        if (!createBoardFromChannelPlugin || !currentTeamId) {
            return false;
        }
        if (!actionFromPluggable) {
            return false;
        }

        const action = actionFromPluggable as (currentTeamId: string, channelId: string) => Promise<Board>;
        if (action && canCreateFromPluggable) {
            const board = await action(channelId, currentTeamId);

            if (!board?.id) {
                return false;
            }
        }

        // show the new channel with board tour tip
        if (newChannelWithBoardPulsatingDotState === '') {
            dispatch(setNewChannelWithBoardPreference({[Preferences.NEW_CHANNEL_WITH_BOARD_TOUR_SHOWED]: false}));
        }
        return true;
    };

    const handleOnModalCancel = () => {
        dispatch(closeModal(ModalIdentifiers.NEW_CHANNEL_MODAL));
    };

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const onCreateChannelError = ({server_error_id, message}: ServerError) => {
        switch (server_error_id) {
        case ServerErrorId.CHANNEL_URL_SIZE:
            setURLError(
                formatMessage({
                    id: 'channel_modal.handleTooShort',
                    defaultMessage: 'Channel URL must be 1 or more lowercase alphanumeric characters',
                }),
            );
            break;

        case ServerErrorId.CHANNEL_UPDATE_EXISTS:
        case ServerErrorId.CHANNEL_CREATE_EXISTS:
            setURLError(
                formatMessage({
                    id: 'channel_modal.alreadyExist',
                    defaultMessage: 'A channel with that URL already exists',
                }),
            );
            break;

        case ServerErrorId.CHANNEL_PURPOSE_SIZE:
            setPurposeError(
                formatMessage({
                    id: 'channel_modal.purposeTooLong',
                    defaultMessage: 'The purpose exceeds the maximum of 250 characters',
                }),
            );
            break;

        default:
            setServerError(message);
            break;
        }
    };

    const handleOnTypeChange = useCallback((channelType: ChannelType) => {
        setType(channelType);
        setServerError('');
    }, []);

    const handleOnPurposeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        e.preventDefault();
        const {target: {value: purpose}} = e;

        setPurpose(purpose);
        setPurposeError('');
        setServerError('');
    };

    const handleOnPurposeKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Avoid firing the handleEnterKeyPress in GenericModal from purpose textarea
        e.stopPropagation();
    };

    const canCreate = displayName && !urlError && type && !purposeError && !serverError && canCreateFromPluggable && !channelInputError;

    const newBoardInfoIcon = (
        <OverlayTrigger
            delayShow={Constants.OVERLAY_TIME_DELAY}
            placement='right'
            overlay={(
                <Tooltip
                    id='new-channel-with-board-tooltip'
                >
                    <div className='title'>
                        <FormattedMessage
                            id={'channel_modal.create_board.tooltip_title'}
                            defaultMessage={'Manage your task with a board'}
                        />
                    </div>
                    <div className='description'>
                        <FormattedMessage
                            id={'channel_modal.create_board.tooltip_description'}
                            defaultMessage={'Use any of our templates to manage your tasks or start from scratch with your own!'}
                        />
                    </div>
                </Tooltip>
            )}
        >
            <i className='icon-information-outline'/>
        </OverlayTrigger>
    );

    return (
        <GenericModal
            id='new-channel-modal'
            className='new-channel-modal'
            modalHeaderText={formatMessage({id: 'channel_modal.modalTitle', defaultMessage: 'Create a new channel'})}
            confirmButtonText={formatMessage({id: 'channel_modal.createNew', defaultMessage: 'Create channel'})}
            cancelButtonText={formatMessage({id: 'channel_modal.cancel', defaultMessage: 'Cancel'})}
            errorText={serverError}
            isConfirmDisabled={!canCreate}
            autoCloseOnConfirmButton={false}
            compassDesign={true}
            handleConfirm={handleOnModalConfirm}
            handleEnterKeyPress={handleOnModalConfirm}
            handleCancel={handleOnModalCancel}
            onExited={handleOnModalCancel}
        >
            <div className='new-channel-modal-body'>
                <ChannelNameFormField
                    value={displayName}
                    name='new-channel-modal-name'
                    placeholder={formatMessage({id: 'channel_modal.name.placeholder', defaultMessage: 'Enter a name for your new channel'})}
                    onDisplayNameChange={setDisplayName}
                    onURLChange={handleURLChange}
                    onErrorStateChange={setChannelInputError}
                    urlError={urlError}
                />
                <PublicPrivateSelector
                    className='new-channel-modal-type-selector'
                    selected={type}
                    publicButtonProps={{
                        title: formatMessage({id: 'channel_modal.type.public.title', defaultMessage: 'Public Channel'}),
                        description: formatMessage({id: 'channel_modal.type.public.description', defaultMessage: 'Anyone can join'}),
                        disabled: !canCreatePublicChannel,
                    }}
                    privateButtonProps={{
                        title: formatMessage({id: 'channel_modal.type.private.title', defaultMessage: 'Private Channel'}),
                        description: formatMessage({id: 'channel_modal.type.private.description', defaultMessage: 'Only invited members'}),
                        disabled: !canCreatePrivateChannel,
                    }}
                    onChange={handleOnTypeChange}
                />
                <div className='new-channel-modal-purpose-container'>
                    <textarea
                        id='new-channel-modal-purpose'
                        className={classNames('new-channel-modal-purpose-textarea', {'with-error': purposeError})}
                        placeholder={formatMessage({id: 'channel_modal.purpose.placeholder', defaultMessage: 'Enter a purpose for this channel (optional)'})}
                        rows={4}
                        maxLength={Constants.MAX_CHANNELPURPOSE_LENGTH}
                        autoComplete='off'
                        value={purpose}
                        onChange={handleOnPurposeChange}
                        onKeyDown={handleOnPurposeKeyDown}
                    />
                    {purposeError ? (
                        <div className='new-channel-modal-purpose-error'>
                            <i className='icon icon-alert-outline'/>
                            <span>{purposeError}</span>
                        </div>
                    ) : (
                        <div className='new-channel-modal-purpose-info'>
                            <span>
                                {formatMessage({id: 'channel_modal.purpose.info', defaultMessage: 'This will be displayed when browsing for channels.'})}
                            </span>
                        </div>
                    )}
                    {createBoardFromChannelPlugin &&
                        <Pluggable
                            pluggableName='CreateBoardFromTemplate'
                            setCanCreate={setCanCreateFromPluggable}
                            setAction={setActionFromPluggable}
                            newBoardInfoIcon={newBoardInfoIcon}
                        />
                    }
                </div>
            </div>
        </GenericModal>
    );
};

export default NewChannelModal;
