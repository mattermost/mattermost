// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
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
            isOpen={isOpen}
            viewMode={viewMode}
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

const Container = styled.div<{isOpen: boolean, viewMode: BackstageRHSViewMode}>`
    display: ${({isOpen}) => (isOpen ? 'flex' : 'hidden')};
    position: fixed;
    width: 400px;
    height: 100%;
    flex-direction: column;
    border-left: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    right: 0;
    top: 40px;
    z-index: 5;
    background-color: var(--center-channel-bg);


    @media screen and (min-width: 1600px) {
        width: 500px;
    }

    border-radius: 0;
    box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.12);
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
    :hover {
        background-color: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

const HeaderTitle = styled.div`
    margin: auto 0 auto 20px;
    line-height: 32px;
    font-size: 16px;
    font-weight: 600;
    color: var(--center-channel-color);
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
