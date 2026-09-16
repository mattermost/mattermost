// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {Channel} from '@mattermost/types/channels';

import type {ActionResult} from 'mattermost-redux/types/actions';

import AlertBanner from 'components/alert_banner';
import useMissingRequiredChannelAttributes from 'components/common/hooks/useMissingRequiredChannelAttributes';

import Constants from 'utils/constants';

export type ChannelDetailsActions = {
    unarchiveChannel: (channelId: string) => Promise<ActionResult>;
};

type Props = {
    onExited: () => void;
    channel: Channel;
    actions: ChannelDetailsActions;
};

export default function UnarchiveChannelModal({onExited, channel, actions}: Props) {
    const [show, setShow] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [serverError, setServerError] = useState<string | undefined>();

    // Advisory only -- see the hook's doc comment. Never blocks the restore;
    // it only changes the copy and the confirm button label.
    const {missing} = useMissingRequiredChannelAttributes(channel.id);

    const handleUnarchive = async () => {
        if (channel.id.length !== Constants.CHANNEL_ID_LENGTH) {
            return;
        }

        setSubmitting(true);
        setServerError(undefined);

        const result = await actions.unarchiveChannel(channel.id);
        if (result.error) {
            setServerError(result.error.message);
            setSubmitting(false);
            return;
        }

        setShow(false);
    };

    const handleHide = () => {
        setShow(false);
    };

    return (
        <GenericModal
            id='unarchiveChannelModal'
            className='a11y__modal'
            show={show}
            onHide={handleHide}
            onExited={onExited}
            ariaLabel='unarchive_channel_modal'
            modalHeaderText={(
                <FormattedMessage
                    id='unarchive_channel.confirm'
                    defaultMessage='Confirm UNARCHIVE Channel'
                />
            )}
            handleCancel={handleHide}
            handleConfirm={handleUnarchive}
            autoCloseOnConfirmButton={false}
            isConfirmDisabled={submitting}
            confirmButtonVariant='destructive'
            confirmButtonText={(
                <FormattedMessage
                    id={missing.length > 0 ? 'unarchive_channel.missing_attributes.confirm' : 'unarchive_channel.del'}
                    defaultMessage={missing.length > 0 ? 'Unarchive anyway' : 'Unarchive'}
                />
            )}
            cancelButtonText={(
                <FormattedMessage
                    id='unarchive_channel.cancel'
                    defaultMessage='Cancel'
                />
            )}
            errorText={serverError}
            compassDesign={true}
        >
            <div className='alert alert-danger'>
                <FormattedMessage
                    id='unarchiveChannelModal.viewArchived.question'
                    defaultMessage={'Are you sure you wish to unarchive the <b>{display_name}</b> channel?'}
                    values={{
                        display_name: channel.display_name,
                        b: (chunks: React.ReactNode) => <b>{chunks}</b>,
                    }}
                />
            </div>
            {missing.length > 0 && (
                <AlertBanner
                    id='unarchiveChannelModalMissingAttributes'
                    mode='warning'
                    title={(
                        <FormattedMessage
                            id='unarchive_channel.missing_attributes.title'
                            defaultMessage='Missing required attribute values'
                        />
                    )}
                    message={(
                        <FormattedMessage
                            id='unarchive_channel.missing_attributes.body'
                            defaultMessage='This channel has no value for {attributes}. {count, plural, one {That attribute is} other {Those attributes are}} required. You can set the {count, plural, one {value} other {values}} after restoring the channel.'
                            values={{
                                attributes: missing.map((field) => (field.attrs?.display_name as string | undefined) || field.name).join(', '),
                                count: missing.length,
                            }}
                        />
                    )}
                />
            )}
        </GenericModal>
    );
}
