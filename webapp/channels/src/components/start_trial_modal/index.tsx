// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useSelector, useDispatch} from 'react-redux';
import {Modal, Button} from 'react-bootstrap';
import {FormattedMessage, useIntl} from 'react-intl';

import {isModalOpen} from 'selectors/views/modals';
import {GlobalState} from 'types/store';
import {closeModal, openModal} from 'actions/views/modals';
import {requestTrialLicense} from 'actions/admin_actions';
import {getLicenseConfig} from 'mattermost-redux/actions/general';
import {DispatchFunc} from 'mattermost-redux/types/actions';

import {makeAsyncComponent} from 'components/async_load';
import useGetTotalUsersNoBots from 'components/common/hooks/useGetTotalUsersNoBots';
import ExternalLink from 'components/external_link';

import {AboutLinks, LicenseLinks, ModalIdentifiers} from 'utils/constants';

import StartTrialModalSvg from './start_trial_modal_svg';

const TrialBenefitsModal = makeAsyncComponent('TrialBenefisModal', React.lazy(() => import('components/trial_benefits_modal/trial_benefits_modal')));

import './start_trial_modal.scss';

enum TrialLoadStatus {
    NotStarted = 'NOT_STARTED',
    Started = 'STARTED',
    Success = 'SUCCESS',
    Failed = 'FAILED'
}

type Props = {
    onClose?: () => void;
}

function StartTrialModal(props: Props): JSX.Element | null {
    const [status, setLoadStatus] = useState(TrialLoadStatus.NotStarted);
    const dispatch = useDispatch<DispatchFunc>();

    const {formatMessage} = useIntl();
    const show = useSelector((state: GlobalState) => isModalOpen(state, ModalIdentifiers.START_TRIAL_MODAL));
    const totalUsers = useGetTotalUsersNoBots(true) || 0;

    const openTrialBenefitsModal = async () => {
        await dispatch(openModal({
            modalId: ModalIdentifiers.TRIAL_BENEFITS_MODAL,
            dialogType: TrialBenefitsModal,
            dialogProps: {trialJustStarted: true},
        }));
    };

    const requestLicense = async () => {
        setLoadStatus(TrialLoadStatus.Started);
        const requestedUsers = Math.max(totalUsers, 30);
        const {error} = await dispatch(requestTrialLicense(requestedUsers, true, true, 'license'));
        if (error) {
            setLoadStatus(TrialLoadStatus.Failed);
        }

        setLoadStatus(TrialLoadStatus.Success);
        await dispatch(getLicenseConfig());
        await dispatch(closeModal(ModalIdentifiers.START_TRIAL_MODAL));
        openTrialBenefitsModal();
    };

    const btnText = (status: TrialLoadStatus): string => {
        switch (status) {
        case TrialLoadStatus.Started:
            return formatMessage({id: 'start_trial.modal.loading', defaultMessage: 'Loading...'});
        case TrialLoadStatus.Success:
            return formatMessage({id: 'start_trial.modal.loaded', defaultMessage: 'Loaded!'});
        case TrialLoadStatus.Failed:
            return formatMessage({id: 'start_trial.modal.failed', defaultMessage: 'Failed'});
        default:
            return formatMessage({id: 'start_trial.modal_btn.start', defaultMessage: 'Start 30-day trial'});
        }
    };

    if (!show) {
        return null;
    }

    const handleOnClose = () => {
        if (props.onClose) {
            props.onClose();
        }
        dispatch(closeModal(ModalIdentifiers.START_TRIAL_MODAL));
    };

    return (
        <Modal
            className='StartTrialModal'
            dialogClassName='a11y__modal'
            show={show}
            id='startTrialModal'
            role='dialog'
            onHide={handleOnClose}
        >
            <Modal.Header closeButton={true}/>
            <Modal.Body>
                <StartTrialModalSvg/>
                <div className='title'>
                    <FormattedMessage
                        id='start_trial.modal_title'
                        defaultMessage='Start your free Enterprise trial now'
                    />
                </div>
                <div className='description'>
                    <FormattedMessage
                        id='start_trial.modal_body'
                        defaultMessage='Access all platform features including advanced security and enterprise compliance.'
                    />
                </div>
                <div className='buttons'>
                    <Button
                        className='dismiss-btn'
                        onClick={handleOnClose}
                    >
                        <FormattedMessage
                            id='start_trial.modal_btn.nottnow'
                            defaultMessage='Not now'
                        />
                    </Button>
                    <Button
                        className='confirm-btn'
                        onClick={requestLicense}
                    >
                        {btnText(status)}
                    </Button>
                </div>
                <div className='disclaimer'>
                    <span>
                        <FormattedMessage
                            id='start_trial.modal.disclaimer'
                            defaultMessage='By clicking “Start free 30-day trial”, I agree to the <linkEvaluation>Mattermost Software and Services License Agreement</linkEvaluation>, <linkPrivacy>privacy policy</linkPrivacy> and receiving product emails.'
                            values={{
                                linkEvaluation: (msg: React.ReactNode) => (
                                    <ExternalLink
                                        href={LicenseLinks.SOFTWARE_SERVICES_LICENSE_AGREEMENT}
                                        location='start_trial_modal'
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                                linkPrivacy: (msg: React.ReactNode) => (
                                    <ExternalLink
                                        href={AboutLinks.PRIVACY_POLICY}
                                        location='start_trial_modal'
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                            }}
                        />
                    </span>
                </div>
            </Modal.Body>
        </Modal>
    );
}

export default StartTrialModal;
