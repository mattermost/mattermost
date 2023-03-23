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
    align-content: center;
    height: 32px;
    margin-bottom: 8px;

    font-weight: 600;
    font-size: 24px;
    color: rgba(var(--center-channel-color-rgb), 1);
`;

const HelpText = styled(CenteredRow)`
    display: grid;
    align-content: center;
    text-align: center;
    width: 448px;

    font-weight: 400;
    font-size: 12px;
    color: var(--center-channel-color);
`;

export default UpgradeModalHeader;

