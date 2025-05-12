// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {deleteChannel} from 'actions/views/channel';

import ConfirmationModal from 'components/confirm_modal';

import type {GlobalState} from 'types/store';

type ChannelSettingsArchiveTabProps = {
    channel: Channel;
    onHide: () => void;
}

function ChannelSettingsArchiveTab({
    channel,
    onHide,
}: ChannelSettingsArchiveTabProps) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    // Redux selector
    const canViewArchivedChannels = useSelector((state: GlobalState) => getConfig(state).ExperimentalViewArchivedChannels === 'true');

    const [showArchiveConfirmModal, setShowArchiveConfirmModal] = useState(false);

    const handleArchiveChannel = useCallback(() => {
        setShowArchiveConfirmModal(true);
    }, []);

    const doArchiveChannel = async () => {
        // Call the delete channel action which handles validation, redirection, and notification sounds
        await dispatch(deleteChannel(channel.id));

        // Close the modal
        onHide();
    };

    return (
        <div className='ChannelSettingsModal__archiveTab'>
            <FormattedMessage
                id='channel_settings.archive.warning'
                defaultMessage="Archiving a channel removes it from the user interface, but doesn't permanently delete the channel. New messages can't be posted to archived channels."
            />
            <button
                type='button'
                className='btn btn-danger'
                onClick={handleArchiveChannel}
                id='channelSettingsArchiveChannelButton'
                aria-label={`Archive channel ${channel.display_name}`}
            >
                <FormattedMessage
                    id='channel_settings.archive.button'
                    defaultMessage='Archive this channel'
                />
            </button>

            {showArchiveConfirmModal && (
                <ConfirmationModal
                    id='archiveChannelConfirmModal'
                    show={true}
                    title={formatMessage({id: 'channel_settings.modal.archiveTitle', defaultMessage: 'Archive channel?'})}
                    message={
                        <div>
                            <p>
                                <FormattedMessage
                                    id={canViewArchivedChannels ?
                                        'deleteChannelModal.canViewArchivedChannelsWarning' :
                                        'deleteChannelModal.cannotViewArchivedChannelsWarning'
                                    }
                                    defaultMessage="Archiving a channel removes it from the user interface, but doesn't permanently delete the channel. New messages can't be posted to archived channels."
                                />
                            </p>
                            <p>
                                <FormattedMessage
                                    id='deleteChannelModal.confirmArchive'
                                    defaultMessage='Are you sure you wish to archive the <strong>{display_name}</strong> channel?'
                                    values={{
                                        display_name: channel.display_name,
                                        strong: (chunks: string) => <strong>{chunks}</strong>,
                                    }}
                                />
                            </p>
                        </div>
                    }
                    confirmButtonText={formatMessage({id: 'channel_settings.modal.confirmArchive', defaultMessage: 'Confirm'})}
                    onConfirm={doArchiveChannel}
                    onCancel={() => setShowArchiveConfirmModal(false)}
                    confirmButtonClass='btn btn-danger'
                    modalClass='archiveChannelConfirmModal'
                    focusOriginElement='channelSettingsArchiveChannelButton'
                />
            )}
        </div>
    );
}

export default ChannelSettingsArchiveTab;
