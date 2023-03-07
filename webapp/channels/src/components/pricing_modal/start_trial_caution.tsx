// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';

import {AboutLinks, LicenseLinks} from 'utils/constants';

const ContainerSpan = styled.span`
font-style: normal;
display: inline-block;
font-weight: 400;
font-size: 10px;
line-height: 14px;
letter-spacing: 0.02em;
color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const Span = styled.span`
font-weight: 600;
`;

function StartTrialCaution() {
    const {formatMessage} = useIntl();

    const message = formatMessage({
        id: 'pricing_modal.start_trial.disclaimer',
        defaultMessage: 'By selecting <span>Try free for 30 days,</span> I agree to the <linkAgreement>Mattermost Software and Services License Agreement</linkAgreement>, <linkPrivacy>Privacy Policy</linkPrivacy>, and receiving product emails.',
    }, {
        span: (chunks: React.ReactNode | React.ReactNodeArray) => (<Span>{chunks}</Span>),
        linkAgreement: (msg: React.ReactNode) => (
            <a
                href={LicenseLinks.SOFTWARE_SERVICES_LICENSE_AGREEMENT}
                target='_blank'
                rel='noreferrer'
            >
                {msg}
            </a>
        ),
        linkPrivacy: (msg: React.ReactNode) => (
            <a
                href={AboutLinks.PRIVACY_POLICY}
                target='_blank'
                rel='noreferrer'
            >
                {msg}
            </a>
        ),
    });
    return (<ContainerSpan>{message}</ContainerSpan>);
}

export default StartTrialCaution;
