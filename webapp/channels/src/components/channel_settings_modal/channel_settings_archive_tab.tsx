// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback} from 'react';
import {FormattedMessage, defineMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';
import type {Channel} from '@mattermost/types/channels';

import {deleteChannel} from 'actions/views/channel';

import ConfirmationModal from 'components/confirm_modal';

import {useChannelKind} from 'hooks/useChannelKind';
import type {KindMessages} from 'utils/channel_kind';

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
    const kind = useChannelKind(channel);

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
            <FormattedMessage {...messages.warning[kind]}/>
            <Button
                type='button'
                variant='destructive'
                onClick={handleArchiveChannel}
                id='channelSettingsArchiveChannelButton'
                aria-label={`Archive ${kind} ${channel.display_name}`}
            >
                <FormattedMessage {...messages.button[kind]}/>
            </Button>

            {showArchiveConfirmModal && (
                <ConfirmationModal
                    id='archiveChannelConfirmModal'
                    show={true}
                    title={formatMessage(messages.confirmTitle[kind])}
                    message={
                        <div>
                            <p>
                                <FormattedMessage {...messages.confirmWarning[kind]}/>
                            </p>
                            <p>
                                <FormattedMessage
                                    {...messages.confirmArchive[kind]}
                                    values={{
                                        display_name: channel.display_name,
                                        strong: (chunks) => <strong>{chunks}</strong>,
                                    }}
                                />
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

/* eslint-disable formatjs/enforce-placeholders -- values are passed where each message is rendered */
const messages = {
    warning: {
        channel: defineMessage({
            id: 'channel_settings.archive.warning',
            defaultMessage: "Archiving a channel removes it from the user interface, but doesn't permanently delete the channel. New messages can't be posted to archived channels.",
        }),
        board: defineMessage({
            id: 'channel_settings.archive.warning.board',
            defaultMessage: "Archiving a board removes it from the user interface, but doesn't permanently delete the board. New messages can't be posted to archived boards.",
        }),
    },
    button: {
        channel: defineMessage({
            id: 'channel_settings.archive.button',
            defaultMessage: 'Archive this channel',
        }),
        board: defineMessage({
            id: 'channel_settings.archive.button.board',
            defaultMessage: 'Archive this board',
        }),
    },
    confirmTitle: {
        channel: defineMessage({
            id: 'channel_settings.modal.archiveTitle',
            defaultMessage: 'Archive channel?',
        }),
        board: defineMessage({
            id: 'channel_settings.modal.archiveTitle.board',
            defaultMessage: 'Archive board?',
        }),
    },
    confirmWarning: {
        channel: defineMessage({
            id: 'deleteChannelModal.canViewArchivedChannelsWarning',
            defaultMessage: 'This will archive the channel from the team. Channel contents will still be accessible by channel members.',
        }),
        board: defineMessage({
            id: 'deleteChannelModal.canViewArchivedChannelsWarning.board',
            defaultMessage: 'This will archive the board from the team. Board contents will still be accessible by board members.',
        }),
    },
    confirmArchive: {
        channel: defineMessage({
            id: 'deleteChannelModal.confirmArchive',
            defaultMessage: 'Are you sure you wish to archive the <strong>{display_name}</strong> channel?',
        }),
        board: defineMessage({
            id: 'deleteChannelModal.confirmArchive.board',
            defaultMessage: 'Are you sure you wish to archive the <strong>{display_name}</strong> board?',
        }),
    },
} satisfies Record<string, KindMessages>;
/* eslint-enable formatjs/enforce-placeholders */

export default ChannelSettingsArchiveTab;
