// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';

type Props = {

}

export default function FlagPostModal(props: Props) {
    const {formatMessage} = useIntl();

    const label = formatMessage({id: 'flag_message_modal.title', defaultMessage: 'Flag message'});

    return (
        <GenericModal
            id='FlagPostModal'
            ariaLabel={label}
            modalHeaderText={label}
            compassDesign={true}
            keyboardEscape={true}
            enforceFocus={false}
        >
            <h1>{'Welcome to flag post modal!'}</h1>
        </GenericModal>
    );
}
