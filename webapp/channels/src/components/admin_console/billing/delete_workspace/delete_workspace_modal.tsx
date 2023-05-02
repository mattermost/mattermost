// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {FormattedMessage} from 'react-intl';

import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';

import LaptopAlertSVG from 'components/common/svg_images_components/laptop_alert_svg';
import {closeModal, openModal} from 'actions/views/modals';

import './delete_workspace_modal.scss';
import {CloudProducts, ModalIdentifiers, StatTypes} from 'utils/constants';
import DeleteFeedbackModal from 'components/admin_console/billing/delete_workspace/delete_feedback';
import DowngradeFeedbackModal from 'components/feedback_modal/downgrade_feedback';
import {Feedback} from '@mattermost/types/cloud';
import {GlobalState} from 'types/store';
import useGetUsage from 'components/common/hooks/useGetUsage';
import {fileSizeToString} from 'utils/utils';
import useOpenDowngradeModal from 'components/common/hooks/useOpenDowngradeModal';
import {subscribeCloudSubscription, deleteWorkspace as deleteWorkspaceRequest} from 'actions/cloud';
import ErrorModal from 'components/cloud_subscribe_result_modal/error';
import DeleteWorkspaceProgressModal from 'components/admin_console/billing/delete_workspace/progress_modal';
import SuccessModal from 'components/cloud_subscribe_result_modal/success';
import {getSubscriptionProduct} from 'mattermost-redux/selectors/entities/cloud';
import {isCloudLicense} from 'utils/license_utils';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {DispatchFunc} from 'mattermost-redux/types/actions';
import useGetSubscription from 'components/common/hooks/useGetSubscription';

import DeleteWorkspaceSuccessModal from './success_modal';
import DeleteWorkspaceFailureModal from './failure_modal';

type Props = {
    callerCTA: string;
}

