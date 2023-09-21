// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';

import 'components/category_modal.scss';

type Props = {
    handleConfirm: () => void;
    numChannels: number;
    onExited: () => void;
};

const handleCancel = () => null;

const MarkAsReadConfirmModal = ({
    handleConfirm,
    numChannels,
    onExited,
}: Props) => {
    const intl = useIntl();

    const header = intl.formatMessage({id: 'mark_as_read_confirm_modal.header', defaultMessage: 'Mark as read'});
    const body = intl.formatMessage({id: 'mark_as_read_confirm_modal.body', defaultMessage: 'Are you sure you want to mark {numChannels} channels as read?'}, {numChannels});
    const confirm = intl.formatMessage({id: 'mark_as_read_confirm_modal.confirm', defaultMessage: 'Mark as read'});

    return (
        <GenericModal
            ariaLabel={header}
            modalHeaderText={header}
            handleConfirm={handleConfirm}
            handleCancel={handleCancel}
            onExited={onExited}
            confirmButtonText={confirm}
        >
            <span className='mark-as-read__helpText'>
                {body}
            </span>
        </GenericModal>
    );
};

export default MarkAsReadConfirmModal;
