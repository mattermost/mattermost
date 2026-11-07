// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode} from 'react';
import styled from 'styled-components';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {GlobalState} from '@mattermost/types/store';
import {useSelector} from 'react-redux';
import {Team} from '@mattermost/types/teams';
import Scrollbars from 'react-custom-scrollbars';

import Tooltip from 'src/components/widgets/tooltip';

import {renderThumbVertical, renderTrackHorizontal, renderView} from 'src/components/rhs/rhs_shared';

import Group from './group';

export interface GroupItem {
    id?: string;
    icon: string;
    itemMenu?: React.ReactNode;
    display_name: string;
    className: string;
    areaLabel: string;
    link: string;
    isCollapsed: boolean;
}

export interface SidebarGroup {
    id: string;
    display_name: string;
    collapsed: boolean;
    items: Array<GroupItem>;
    afterGroup?: ReactNode;
}

interface SidebarProps {
    team_id: string;
    groups: Array<SidebarGroup>;
    headerDropdown: React.ReactNode;
}

const selectTeam = (teamId: string) => (state: GlobalState): Team | undefined => getTeam(state, teamId);

const Sidebar = (props: SidebarProps) => {
    const team = useSelector(selectTeam(props.team_id));

    const teamName = (
        <TeamName>
            {team?.display_name}
        </TeamName>
    );

    return (
        <SidebarComponent>
            <Header>
                {team?.description ? (
                    <Tooltip
                        id='team-name__tooltip'
                        content={team?.description}
                        placement='bottom'
                        shouldUpdatePosition={true}
                    >
                        {teamName}
                    </Tooltip>
                ) : (
                    teamName
                )}
                {props.headerDropdown}
            </Header>
            <Scrollbars
                autoHide={true}
                autoHideTimeout={500}
                autoHideDuration={500}
                renderThumbVertical={renderThumbVertical}
                renderView={renderView}
                renderTrackHorizontal={renderTrackHorizontal}
                style={{
                    position: 'relative',
                    marginBottom: '40px',
                }}
            >
                {props.groups.map((group) => {
                    return (
                        <Group
                            key={group.id}
                            group={group}
                        />
                    );
                })}
            </Scrollbars>
        </SidebarComponent>
    );
};

const SidebarComponent = styled.div`
    position: fixed;
    z-index: 16;
    display: flex;
    width: 241px;
    height: 100%;
    flex-direction: column;
    border-right: 1px solid rgba(var(--center-channel-color-rgb), 0.12);
    background-color: var(--sidebar-bg);
`;

const Header = styled.div`
    display: flex;
    height: 52px;
    flex: initial;
    flex-flow: row nowrap;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    margin: 0;
    gap: 8px;
`;

const TeamName = styled.h1`
    display: inline-block;
    overflow: hidden;
    margin: 0;
    color: var(--sidebar-header-text-color);
    cursor: pointer;
    font-family: Metropolis, sans-serif;
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

export default Sidebar;
