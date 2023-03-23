// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react';
import {useIntl} from 'react-intl';

import ConfirmModalLight from 'src/components/widgets/confirmation_modal_light';

interface Props {
    show: boolean;
    title?: React.ReactNode;
    message?: React.ReactNode;
    confirmButtonText?: React.ReactNode;
    onConfirm: () => void;
    onCancel: () => void;
}
const UnsavedChangesModal = ({
    show,
    title,
    message,
    confirmButtonText,
    onConfirm,
    onCancel,
}: Props) => {
    const {formatMessage} = useIntl();
    return (
        <ConfirmModalLight
            show={show}
            title={title || formatMessage({defaultMessage: 'You have unsaved changes'})}
            message={message || formatMessage({defaultMessage: 'Changes that you made will not be saved if you leave this page. Are you sure you want to discard changes and leave?'})}
            confirmButtonText={confirmButtonText || formatMessage({defaultMessage: 'Discard & leave'})}
            isConfirmDestructive={true}
            onConfirm={onConfirm}
            onCancel={onCancel}
        />
    );
};

export default UnsavedChangesModal;
