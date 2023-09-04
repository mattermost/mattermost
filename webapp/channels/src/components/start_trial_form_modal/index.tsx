// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect, useState} from 'react';
import {Modal, Button} from 'react-bootstrap';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import {getLicenseConfig} from 'mattermost-redux/actions/general';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/common';
import type {DispatchFunc} from 'mattermost-redux/types/actions';

import {requestTrialLicense} from 'actions/admin_actions';
import {validateBusinessEmail} from 'actions/cloud';
import {trackEvent} from 'actions/telemetry_actions';
import {closeModal, openModal} from 'actions/views/modals';
import {isModalOpen} from 'selectors/views/modals';

import {makeAsyncComponent} from 'components/async_load';
import useCWSAvailabilityCheck from 'components/common/hooks/useCWSAvailabilityCheck';
import useGetTotalUsersNoBots from 'components/common/hooks/useGetTotalUsersNoBots';
import DropdownInput from 'components/dropdown_input';
import ExternalLink from 'components/external_link';
import Input, {SIZE} from 'components/widgets/inputs/input/input';
import type {CustomMessageInputType} from 'components/widgets/inputs/input/input';

import {AboutLinks, LicenseLinks, ModalIdentifiers, TELEMETRY_CATEGORIES} from 'utils/constants';
import {COUNTRIES} from 'utils/countries';
import {t} from 'utils/i18n';

import type {GlobalState} from 'types/store';

import AirGappedModal from './air_gapped_modal';
import StartTrialFormModalResult from './failure_modal';

import './start_trial_form_modal.scss';

const TrialBenefitsModal = makeAsyncComponent('TrialBenefitsModal', React.lazy(() => import('components/trial_benefits_modal/trial_benefits_modal')));

enum TrialLoadStatus {
    NotStarted = 'NOT_STARTED',
    Started = 'STARTED',
    Success = 'SUCCESS',
    Failed = 'FAILED'
}

// Marker functions so i18n-extract doesn't remove strings
t('ONE_TO_50');
t('FIFTY_TO_100');
t('ONE_HUNDRED_TO_500');
t('FIVE_HUNDRED_TO_1000');
t('ONE_THOUSAND_TO_2500');
t('TWO_THOUSAND_FIVE_HUNDRED_AND_UP');

export enum OrgSize {
    ONE_TO_50 = '1-50',
    FIFTY_TO_100 = '51-100',
    ONE_HUNDRED_TO_500 = '101-500',
    FIVE_HUNDRED_TO_1000 = '501-1000',
    ONE_THOUSAND_TO_2500 = '1001-2500',
    TWO_THOUSAND_FIVE_HUNDRED_AND_UP = '2501+',
}

type Props = {
    onClose?: () => void;
    page?: string;
}

