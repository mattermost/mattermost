// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';
import {useRouteMatch} from 'react-router-dom';

import NoMetricsSvg from 'src/components/assets/no_metrics_svg';
import {SecondaryButton} from 'src/components/assets/buttons';
import {navigateToUrl} from 'src/browser_routing';

const NoMetricsPlaceholder = () => {
    const match = useRouteMatch();
    const {formatMessage} = useIntl();

    return (
        <Container>
            <InnerContainer>
                <NoMetricsSvg/>
                <Title>{formatMessage({defaultMessage: 'Track key metrics and measure value'})}</Title>
                <Text>{formatMessage({defaultMessage: 'Use metrics to understand patterns and progress across runs, and track performance.'})}</Text>
                <StyledButton
                    onClick={() => {
                        navigateToUrl(match.url.replace('/reports', '/outline#retrospective'));
                    }}
                >
                    {formatMessage({defaultMessage: 'Configure metrics in Retrospective'})}
                </StyledButton>
            </InnerContainer>
        </Container>
    );
};

const Container = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 96px;
`;

const InnerContainer = styled.div`
    max-width: 523px;
    text-align: center;
`;

const Title = styled.div`
    font-size: 22px;
    font-weight: 600;
    line-height: 28px;
    margin-top: 24px;
    font-family: Metropolis, sans-serif;
    letter-spacing: -0.02em;
`;

const Text = styled.div`
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
`;

export default NoMetricsPlaceholder;
