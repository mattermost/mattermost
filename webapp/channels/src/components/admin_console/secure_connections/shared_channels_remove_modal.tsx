// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';

import SectionNotice from 'components/section_notice';

import {ModalBody, ModalParagraph} from './controls';

type Props = {
    onConfirm: () => void;
    onCancel?: () => void;
    onExited: () => void;
}

const noop = () => {};

function SharedChannelsRemoveModal({
    onExited,
    onCancel,
    onConfirm,
}: Props) {
    const {formatMessage} = useIntl();

    const [confirmed, setConfirmed] = useState(false);

    const handleConfirm = () => {
        if (confirmed) {
            onConfirm();
        } else {
            setConfirmed(true);
        }
    };

    return (
        <GenericModal
            modalHeaderText={(
                <FormattedMessage
                    id='admin.secure_connections.shared_channels.confirm.remove.title'
                    defaultMessage='Remove channel'
                />
            )}
            handleCancel={onCancel ?? noop}
            handleConfirm={handleConfirm}
            confirmButtonText={(
                <FormattedMessage
                    id='admin.secure_connections.shared_channels.confirm.remove.button'
                    defaultMessage='Permanently remove'
                />
            )}
            onExited={onExited}
            compassDesign={true}
            isDeleteModal={true}
            bodyPadding={false}
            autoCloseOnConfirmButton={confirmed}
        >
            <ModalBody>
                <FormattedMessage
                    tagName={ModalParagraph}
                    id={'admin.secure_connections.shared_channels.confirm.remove.message'}
                    defaultMessage={'This channel was accepted, removing the channel would sever the connection between the remote server.'}
                />
                {confirmed && (
                    <SectionNotice
                        title={formatMessage({
                            id: 'admin.secure_connections.create_invite.create_invite.notice.title',
                            defaultMessage: 'This is an irreversible action, once removed the channel cannot be shared again by either server.',
                        })}
                        type='danger'
                    />
                )}
            </ModalBody>
        </GenericModal>
    );
}

export default SharedChannelsRemoveModal;
