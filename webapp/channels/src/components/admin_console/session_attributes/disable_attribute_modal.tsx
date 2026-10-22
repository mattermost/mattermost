// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';

type Props = {
    attributeName: string;
    onConfirm: () => void;
    onCancel?: () => void;
    onExited: () => void;
};

const noop = () => {};

export default function DisableAttributeModal({attributeName, onConfirm, onCancel, onExited}: Props) {
    const {formatMessage} = useIntl();

    return (
        <GenericModal
            compassDesign={true}
            confirmButtonVariant='destructive'
            confirmButtonText={formatMessage({id: 'admin.session_attributes.disable.confirm', defaultMessage: 'Disable'})}
            modalHeaderText={formatMessage({id: 'admin.session_attributes.disable.title', defaultMessage: 'Disable attribute'})}
            handleConfirm={onConfirm}
            handleCancel={onCancel ?? noop}
            onExited={onExited}
        >
            <FormattedMessage
                id='admin.session_attributes.disable.body'
                defaultMessage='Disabling {name} stops it from being evaluated in session and access control policies. You can re-enable it at any time.'
                values={{name: <strong>{attributeName}</strong>}}
            />
        </GenericModal>
    );
}
