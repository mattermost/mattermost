// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {FormattedMessage} from 'react-intl';

import {trackEvent} from 'actions/telemetry_actions';
import useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';

import './contact_us.scss';

export interface Props {
    buttonTextElement?: JSX.Element;
    eventID?: string;
    customClass?: string;
}

const ContactUsButton: React.FC<Props> = (props: Props) => {
    const [openContactSales] = useOpenSalesLink();

    const handleContactUsLinkClick = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();
        trackEvent('admin', props.eventID || 'in_trial_contact_sales');
        openContactSales();
    };

    return (
        <button
            className={`contact-us ${props.customClass ? props.customClass : ''}`}
            onClick={(e) => handleContactUsLinkClick(e)}
        >
            {props.buttonTextElement || (
                <FormattedMessage
                    id={'admin.license.trialCard.contactSales'}
                    defaultMessage={'Contact sales'}
                />
            )}
        </button>
    );
};

export default ContactUsButton;
