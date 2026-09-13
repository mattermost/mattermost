// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {FormattedMessage} from 'react-intl';

import PlaybookListSvg from 'src/components/assets/illustrations/playbook_list_svg';

const Container = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 50px 20px;
`;

const Title = styled.h2`
    margin-top: 40px;
    color: var(--center-channel-color);
    font-family: Metropolis;
    font-size: 32px;
    line-height: 40px;
    text-align: center;
`;

const Description = styled.p`
    max-width: 760px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 16px;
    line-height: 24px;
    text-align: center;
`;

const DescriptionWarn = styled(Description)`
    color: rgba(var(--error-text-color-rgb), 0.72);
`;

const LinedSeparator = styled.div`
    > span {
        display: inline-flex;
        align-items: center;
        padding: 0 10px;
        background: var(--center-channel-bg);
        color: rgba(var(--center-channel-color-rgb), 0.72);
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        line-height: 10px;
    }

    display: flex;
    width: 100%;
    max-width: 800px;
    height: 0;
    align-items: center;
    justify-content: center;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    margin-top: 50px;
`;

const IconArrowDown = styled.i.attrs(() => ({className: 'icon icon-arrow-down'}))`
    width: 14px;
    margin-left: 5px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 14px;
`;

const GettingStarted = (props: {canCreatePlaybooks: boolean, scrollToNext: () => void}) => {
    return (
        <Container>
            <PlaybookListSvg/>
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
