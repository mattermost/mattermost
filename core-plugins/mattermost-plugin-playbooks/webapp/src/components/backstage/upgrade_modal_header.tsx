// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import styled from 'styled-components';

import {CenteredRow} from 'src/components/backstage/styles';

interface Props {
    titleText: React.ReactNode;
    helpText: React.ReactNode;
}

const UpgradeModalHeader = (props: Props) => {
    return (
        <Header>
            <Title>{props.titleText}</Title>
            <HelpText>{props.helpText}</HelpText>
        </Header>
    );
};

const Header = styled.div`
    display: flex;
    flex-direction: column;
    margin-top: 20px;
`;

const Title = styled(CenteredRow)`
    display: grid;
    height: 32px;
    align-content: center;
    margin-bottom: 8px;
    color: rgba(var(--center-channel-color-rgb), 1);
    font-size: 24px;
    font-weight: 600;
`;

const HelpText = styled(CenteredRow)`
    display: grid;
    width: 448px;
    align-content: center;
    color: var(--center-channel-color);
    font-size: 12px;
    font-weight: 400;
    text-align: center;
`;

export default UpgradeModalHeader;

