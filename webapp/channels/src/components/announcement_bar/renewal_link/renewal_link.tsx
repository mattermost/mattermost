// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import {trackEvent} from 'actions/telemetry_actions';
import {Client4} from 'mattermost-redux/client';

import useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';

import NoInternetConnection from '../no_internet_connection/no_internet_connection';
import {ModalData} from 'types/actions';
import {
    ModalIdentifiers,
} from 'utils/constants';

import './renew_link.scss';

export interface RenewalLinkProps {
    telemetryInfo?: {success: string; error: string};
    actions: {
        openModal: <P>(modalData: ModalData<P>) => void;
    };
    isDisabled?: boolean;
    customBtnText?: JSX.Element;
}

const RenewalLink = (props: RenewalLinkProps) => {
    const [renewalLink, setRenewalLink] = useState('');
    const [manualInterventionRequired, setManualInterventionRequired] = useState(false);

    const [openContactSales] = useOpenSalesLink();

    useEffect(() => {
        Client4.getRenewalLink().then(({renewal_link: renewalLinkParam}) => {
            try {
                if (renewalLinkParam && (/^http[s]?:\/\//).test(renewalLinkParam)) {
                    setRenewalLink(renewalLinkParam);
                }
            } catch (error) {
                console.error('No link returned', error); // eslint-disable-line no-console
            }
        }).catch(() => {
            setManualInterventionRequired(true);
        });
    }, []);

    const handleLinkClick = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();
        try {
            const {status} = await Client4.ping();
            if (status === 'OK' && renewalLink !== '') {
                if (props.telemetryInfo?.success) {
                    trackEvent('renew_license', props.telemetryInfo.success);
                }
                window.open(renewalLink, '_blank');
            } else if (manualInterventionRequired) {
                openContactSales();
            } else {
                showConnectionErrorModal();
            }
        } catch (error) {
            showConnectionErrorModal();
        }
    };

    const showConnectionErrorModal = () => {
        if (props.telemetryInfo?.error) {
            trackEvent('renew_license', props.telemetryInfo.error);
        }
        props.actions.openModal({
            modalId: ModalIdentifiers.NO_INTERNET_CONNECTION,
            dialogType: NoInternetConnection,
        });
    };

    let btnText = props.customBtnText ? props.customBtnText : (
        <FormattedMessage
            id='announcement_bar.warn.renew_license_now'
            defaultMessage='Renew license now'
        />
    );

    if (manualInterventionRequired) {
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
};

export default RenewalLink;
