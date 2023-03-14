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
import {COUNTRIES} from 'utils/countries';

import { ModalIdentifiers} from 'utils/constants';

import './start_trial_form_modal.scss';
import Input, {SIZE} from 'components/widgets/inputs/input/input';
import DropdownInput from 'components/dropdown_input';
import { RequestLicenseBody } from '@mattermost/types/config';

// TODO: Handle embargoed entities

const TrialBenefitsModal = makeAsyncComponent('TrialBenefisModal', React.lazy(() => import('components/trial_benefits_modal/trial_benefits_modal')));


enum TrialLoadStatus {
    NotStarted = 'NOT_STARTED',
    Started = 'STARTED',
    Success = 'SUCCESS',
    Failed = 'FAILED'
}

export enum OrgSize {
    ONE_TO_50 = '1-50',
    FIFTY_TO_100 = '51-100',
    ONE_HUNDRED_TO_500 = '101-500',
}

type Props = {
    onClose?: () => void;
    page?: string;
}

function StartTrialFormModal(props: Props): JSX.Element | null {
    const [status, setLoadStatus] = useState(TrialLoadStatus.NotStarted);
    const dispatch = useDispatch<DispatchFunc>();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [orgSize, setOrgSize] = useState<OrgSize | undefined>();
    const [country, setCountry] = useState('');
    const {formatMessage} = useIntl();
    const show = useSelector((state: GlobalState) => isModalOpen(state, ModalIdentifiers.START_TRIAL_FORM_MODAL));
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
        const trialRequestBody = {
            users: requestedUsers,
            terms_accepted: true,
            receive_emails_accepted: true,
            contact_name: name,
            contact_email: email,
            company_name: companyName,
            company_country: country,
            company_size: orgSize,
        } as RequestLicenseBody;
        const {error} = await dispatch(requestTrialLicense(trialRequestBody, props.page || 'license'));
        if (error) {
            setLoadStatus(TrialLoadStatus.Failed);
        }

        setTimeout(async () => {
            setLoadStatus(TrialLoadStatus.Success)
            await dispatch(getLicenseConfig());
            await dispatch(closeModal(ModalIdentifiers.START_TRIAL_FORM_MODAL));
            openTrialBenefitsModal();
        }, 5000)
        
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

    if (!show) {
        return null;
    }

    const handleOnClose = () => {
        if (props.onClose) {
            props.onClose();
        }
        dispatch(closeModal(ModalIdentifiers.START_TRIAL_FORM_MODAL));
    };


    const getOrgSizeDropdownValue = () => {
        if (typeof orgSize === 'undefined') {
            return orgSize
        } else {
            return {
                value: orgSize,
                label: OrgSize[orgSize as unknown as keyof typeof OrgSize],
            }
        }
    }

    console.log(orgSize);

    return (
        <Modal
            className='StartTrialFormModal'
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
                    name='email'
                    type='text'
                    value={email}
                    inputSize={SIZE.LARGE}
                    onChange={(e) => setEmail(e.target.value)}
                    required={true}
                    placeholder={formatMessage({id: 'start_trial_form.email', defaultMessage: 'Business Email'})}
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
                    onChange={(e) => { setOrgSize(e.value as OrgSize)}}
                    value={getOrgSizeDropdownValue()}
                    options={Object.keys(OrgSize).map((key) => ({value:key, label: OrgSize[key as keyof typeof OrgSize]}))}
                    legend={'Company Size'}
                    placeholder={'Company Size'}
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
                <div className="disclaimer">
                    {'By selecting Start trial, I agree to the Mattermost Software Evaluation Agreement, Privacy Policy, and receiving product emails.'}
                </div>
                <div className='buttons'>
                    <Button
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
