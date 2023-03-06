// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode} from 'react';

import Scrollbars from 'react-custom-scrollbars';
import styled from 'styled-components';

import {renderThumbVertical, renderTrackHorizontal, renderView} from 'src/components/rhs/rhs_shared';

import {ExpandRight} from 'src/components/backstage/playbook_runs/shared';

export enum RHSContent {
    RunInfo = 'run-info',
    RunTimeline = 'run-timeline',
    RunStatusUpdates = 'run-status-updates',
    RunParticipants = 'run-participants',
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    title: ReactNode;
    children: ReactNode;
    subtitle?: ReactNode;
    onBack?: () => void;
    scrollable: boolean;
}

const RightHandSidebar = ({isOpen, onClose, title, children, subtitle, onBack, scrollable}: Props) => {
    const sidebarRef = React.useRef(null);

    if (!isOpen) {
        return null;
    }

    return (
        <Container
            id='playbooks-sidebar-right'
            role='complementary'
            ref={sidebarRef}
            isOpen={isOpen}
        >
            <Header>
                {onBack ? (
                    <BackIcon>
                        <i
                            data-testid={'rhs-back-button'}
                            className='icon icon-arrow-back-ios'
                            onClick={onBack}
                        />
                    </BackIcon>
                ) : null}
                <HeaderTitle data-testid='rhs-title'>{title}</HeaderTitle>
                <HeaderVerticalDivider/>
                {subtitle && <HeaderSubtitle data-testid='rhs-subtitle'>{subtitle}</HeaderSubtitle>}
                <ExpandRight/>
                <HeaderIcon>
                    <i
                        className='icon icon-close'
                        onClick={onClose}
                    />
                </HeaderIcon>
            </Header>
            <Body>
                {scrollable ? (
                    <Scrollbars
                        autoHide={true}
                        autoHideTimeout={500}
                        autoHideDuration={500}
                        renderThumbVertical={renderThumbVertical}
                        renderView={renderView}
                        renderTrackHorizontal={renderTrackHorizontal}
                        style={{position: 'relative'}}
                    >
                        {children}
                    </Scrollbars>
                ) : children}
            </Body>
        </Container>);
};

export default RightHandSidebar;

const Container = styled.div<{isOpen: boolean}>`
    display: ${({isOpen}) => (isOpen ? 'flex' : 'hidden')};
    height: 100%;
    flex-direction: column;
    border-left: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    right: 0;
    background-color: var(--center-channel-bg);
`;

const Header = styled.div`
    display: flex;
    flex-direction: row;
    height: 56px;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
`;

const HeaderIcon = styled.div`
    display: flex;
    align-self: center;
    justify-content: center;
    cursor: pointer;
    width: 32px;
    height: 32px;
    margin-right: 20px;
    border-radius: 4px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    :hover {
        background-color: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

const HeaderTitle = styled.div`
    margin: auto 0;
    line-height: 32px;
    font-size: 16px;
    font-weight: 600;
    color: var(--center-channel-color);
    white-space: nowrap;
    :first-child {
        margin-left: 20px;
    }
`;

export const HeaderVerticalDivider = styled.div`
    height: 2.4rem;
    border-left: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    margin: 0 8px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    align-self: center;
`;

export const HeaderSubtitle = styled.div`
    overflow: hidden;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
    align-self: center;
`;

const Body = styled.div`
    display: flex;
    flex: 1;
    flex-direction: column;
`;

const BackIcon = styled(HeaderIcon)`
    margin: 0 10px;
`;
