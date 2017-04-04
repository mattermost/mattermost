// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import TeamButton from './components/team_button.jsx';

import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';

import * as AsyncClient from 'utils/async_client.jsx';
import {sortTeamsByDisplayName} from 'utils/team_utils.jsx';
import * as Utils from 'utils/utils.jsx';

import $ from 'jquery';
import React from 'react';
import {FormattedMessage} from 'react-intl';

export default class TeamSidebar extends React.Component {
    constructor(props) {
        super(props);

        this.getStateFromStores = this.getStateFromStores.bind(this);
        this.onChange = this.onChange.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.setStyles = this.setStyles.bind(this);

        this.state = this.getStateFromStores();
    }

    getStateFromStores() {
        const teamMembers = TeamStore.getMyTeamMembers();
        const currentTeamId = TeamStore.getCurrentId();

        return {
            teams: TeamStore.getAll(),
            teamListings: TeamStore.getTeamListings(),
            teamMembers,
            currentTeamId,
            show: teamMembers && teamMembers.length > 1,
            isMobile: Utils.isMobile()
        };
    }

    componentDidMount() {
        window.addEventListener('resize', this.handleResize);
        TeamStore.addChangeListener(this.onChange);
        TeamStore.addUnreadChangeListener(this.onChange);
        AsyncClient.getAllTeamListings();
        this.setStyles();
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.handleResize);
        TeamStore.removeChangeListener(this.onChange);
        TeamStore.removeUnreadChangeListener(this.onChange);
    }

    componentDidUpdate(prevProps, prevState) {
        if (!this.state.isMobile) {
            $('.team-wrapper').perfectScrollbar();
        }

        // reset the scrollbar upon switching teams
        if (this.state.currentTeam !== prevState.currentTeam) {
            this.refs.container.scrollTop = 0;
            if (!this.state.isMobile) {
                $('.team-wrapper').perfectScrollbar('update');
            }
        }
    }

    onChange() {
        this.setState(this.getStateFromStores());
        this.setStyles();
    }

    handleResize() {
        const teamMembers = this.state.teamMembers;
        this.setState({show: teamMembers && teamMembers.length > 1});
        this.setStyles();
    }

    setStyles() {
        const root = document.querySelector('#root');

        if (this.state.show) {
            root.classList.add('multi-teams');
        } else {
            root.classList.remove('multi-teams');
        }
    }

    render() {
        if (!this.state.show) {
            return null;
        }

        const myTeams = [];
        const isSystemAdmin = Utils.isSystemAdmin(UserStore.getCurrentUser().roles);
        const isAlreadyMember = new Map();
        let moreTeams = false;

        for (const index in this.state.teamMembers) {
            if (this.state.teamMembers.hasOwnProperty(index)) {
                const teamMember = this.state.teamMembers[index];
                const teamId = teamMember.team_id;
                myTeams.push(Object.assign({
                    unread: teamMember.msg_count > 0,
                    mentions: teamMember.mention_count
                }, this.state.teams[teamId]));
                isAlreadyMember[teamId] = true;
            }
        }

        for (const id in this.state.teamListings) {
            if (this.state.teamListings.hasOwnProperty(id) && !isAlreadyMember[id]) {
                moreTeams = true;
                break;
            }
        }

        const teams = myTeams.
            sort(sortTeamsByDisplayName).
            map((team) => {
                return (
                    <TeamButton
                        key={'switch_team_' + team.name}
                        url={`/${team.name}`}
                        tip={team.display_name}
                        active={team.id === this.state.currentTeamId}
                        isMobile={this.state.isMobile}
                        displayName={team.display_name}
                        unread={team.unread}
                        mentions={team.mentions}
                    />
                );
            });

        if (moreTeams) {
            teams.push(
                <TeamButton
                    btnClass='team-btn__add'
                    key='more_teams'
                    url='/select_team'
                    isMobile={this.state.isMobile}
                    tip={
                        <FormattedMessage
                            id='team_sidebar.join'
                            defaultMessage='Other teams you can join.'
                        />
                    }
                    content={<i className='fa fa-plus'/>}
                />
            );
        } else if (global.window.mm_config.EnableTeamCreation === 'true' || isSystemAdmin) {
            teams.push(
                <TeamButton
                    btnClass='team-btn__add'
                    key='more_teams'
                    url='/create_team'
                    isMobile={this.state.isMobile}
                    tip={
                        <FormattedMessage
                            id='navbar_dropdown.create'
                            defaultMessage='Create a New Team'
                        />
                    }
                    content={<i className='fa fa-plus'/>}
                />
            );
        }

        return (
            <div className='team-sidebar'>
                <div className='team-wrapper'>
                    {teams}
                </div>
            </div>
        );
    }
}