function StartTrialFormModal(props: Props): JSX.Element | null {
    const [status, setLoadStatus] = useState(TrialLoadStatus.NotStarted);
    const dispatch = useDispatch<DispatchFunc>();
    const currentUser = useSelector(getCurrentUser);
    const [name, setName] = useState('');
    const [email, setEmail] = useState(currentUser.email);
    const [companyName, setCompanyName] = useState('');
    const [orgSize, setOrgSize] = useState<OrgSize | undefined>();
    const [country, setCountry] = useState('');
    const [businessEmailError, setBusinessEmailError] = useState<CustomMessageInputType | undefined>(undefined);
    const {formatMessage} = useIntl();
    const canReachCWS = useCWSAvailabilityCheck();
    const show = useSelector((state: GlobalState) => isModalOpen(state, ModalIdentifiers.START_TRIAL_FORM_MODAL));
    const totalUsers = useGetTotalUsersNoBots(true) || 0;
    const [didOnce, setDidOnce] = useState(false);

    const handleValidateBusinessEmail = async (email: string) => {
        setDidOnce(true);
        if (!email) {
            setBusinessEmailError(undefined);
            return;
        }
        const isBusinessEmail = await validateBusinessEmail(email)();

        if (isBusinessEmail) {
            setBusinessEmailError(undefined);
            return;
        }

        setBusinessEmailError({
            type: 'error',
            value: formatMessage({id: 'start_trial_form.invalid_business_email', defaultMessage: 'Please enter a valid business email address.'},
            ),
        });
    };

    useEffect(() => {
        trackEvent(TELEMETRY_CATEGORIES.SELF_HOSTED_START_TRIAL_MODAL, 'form_opened');
        if (email && !didOnce) {
            handleValidateBusinessEmail(email);
        }
    }, [email, didOnce]);

    if (!show) {
        return null;
    }

    const openTrialBenefitsModal = () => {
        dispatch(openModal({
            modalId: ModalIdentifiers.TRIAL_BENEFITS_MODAL,
            dialogType: TrialBenefitsModal,
            dialogProps: {trialJustStarted: true},
        }));
    };

    // Reset the TrialLoadStatus so the user can re-submit the form
    const handleErrorModalTryAgain = () => {
        dispatch(closeModal(ModalIdentifiers.START_TRIAL_FORM_MODAL_RESULT));
        setLoadStatus(TrialLoadStatus.NotStarted);
    };

    const requestLicense = async () => {
        setLoadStatus(TrialLoadStatus.Started);
        const requestedUsers = Math.max(totalUsers, 30);
        const trialRequestBody = {
            users: requestedUsers,
            terms_accepted: true,
            receive_emails_accepted: true,
            contact_name: name,
            contact_email: email,
            company_name: companyName,
            company_country: country,
            company_size: orgSize,
        };
        const {error, data} = await dispatch(requestTrialLicense(trialRequestBody, props.page || 'license'));
        if (error) {
            setLoadStatus(TrialLoadStatus.Failed);
            let title;
            let subtitle;
            let buttonText;
            let onTryAgain = handleErrorModalTryAgain;

            if (data.status === 422) {
                title = (<></>);
                subtitle = (
                    <FormattedMessage
                        id='admin.license.trial-request.embargoed'
                        defaultMessage='We were unable to process the request due to limitations for embargoed countries. <link>Learn more in our documentation</link>, or reach out to legal@mattermost.com for questions around export limitations.'
                        values={{
                            link: (text: string) => (
                                <ExternalLink
                                    location='trial_banner'
                                    href={LicenseLinks.EMBARGOED_COUNTRIES}
                                >
                                    {text}
                                </ExternalLink>
                            ),
                        }}
                    />
                );
                buttonText = (
                    <FormattedMessage
                        id='admin.license.trial-request.embargoed.button'
                        defaultMessage='Close'
                    />
                );
                onTryAgain = handleOnClose;
            }
            dispatch(openModal({
                modalId: ModalIdentifiers.START_TRIAL_FORM_MODAL_RESULT,
                dialogType: StartTrialFormModalResult,
                dialogProps: {
                    onTryAgain,
                    title,
                    subtitle,
                    buttonText,
                },
            }));
            return;
        }

        setLoadStatus(TrialLoadStatus.Success);
        await dispatch(getLicenseConfig());
        dispatch(closeModal(ModalIdentifiers.START_TRIAL_FORM_MODAL));
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
            return formatMessage({id: 'start_trial_form.modal_btn.start', defaultMessage: 'Start trial'});
        }
    };

    const handleOnClose = () => {
        if (props.onClose) {
            props.onClose();
        }
        trackEvent(TELEMETRY_CATEGORIES.SELF_HOSTED_START_TRIAL_MODAL, 'form_closed');
        dispatch(closeModal(ModalIdentifiers.START_TRIAL_FORM_MODAL));
    };

    const getOrgSizeDropdownValue = () => {
        if (typeof orgSize === 'undefined') {
            return orgSize;
        }
        return {
            value: orgSize,
            label: formatMessage({id: orgSize, defaultMessage: OrgSize[orgSize as unknown as keyof typeof OrgSize]}),
        };
    };

    const isSubmitDisabled = (
        !name ||
        !email ||
        !companyName ||
        !orgSize ||
        !country ||
        Boolean(businessEmailError) ||
        status === TrialLoadStatus.Started ||
        status === TrialLoadStatus.Success
    );

    if (typeof canReachCWS !== 'undefined' && !canReachCWS) {
        return (
            <AirGappedModal
                onClose={handleOnClose}
            />
        );
    }

    return (
        <Modal
            className={classNames('StartTrialFormModal', {error: TrialLoadStatus.Failed === status})}
            dialogClassName='a11y__modal'
            show={show}
            id='StartTrialFormModal'
            role='dialog'
            onHide={handleOnClose}
        >
            <Modal.Header closeButton={true}>
                <div className='title'>
                    <FormattedMessage
                        id='start_trial_form.modal_title'
                        defaultMessage='Start Trial'
                    />
                </div>
                <div className='description'>
                    <FormattedMessage
                        id='start_trial_form.modal_body'
                        defaultMessage='Just a few quick items to help us tailor your trial experience.'
                    />
                </div>
            </Modal.Header>
            <Modal.Body>
                <Input
                    className={'name_input'}
                    name='name'
                    type='text'
                    value={name}
                    inputSize={SIZE.LARGE}
                    onChange={(e) => setName(e.target.value)}
                    required={true}
                    placeholder={formatMessage({id: 'start_trial_form.name', defaultMessage: 'Name'})}
                />
                <Input
                    className={'email_input'}
                    onBlur={(e) => handleValidateBusinessEmail(e.target.value)}
                    name='email'
                    type='text'
                    value={email}
                    inputSize={SIZE.LARGE}
                    onChange={(e) => setEmail(e.target.value)}
                    required={true}
                    placeholder={formatMessage({id: 'start_trial_form.email', defaultMessage: 'Business Email'})}
                    customMessage={businessEmailError}
                />
                <Input
                    className={'company_name_input'}
                    name='company_name'
                    type='text'
                    inputSize={SIZE.LARGE}
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required={true}
                    placeholder={formatMessage({id: 'start_trial_form.company_name', defaultMessage: 'Company Name'})}
                />
                <DropdownInput
                    className={'company_size_dropdown'}
                    onChange={(e) => {
                        setOrgSize(e.value as OrgSize);
                    }}
                    value={getOrgSizeDropdownValue()}
                    options={Object.entries(OrgSize).map(([value, label]) => ({value, label}))}
                    legend={formatMessage({id: 'start_trial_form.company_size', defaultMessage: 'Company Size'})}
                    placeholder={formatMessage({id: 'start_trial_form.company_size', defaultMessage: 'Company Size'})}
                    name='company_size_dropdown'
                />
                <div className='countries-section'>
                    <DropdownInput
                        onChange={(e) => setCountry(e.value)}
                        value={
                            country ? {value: country, label: country} : undefined
                        }
                        options={COUNTRIES.map((country) => ({
                            value: country.name,
                            label: country.name,
                        }))}
                        legend={formatMessage({
                            id: 'payment_form.country',
                            defaultMessage: 'Country',
                        })}
                        placeholder={formatMessage({
                            id: 'payment_form.country',
                            defaultMessage: 'Country',
                        })}
                        name={'country_dropdown'}
                    />
                </div>
                <div className='disclaimer'>
                    <FormattedMessage
                        id='start_trial_form.disclaimer'
                        defaultMessage='By selecting Start trial, I agree to the <agreement>Mattermost Software Evaluation Agreement</agreement>, <privacypolicy>Privacy Policy</privacypolicy>, and receiving product emails.'
                        values={{
                            agreement: (msg: React.ReactNode) => (
                                <ExternalLink
                                    href='https://mattermost.com/software-evaluation-agreement/'
                                    location='start_trial_form_modal'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                            privacypolicy: (msg: React.ReactNode) => (
                                <ExternalLink
                                    href={AboutLinks.PRIVACY_POLICY}
                                    location='start_trial_form_modal'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        }}
                    />
                </div>
                <div className='buttons'>
                    <Button
                        disabled={isSubmitDisabled}
                        className='confirm-btn'
                        onClick={requestLicense}
                    >
                        {btnText(status)}
                    </Button>
                </div>
            </Modal.Body>
        </Modal>
    );
}

export default StartTrialFormModal;
