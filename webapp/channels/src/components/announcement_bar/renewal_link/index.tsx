// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {Client4} from 'mattermost-redux/client';

import {trackEvent} from 'actions/telemetry_actions';
import {openModal} from 'actions/views/modals';
import {DispatchFunc} from 'mattermost-redux/types/actions';
import {getLicense} from 'mattermost-redux/selectors/entities/general';

import { ModalIdentifiers } from 'utils/constants';
import useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';
import useControlSelfHostedRenewalModal from 'components/common/hooks/useControlSelfHostedRenewalModal';

import NoInternetConnection from '../no_internet_connection/no_internet_connection';

import './renew_link.scss';

export interface RenewalLinkProps {
    telemetryInfo?: {success: string; error: string};
    isDisabled?: boolean;
    customBtnText?: JSX.Element;
}

type RenewMode = 'self-serve' | 'portal-link' | 'sales' | 'no-external-connection';

const RenewalLink = (props: RenewalLinkProps) => {
    const [renewalLink, setRenewalLink] = useState('');
    const dispatch = useDispatch<DispatchFunc>();
    const [renewMode, setRenewMode] = useState<RenewMode>('self-serve');
    const licenseProductId = useSelector(getLicense)?.SkuName || '';
    const controlSelfHostedRenewalModal = useControlSelfHostedRenewalModal({});

    const [openContactSales] = useOpenSalesLink();

    useEffect(() => {
        (async () => {
            try {
                const {is_renewable: isRenewable} = await Client4.getLicenseSelfServeStatus();
                if (isRenewable) {
                    const response = await Client4.getAvailabilitySelfHostedSignup();
                    if (response.status !== 'OK') {
                        const {renewal_link: renewalLinkParam} = await Client4.getRenewalLink();
                        if (renewalLinkParam && (/^http[s]?:\/\//).test(renewalLinkParam)) {
                            setRenewalLink(renewalLinkParam);
                            setRenewMode('portal-link');
                        } else {
                            setRenewMode('no-external-connection');
                        }
                    }
                } else {
                    const {renewal_link: renewalLinkParam} = await Client4.getRenewalLink();
                    if (renewalLinkParam && (/^http[s]?:\/\//).test(renewalLinkParam)) {
                        setRenewalLink(renewalLinkParam);
                        setRenewMode('portal-link');
                    } else {
                        setRenewMode('no-external-connection');
                    }
                }
            } catch {
                setRenewMode('sales');
            }
        })();
    }, []);

    const showConnectionErrorModal = () => {
        if (props.telemetryInfo?.error) {
            trackEvent('renew_license', props.telemetryInfo.error);
        }
        dispatch(openModal({
            modalId: ModalIdentifiers.NO_INTERNET_CONNECTION,
            dialogType: NoInternetConnection,
        }));
    };

    const handleLinkClick = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();
        try {
            switch (renewMode) {
            case 'self-serve': {
                controlSelfHostedRenewalModal.open(licenseProductId);
                break;
            }
            case 'portal-link': {
                if ((await Client4.ping()).status === 'OK') {
                    if (props.telemetryInfo?.success) {
                        trackEvent('renew_license', props.telemetryInfo.success);
                    }
                    window.open(renewalLink, '_blank');
                };
                break;
            }
            case 'sales': {
                openContactSales();
                break;
            }
            case 'no-external-connection': {
                showConnectionErrorModal();
                break;
            }
            }
        } catch (error) {
            showConnectionErrorModal();
        }
    };

    let btnText = props.customBtnText ? props.customBtnText : (
        <FormattedMessage
            id='announcement_bar.warn.renew_license_now'
            defaultMessage='Renew now'
        />
    );

    if (renewMode === 'sales') {
        btnText = (
            <FormattedMessage
                id='announcement_bar.warn.renew_license_contact_sales'
                defaultMessage='Contact sales'
            />
        );
    }

    return (
        <button
            className='btn btn-primary annnouncementBar__renewLicense'
            disabled={props.isDisabled}
            onClick={(e) => handleLinkClick(e)}
        >
            {btnText}
        </button>
    );
}

export default RenewalLink;
