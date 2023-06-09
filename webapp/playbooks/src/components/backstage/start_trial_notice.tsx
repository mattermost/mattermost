import React from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';

import {AboutLinks} from 'src/constants';

const EXT = {target: '_blank', rel: 'noreferrer'};

const AgreementLink = styled.a.attrs(() => ({
    ...EXT,
    href: 'https://mattermost.com/software-evaluation-agreement/',
}))``;

const PrivacyLink = styled.a.attrs(() => ({
    ...EXT,
    href: AboutLinks.PRIVACY_POLICY,
}))``;

const StartTrialNotice = () => {
    return (
        <FormattedMessage
            defaultMessage='By clicking <b>Start trial</b>, I agree to the <AgreementLink>Mattermost Software Evaluation Agreement</AgreementLink>, <PrivacyLink>Privacy Policy</PrivacyLink>, and receiving product emails.'
            values={{
                b: (inner: React.ReactNode) => <b>{inner}</b>,
                AgreementLink: (inner: React.ReactNode) => <AgreementLink>{inner}</AgreementLink>,
                PrivacyLink: (inner: React.ReactNode) => <PrivacyLink>{inner}</PrivacyLink>,
            }}
        />
    );
};

export default StartTrialNotice;
