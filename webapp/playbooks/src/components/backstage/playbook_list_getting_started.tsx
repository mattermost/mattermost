// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {FormattedMessage} from 'react-intl';

import RocketManSvg from 'src/components/assets/illustrations/rocket_man_svg';

const Container = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 50px 20px;
`;

const Title = styled.h2`
    font-family: Metropolis;
    font-size: 32px;
    line-height: 40px;
    color: var(--center-channel-color);
    text-align: center;
    margin-top: 40px;
`;

const Description = styled.p`
    font-size: 16px;
    line-height: 24px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    text-align: center;
    max-width: 760px;
`;

const DescriptionWarn = styled(Description)`
    color: rgba(var(--error-text-color-rgb), 0.72);
`;

const LinedSeparator = styled.div`
    > span {
        font-weight: 600;
        font-size: 12px;
        line-height: 10px;
        background: var(--center-channel-bg);
        color: rgba(var(--center-channel-color-rgb), 0.72);
        padding: 0 10px;
        display: inline-flex;
        align-items: center;
        cursor: pointer;
    }
    display: flex;
    align-items: center;
    justify-content: center;
    height: 0;
    width: 100%;
    max-width: 800px;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    margin-top: 50px;
`;

const IconArrowDown = styled.i.attrs(() => ({className: 'icon icon-arrow-down'}))`
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 14px;
    width: 14px;
    margin-left: 5px;
`;

const GettingStarted = (props: {canCreatePlaybooks: boolean, scrollToNext: () => void}) => {
    return (
        <Container>
            <RocketManSvg/>
            <Title><FormattedMessage defaultMessage='Get started with Playbooks'/></Title>
            <Description>
                <FormattedMessage
                    defaultMessage='Playbooks make important procedures more repeatable and accountable. A playbook can be run multiple times, and each run has its own record and retrospective.'
                />
            </Description>
            {props.canCreatePlaybooks ? (
                <>
                    <LinedSeparator>
                        <span onClick={props.scrollToNext}>
                            <FormattedMessage defaultMessage="Let's go!"/>
                            <IconArrowDown/>
                        </span>
                    </LinedSeparator>
                </>
            ) : (
                <DescriptionWarn>
                    <FormattedMessage
                        defaultMessage="There are no playbooks to view. You don't have permission to create playbooks in this workspace."
                    />
                </DescriptionWarn>
            )}
        </Container>
    );
};

export default GettingStarted;
