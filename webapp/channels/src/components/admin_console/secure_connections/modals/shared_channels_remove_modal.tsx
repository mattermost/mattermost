// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {GenericModal} from '@mattermost/components';

import {ModalBody, ModalParagraph} from '../controls';

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
    const handleConfirm = () => {
        onConfirm();
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
                    defaultMessage='Remove'
                />
            )}
            onExited={onExited}
            compassDesign={true}
            isDeleteModal={true}
            bodyPadding={false}
        >
            <ModalBody>
                <FormattedMessage
                    tagName={ModalParagraph}
                    id={'admin.secure_connections.shared_channels.confirm.remove.message'}
                    defaultMessage={'The channel will be removed from this connection and will no longer be shared with it.'}
                />
            </ModalBody>
        </GenericModal>
    );
}

export default SharedChannelsRemoveModal;