export default function DeleteWorkspaceModal(props: Props) {
    const dispatch = useDispatch<DispatchFunc>();
    const openDowngradeModal = useOpenDowngradeModal();

    // License/product checks.
    const subscription = useGetSubscription();
    const product = useSelector(getSubscriptionProduct);
    const isStarter = product?.sku === CloudProducts.STARTER;
    const isEnterprise = product?.sku === CloudProducts.ENTERPRISE;
    const license = useSelector(getLicense);
    const isNotCloud = !isCloudLicense(license);

    // Starter product for downgrade purposes.
    const starterProduct = useSelector((state: GlobalState) => {
        return Object.values(state.entities.cloud.products || {}).find((product) => {
            return product.sku === CloudProducts.STARTER;
        });
    });

    // Get usage information in an attempt to defer customer from deleting.
    const usage = useGetUsage();
    const totalFileSize = fileSizeToString(usage.files.totalStorage);
    const totalMessages = useSelector((state: GlobalState) => {
        if (!state.entities.admin.analytics) {
            return 0;
        }
        return state.entities.admin.analytics[StatTypes.TOTAL_POSTS];
    });

    // Handles the delete button clicks.
    const handleClickDeleteWorkspace = () => {
        // Close the delete workspace modal and ope na feedback modal, with a workspace
        // deletion upon completion of the feedback.
        dispatch(closeModal(ModalIdentifiers.DELETE_WORKSPACE));
        dispatch(openModal({
            modalId: ModalIdentifiers.FEEDBACK,
            dialogType: DeleteFeedbackModal,
            dialogProps: {
                onSubmit: deleteWorkspace,
            },
        }));
    };

    // Handles the downgrade button clicks.
    const handleClickDowngradeWorkspace = () => {
        // Close the delete workspace modal and ope na feedback modal, with a workspace
        // downgrade upon completion of the feedback.
        dispatch(closeModal(ModalIdentifiers.DELETE_WORKSPACE));
        dispatch(openModal({
            modalId: ModalIdentifiers.FEEDBACK,
            dialogType: DowngradeFeedbackModal,
            dialogProps: {
                onSubmit: downgradeWorkspace,
            },
        }));
    };

    // Handles the cancel button clicks.
    const handleClickCancel = () => {
        dispatch(closeModal(ModalIdentifiers.DELETE_WORKSPACE));
        dispatch(closeModal(ModalIdentifiers.FEEDBACK));
    };

    // Processes the workspace deletion, opening and closing the appropriate modals (progress, success/failure).
    const deleteWorkspace = async (deleteFeedback: Feedback) => {
        dispatch(openModal({
            modalId: ModalIdentifiers.DELETE_WORKSPACE_PROGRESS,
            dialogType: DeleteWorkspaceProgressModal,
        }));
        dispatch(closeModal(ModalIdentifiers.DOWNGRADE_MODAL));

        if (subscription === undefined) {
            return;
        }

        const result = await dispatch(deleteWorkspaceRequest({subscription_id: subscription?.id, delete_feedback: deleteFeedback}));

        if (typeof result === 'boolean' && result) {
            dispatch(closeModal(ModalIdentifiers.DELETE_WORKSPACE_PROGRESS));
            dispatch(openModal({
                modalId: ModalIdentifiers.DELETE_WORKSPACE_RESULT,
                dialogType: DeleteWorkspaceSuccessModal,
            }));
        } else { // Failure
            dispatch(openModal({
                modalId: ModalIdentifiers.DELETE_WORKSPACE_RESULT,
                dialogType: DeleteWorkspaceFailureModal,
            }));
            dispatch(closeModal(ModalIdentifiers.DELETE_WORKSPACE_PROGRESS));
        }
    };

    // Processes the workspace downgrade, opening and closing the appropriate modals (progress, success/failure).
    const downgradeWorkspace = async (downgradeFeedback: Feedback) => {
        if (!starterProduct) {
            return;
        }

        const telemetryInfo = props.callerCTA + ' > delete_workspace_modal';
        openDowngradeModal({trackingLocation: telemetryInfo});

        const result = await dispatch(subscribeCloudSubscription(starterProduct.id, undefined, 0, downgradeFeedback));

        // Success
        if (result.data) {
            dispatch(closeModal(ModalIdentifiers.DOWNGRADE_MODAL));
            dispatch(
                openModal({
                    modalId: ModalIdentifiers.SUCCESS_MODAL,
                    dialogType: SuccessModal,
                    dialogProps: {
                        newProductName: starterProduct.name,
                    },
                }),
            );
        } else { // Failure
            dispatch(closeModal(ModalIdentifiers.DOWNGRADE_MODAL));
            dispatch(
                openModal({
                    modalId: ModalIdentifiers.ERROR_MODAL,
                    dialogType: ErrorModal,
                    dialogProps: {
                        backButtonAction: () => {
                            dispatch(openModal({
                                modalId: ModalIdentifiers.DELETE_WORKSPACE,
                                dialogType: DeleteWorkspaceModal,
                                dialogProps: {
                                    callerCTA: props.callerCTA,
                                },
                            }));
                        },
                    },
                }),
            );
        }
    };

    if (isNotCloud) {
        return null;
    }

    return (
        <GenericModal
            className='DeleteWorkspaceModal'
            onExited={handleClickCancel}
        >
            <div className='DeleteWorkspaceModal__Icon'>
                <LaptopAlertSVG height={156}/>
            </div>
            <div className='DeleteWorkspaceModal__Title'>
                <FormattedMessage
                    id='admin.billing.subscription.deleteWorkspaceModal.title'
                    defaultMessage='Are you sure you want to delete?'
                />
            </div>
            <div className='DeleteWorkspaceModal__Usage'>
                <FormattedMessage
                    id='admin.billing.subscription.deleteWorkspaceModal.usage'
                    defaultMessage='As part of your subscription to Mattermost {sku} you have created '
                    values={{
                        sku: product?.name,
                    }}
                />
                <span className='DeleteWorkspaceModal__Usage-Highlighted'>
                    <FormattedMessage
                        id='admin.billing.subscription.deleteWorkspaceModal.usageDetails'
                        defaultMessage='{messageCount} messages and {fileSize} of files'
                        values={{
                            messageCount: totalMessages,
                            fileSize: totalFileSize,
                        }}
                    />
                </span>
            </div>
            <div className='DeleteWorkspaceModal__Warning'>
                <FormattedMessage
                    id='admin.billing.subscription.deleteWorkspaceModal.warning'
                    defaultMessage="Deleting your workspace is final. Upon deleting, you'll lose all of the above with no ability to recover. If you downgrade to Free, you will not lose this information."
                />
            </div>
            <div className='DeleteWorkspaceModal__Buttons'>
                <button
                    className='btn DeleteWorkspaceModal__Buttons-Delete'
                    onClick={handleClickDeleteWorkspace}
                >
                    <FormattedMessage
                        id='admin.billing.subscription.deleteWorkspaceModal.deleteButton'
                        defaultMessage='Delete Workspace'
                    />
                </button>
                {!isStarter && !isEnterprise &&
                    <button
                        className='btn DeleteWorkspaceModal__Buttons-Downgrade'
                        onClick={handleClickDowngradeWorkspace}
                    >
                        <FormattedMessage
                            id='admin.billing.subscription.deleteWorkspaceModal.downgradeButton'
                            defaultMessage='Downgrade To Free'
                        />
                    </button>
                }
                <button
                    className='btn btn-primary DeleteWorkspaceModal__Buttons-Cancel'
                    onClick={handleClickCancel}
                >
                    <FormattedMessage
                        id='admin.billing.subscription.deleteWorkspaceModal.cancelButton'
                        defaultMessage='Keep Subscription'
                    />
                </button>
            </div>
        </GenericModal>
    );
}
