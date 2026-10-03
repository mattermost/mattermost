// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import styled from 'styled-components';

const ConvertEnterpriseNotice = () => (
    <>
        <Subheader>
            <FormattedMessage defaultMessage='To unlock this feature:'/>
        </Subheader>
        <p>
            <StyledOl>
                <li>
                    <a
                        href={'https://docs.mattermost.com/install/ee-install.html#converting-team-edition-to-enterprise-edition'}
                        target={'_blank'}
                        rel='noreferrer'
                    >
                        <FormattedMessage defaultMessage='Convert to a commercial edition.'/>
                    </a>
                </li>
                <li>
                    <FormattedMessage defaultMessage='Start a trial or upgrade your subscription.'/>
                </li>
            </StyledOl>
        </p>
    </>
);

export default ConvertEnterpriseNotice;

const StyledOl = styled.ol`
    margin-left: -16px;
    list-style-position: inside;
`;

const Subheader = styled.p`
    font-size: 14px;
    font-weight: 600;
`;
