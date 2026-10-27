// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';
import type {Channel} from '@mattermost/types/channels';

import {deleteChannel} from 'actions/views/channel';

import ConfirmationModal from 'components/confirm_modal';

import {useIsBoardChannel} from 'hooks/useIsBoardChannel';

type ChannelSettingsArchiveTabProps = {
    channel: Channel;
    onHide: () => void;
};

function ChannelSettingsArchiveTab({
    channel,
    onHide,
}: ChannelSettingsArchiveTabProps) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const isBoard = useIsBoardChannel(channel);

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
            {isBoard ? (
                <FormattedMessage
                    id='channel_settings.archive.warning.board'
                    defaultMessage="Archiving a board removes it from the user interface, but doesn't permanently delete the board. New messages can't be posted to archived boards."
                />
            ) : (
                <FormattedMessage
                    id='channel_settings.archive.warning'
                    defaultMessage="Archiving a channel removes it from the user interface, but doesn't permanently delete the channel. New messages can't be posted to archived channels."
                />
            )}
            <Button
                type='button'
                variant='destructive'
                onClick={handleArchiveChannel}
                id='channelSettingsArchiveChannelButton'
                aria-label={isBoard ? `Archive board ${channel.display_name}` : `Archive channel ${channel.display_name}`}
            >
                {isBoard ? (
                    <FormattedMessage
                        id='channel_settings.archive.button.board'
                        defaultMessage='Archive this board'
                    />
                ) : (
                    <FormattedMessage
                        id='channel_settings.archive.button'
                        defaultMessage='Archive this channel'
                    />
                )}
            </Button>

            {showArchiveConfirmModal && (
                <ConfirmationModal
                    id='archiveChannelConfirmModal'
                    show={true}
                    title={isBoard ? formatMessage({id: 'channel_settings.modal.archiveTitle.board', defaultMessage: 'Archive board?'}) : formatMessage({id: 'channel_settings.modal.archiveTitle', defaultMessage: 'Archive channel?'})}
                    message={
                        <div>
                            <p>
                                {isBoard ? (
                                    <FormattedMessage
                                        id='deleteChannelModal.canViewArchivedChannelsWarning.board'
                                        defaultMessage='This will archive the board from the team. Board contents will still be accessible by board members.'
                                    />
                                ) : (
                                    <FormattedMessage
                                        id='deleteChannelModal.canViewArchivedChannelsWarning'
                                        defaultMessage='This will archive the channel from the team. Channel contents will still be accessible by channel members.'
                                    />
                                )}
                            </p>
                            <p>
                                {isBoard ? (
                                    <FormattedMessage
                                        id='deleteChannelModal.confirmArchive.board'
                                        defaultMessage='Are you sure you wish to archive the <strong>{display_name}</strong> board?'
                                        values={{
                                            display_name: channel.display_name,
                                            strong: (chunks) => <strong>{chunks}</strong>,
                                        }}
                                    />
                                ) : (
                                    <FormattedMessage
                                        id='deleteChannelModal.confirmArchive'
                                        defaultMessage='Are you sure you wish to archive the <strong>{display_name}</strong> channel?'
                                        values={{
                                            display_name: channel.display_name,
                                            strong: (chunks) => <strong>{chunks}</strong>,
                                        }}
                                    />
                                )}
                            </p>
                        </div>
                    }
                    confirmButtonText={formatMessage({id: 'channel_settings.modal.confirmArchive', defaultMessage: 'Confirm'})}
                    onConfirm={doArchiveChannel}
                    onCancel={() => setShowArchiveConfirmModal(false)}
                    confirmButtonVariant='destructive'
                    modalClass='archiveChannelConfirmModal'
                    focusOriginElement='channelSettingsArchiveChannelButton'
                    isStacked={true}
                />
            )}
        </div>
    );
}

export default ChannelSettingsArchiveTab;
