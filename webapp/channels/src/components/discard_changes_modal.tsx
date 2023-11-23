// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import ConfirmModal from 'components/confirm_modal';

type Props = {
    show: boolean;
    onConfirm: (checked: boolean) => void;
    onCancel: (checked: boolean) => void;
}

export default class DiscardChangesModal extends React.PureComponent<Props> {
    public render(): JSX.Element {
        const title: JSX.Element = (
            <FormattedMessage
                id='discard_changes_modal.title'
                defaultMessage='Discard Changes?'
            />
        );

        const message: JSX.Element = (
            <FormattedMessage
                id='discard_changes_modal.message'
                defaultMessage='You have unsaved changes, are you sure you want to discard them?'
            />
        );

        const buttonClass = 'btn btn-primary';
        const button: JSX.Element = (
            <FormattedMessage
                id='discard_changes_modal.leave'
                defaultMessage='Yes, Discard'
            />
        );

        const modalClass = 'discard-changes-modal';

        const {show, onConfirm, onCancel} = this.props;

        return (
            <ConfirmModal
                show={show}
                title={title}
                message={message}
                modalClass={modalClass}
                confirmButtonClass={buttonClass}
                confirmButtonText={button}
                onConfirm={onConfirm}
                onCancel={onCancel}
            />
        );
    }
}
