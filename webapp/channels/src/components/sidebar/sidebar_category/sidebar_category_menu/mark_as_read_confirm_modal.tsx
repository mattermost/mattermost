// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';

import '../../../category_modal.scss';

type Props = {
    handleConfirm: () => void;
    numChannels: number;
};

const MarkAsReadConfirmModal = ({
    handleConfirm,
    numChannels,
}: Props) => {
    const intl = useIntl();

    const header = intl.formatMessage({id: 'mark_as_read_confirm_modal.header', defaultMessage: 'Mark as read'});
    const body = intl.formatMessage({id: 'mark_as_read_confirm_modal.body', defaultMessage: 'You are about to mark as read {numChannels, plural, =1 {one channel} other {# channels}}.'}, {numChannels});
    const confirm = intl.formatMessage({id: 'mark_as_read_confirm_modal.confirm', defaultMessage: 'Mark as read'});

    return (
        <GenericModal
            ariaLabel={header}
            modalHeaderText={header}
            handleConfirm={handleConfirm}
            confirmButtonText={confirm}
            confirmButtonClassName={'delete'}
        >
            <span className='mark-as-read__helpText'>
                {body}
            </span>
        </GenericModal>
    );
};

export default MarkAsReadConfirmModal;
