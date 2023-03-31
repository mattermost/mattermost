// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {closeModal, openModal} from 'actions/views/modals';
import PaymentFailedSvg from 'components/common/svg_images_components/payment_failed_svg';
import {ModalIdentifiers} from 'utils/constants';

import DeleteWorkspaceModal from './delete_workspace_modal';
import ResultModal from './result_modal';

export default function DeleteWorkspaceFailureModal() {
    const dispatch = useDispatch();

    const handleButtonClick = () => {
        dispatch(closeModal(ModalIdentifiers.DELETE_WORKSPACE_RESULT));
        dispatch(openModal({
            modalId: ModalIdentifiers.DELETE_WORKSPACE,
            dialogType: DeleteWorkspaceModal,
            dialogProps: {
                callerCTA: 'delete_workspace_failure_modal',
            },
        }));
    };

    const title = (
        <FormattedMessage
            defaultMessage={'Workspace deletion failed'}
            id={'admin.billing.deleteWorkspace.failureModal.title'}
        />
    );

    const subtitle = (
        <FormattedMessage
            id={'admin.billing.deleteWorkspace.failureModal.subtitle'}
            defaultMessage={'We ran into an issue deleting your workspace. Please try again or contact support.'}
        />
    );

    const buttonText = (
        <FormattedMessage
            id='admin.billing.deleteWorkspace.failureModal.buttonText'
            defaultMessage={'Try Again'}
        />
    );

    return (
        <ResultModal
            primaryButtonText={buttonText}
            primaryButtonHandler={handleButtonClick}
            identifier={ModalIdentifiers.DELETE_WORKSPACE_RESULT}
            subtitle={subtitle}
            title={title}
            ignoreExit={false}
            resultType='failure'
            icon={
                <PaymentFailedSvg
                    width={444}
                    height={313}
                />
            }
            contactSupportButtonVisible={true}
        />
    );
}
