// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {closeBackstageRHS} from 'src/actions';
import {backstageRHS} from 'src/selectors';
import {BackstageRHSSection, BackstageRHSViewMode} from 'src/types/backstage_rhs';

import TaskInbox, {TaskInboxTitle} from './task_inbox/task_inbox';

const BackstageRHS = () => {
    const sidebarRef = React.useRef(null);
    const dispatch = useDispatch();
    const isOpen = useSelector(backstageRHS.isOpen);
    const viewMode = useSelector(backstageRHS.viewMode);
    const section = useSelector(backstageRHS.section);

    if (!isOpen) {
        return null;
    }

    const renderTitle = () => {
        switch (section) {
        case BackstageRHSSection.TaskInbox:
            return TaskInboxTitle;
        default:
            throw new Error('Unknown backstage section while rendering title');
        }
    };

    return (
        <Container
            id='playbooks-backstage-sidebar-right'
            role='complementary'
            ref={sidebarRef}
            $isOpen={isOpen}
            $viewMode={viewMode}
        >
            <Header>
                <HeaderTitle>{renderTitle()}</HeaderTitle>
                <ExpandRight/>
                <HeaderIcon>
                    <i
                        className='icon icon-close'
                        onClick={() => dispatch(closeBackstageRHS())}
                    />
                </HeaderIcon>
            </Header>
            <Body>
                {section === BackstageRHSSection.TaskInbox ? <TaskInbox/> : null}
            </Body>
        </Container>);
};

export default BackstageRHS;

const Container = styled.div<{$isOpen: boolean, $viewMode: BackstageRHSViewMode}>`
    position: fixed;
    z-index: 5;
    top: 45px;
    right: 0;
    display: ${({$isOpen}) => ($isOpen ? 'flex' : 'hidden')};
    width: 400px;
    height: 100%;
    flex-direction: column;
    border-radius: 0;
    border-left: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    background-color: var(--center-channel-bg);
    box-shadow: 0 4px 6px rgba(0 0 0 / 0.12);


    @media screen and (width >= 1600px) {
        width: 500px;
    }
`;

const Header = styled.div`
    display: flex;
    height: 56px;
    flex-direction: row;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
`;

const HeaderIcon = styled.div`
    display: flex;
    width: 32px;
    height: 32px;
    align-self: center;
    justify-content: center;
    margin-right: 20px;
    cursor: pointer;

    &:hover {
        background-color: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

const HeaderTitle = styled.div`
    margin: auto 0 auto 20px;
    color: var(--center-channel-color);
    font-size: 16px;
    font-weight: 600;
    line-height: 32px;
    white-space: nowrap;
`;

const Body = styled.div`
    display: flex;
    flex: 1;
    flex-direction: column;
`;

export const ExpandRight = styled.div`
    margin-left: auto;
`;
