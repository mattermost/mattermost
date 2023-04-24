// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';
import {useSelector} from 'react-redux';

import {isCurrentLicenseCloud} from 'mattermost-redux/selectors/entities/cloud';
import {trackEvent} from 'actions/telemetry_actions';

import useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';

import {TELEMETRY_CATEGORIES} from 'utils/constants';

const StyledA = styled.a`
color: var(--denim-button-bg);
font-family: 'Open Sans';
font-size: 12px;
font-style: normal;
font-weight: 600;
line-height: 16px;
cursor: pointer;
text-align: center;
`;

function ContactSalesCTA() {
    const {formatMessage} = useIntl();
    const [openSalesLink] = useOpenSalesLink();

    const isCloud = useSelector(isCurrentLicenseCloud);

    return (
        <StyledA
            id='contact_sales_quote'
            onClick={(e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
                e.preventDefault();
                if (isCloud) {
                    trackEvent(TELEMETRY_CATEGORIES.CLOUD_PRICING, 'click_enterprise_contact_sales');
                } else {
                    trackEvent('self_hosted_pricing', 'click_enterprise_contact_sales');
                }
                openSalesLink();
            }}
        >
            {formatMessage({id: 'pricing_modal.btn.contactSalesForQuote', defaultMessage: 'Contact Sales'})}
        </StyledA>
    );
}

export default ContactSalesCTA;
