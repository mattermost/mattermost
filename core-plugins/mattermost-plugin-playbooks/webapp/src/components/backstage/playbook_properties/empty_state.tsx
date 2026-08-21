// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {SecondaryButton} from 'src/components/assets/buttons';

interface Props {
    title: React.ReactNode;
    description: React.ReactNode;
    buttonText: React.ReactNode;
    onButtonClick: () => void;
    icon?: React.ReactNode;
}

const EmptyState = ({
    title,
    description,
    buttonText,
    onButtonClick,
    icon,
}: Props) => {
    return (
        <Container>
            <InnerContainer>
                {icon && <IconContainer>{icon}</IconContainer>}
                <Title>{title}</Title>
                <Description>{description}</Description>
                <StyledButton onClick={onButtonClick}>
                    {buttonText}
                </StyledButton>
            </InnerContainer>
        </Container>
    );
};

const Container = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 48px 32px;
`;

const InnerContainer = styled.div`
    max-width: 523px;
    text-align: center;
`;

const IconContainer = styled.div`
    margin-bottom: 24px;
`;

const Title = styled.div`
    font-size: 22px;
    font-weight: 600;
    line-height: 28px;
    margin-top: 0;
    font-family: Metropolis, sans-serif;
    letter-spacing: -0.02em;
`;

const Description = styled.div`
    margin: 8px 0 24px;
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
`;

const StyledButton = styled(SecondaryButton)`
    height: 40px;
    padding: 0 20px;
    font-size: 14px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin: 0 auto;
`;

export default EmptyState;