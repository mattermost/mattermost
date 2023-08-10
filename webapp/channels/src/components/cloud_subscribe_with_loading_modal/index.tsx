// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useRef} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';
import {withRouter} from 'react-router-dom';

import {subscribeCloudSubscription} from 'actions/cloud';
import {closeModal} from 'actions/views/modals';
import {isModalOpen} from 'selectors/views/modals';

import CreditCardSvg from 'components/common/svg_images_components/credit_card_svg';
import PaymentFailedSvg from 'components/common/svg_images_components/payment_failed_svg';
import PaymentSuccessStandardSvg from 'components/common/svg_images_components/payment_success_standard_svg';
import ProgressBar, {ProcessState} from 'components/icon_message_with_progress_bar';
import IconMessage from 'components/purchase_modal/icon_message';
import FullScreenModal from 'components/widgets/modals/full_screen_modal';

import {ModalIdentifiers} from 'utils/constants';
import {t} from 'utils/i18n';

import type {Feedback, Product} from '@mattermost/types/cloud';
import type {Team} from '@mattermost/types/teams';
import type {DispatchFunc} from 'mattermost-redux/types/actions';
import type {RouteComponentProps} from 'react-router-dom';
import type {GlobalState} from 'types/store';

type Props = RouteComponentProps & {
    onBack: () => void;
    onClose?: () => void;
    teamToKeep?: Team;
    selectedProduct?: Product | null | undefined;
    downgradeFeedback?: Feedback;
};

const MIN_PROCESSING_MILLISECONDS = 8000;
const MAX_FAKE_PROGRESS = 95;

function CloudSubscribeWithLoad(props: Props) {
    const intervalId = useRef<NodeJS.Timeout>({} as NodeJS.Timeout);
    const [progress, setProgress] = useState(0);
    const dispatch = useDispatch<DispatchFunc>();
    const [error, setError] = useState(false);
    const [processingState, setProcessingState] = useState(ProcessState.PROCESSING);
    const modalOpen = useSelector((state: GlobalState) =>
        isModalOpen(state, ModalIdentifiers.CLOUD_SUBSCRIBE_WITH_LOADING_MODAL),
    );
    useEffect(() => {
        handleSubscribe();
        intervalId.current = setInterval(
            updateProgress,
            MIN_PROCESSING_MILLISECONDS / MAX_FAKE_PROGRESS,
        );
    }, []);

    const handleSubscribe = async () => {
        const start = new Date();
        const result = await dispatch(subscribeCloudSubscription(
            props.selectedProduct?.id as string, undefined, 0, props.downgradeFeedback,
        ));

        // the action subscribeCloudSubscription returns a true boolean when successful and an error when it fails
        if (result.error) {
            setError(true);
            setProcessingState(ProcessState.FAILED);
            return;
        }

        const end = new Date();
        const millisecondsElapsed = end.valueOf() - start.valueOf();
        if (millisecondsElapsed < MIN_PROCESSING_MILLISECONDS) {
            setTimeout(
                completeSubscribe,
                MIN_PROCESSING_MILLISECONDS - millisecondsElapsed,
            );
            return;
        }
        completeSubscribe();
    };

    const completeSubscribe = () => {
        clearInterval(intervalId.current);
        setProcessingState(ProcessState.SUCCESS);
        setProgress(100);
    };

    const updateProgress = () => {
        setProgress((progress) => {
            if (progress >= MAX_FAKE_PROGRESS) {
                clearInterval(intervalId.current);
            }
            return progress + 3 > MAX_FAKE_PROGRESS ? MAX_FAKE_PROGRESS : progress + 3;
        },
        );
    };

    const handleGoBack = () => {
        clearInterval(intervalId.current);
        setProgress(0);
        setError(false);
        setProcessingState(ProcessState.PROCESSING);
        props.onBack();
    };

    const handleClose = () => {
        dispatch(
            closeModal(
                ModalIdentifiers.CLOUD_SUBSCRIBE_WITH_LOADING_MODAL,
            ),
        );
        if (typeof props.onClose === 'function') {
            props.onClose();
        }
    };

    const successPage = () => {
        const formattedBtnText = (
            <FormattedMessage
                defaultMessage='Return to {team}'
                id='admin.billing.subscription.returnToTeam'
                values={{team: props.teamToKeep?.display_name}}
            />
        );
        const productName = props.selectedProduct?.name;
        const title = (
            <FormattedMessage
                id={'admin.billing.subscription.downgradedSuccess'}
                defaultMessage={"You're now subscribed to {productName}"}
                values={{productName}}
            />
        );

        const formattedSubtitle = (
            <FormattedMessage
                id='success_modal.subtitle'
                defaultMessage='Your final bill will be prorated. Your workspace now has {plan} limits.'
                values={{plan: productName}}
            />
        );
        return (
            <IconMessage
                formattedTitle={title}
                formattedSubtitle={formattedSubtitle}
                error={error}
                icon={
                    <PaymentSuccessStandardSvg
                        width={444}
                        height={313}
                    />
                }
                formattedButtonText={formattedBtnText}
                buttonHandler={handleClose}
                className={'success'}
                tertiaryBtnText={t('admin.billing.subscription.viewBilling')}
                tertiaryButtonHandler={() => {
                    handleClose();
                    props.history.push('/admin_console/billing/subscription');
                }}
            />
        );
    };

    return (
        <FullScreenModal
            show={modalOpen}
            onClose={handleClose}
        >
            <div className='loading-modal'>
                <ProgressBar
                    processingState={processingState}
                    processingCopy={{
                        title: t('admin.billing.subscription.downgrading'),
                        subtitle: '',
                        icon: (
                            <CreditCardSvg
                                width={444}
                                height={313}
                            />
                        ),
                    }}
                    failedCopy={{
                        title: t('admin.billing.subscription.paymentVerificationFailed'),
                        subtitle: t('admin.billing.subscription.paymentFailed'),
                        icon: (
                            <PaymentFailedSvg
                                width={444}
                                height={313}
                            />
                        ),
                        buttonText: t('admin.billing.subscription.goBackTryAgain'),
                        linkText:
                            t('admin.billing.subscription.constCloudCard.contactSupport'),
                    }}
                    progress={progress}
                    successPage={successPage}
                    handleGoBack={handleGoBack}
                    error={error}
                />
            </div>
        </FullScreenModal>
    );
}

export default withRouter(CloudSubscribeWithLoad);
