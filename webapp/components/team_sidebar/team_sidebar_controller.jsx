// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import TeamButton from './components/team_button.jsx';

import BrowserStore from 'stores/browser_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';

import * as AsyncClient from 'utils/async_client.jsx';
import * as UserAgent from 'utils/user_agent.jsx';
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
            show: teamMembers && teamMembers.length > 1 && (!UserAgent.isMobile() && !UserAgent.isMobileApp() && !Utils.isMobile())
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
        if (!Utils.isMobile()) {
            $('.team-wrapper').perfectScrollbar();
        }

        // reset the scrollbar upon switching teams
        if (this.state.currentTeam !== prevState.currentTeam) {
            this.refs.container.scrollTop = 0;
            $('.team-wrapper').perfectScrollbar('update');
        }
    }

    onChange() {
        this.setState(this.getStateFromStores());
        this.setStyles();
    }

    handleResize() {
        const teamMembers = this.state.teamMembers;
        this.setState({show: teamMembers && teamMembers.length > 1 && (!UserAgent.isMobile() && !UserAgent.isMobileApp() && !Utils.isMobile())});
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
        sort((a, b) => a.display_name.localeCompare(b.display_name)).
        map((team) => {
            let channel = 'town-square';
            const prevChannel = BrowserStore.getGlobalItem(team.id);

            if (prevChannel) {
                channel = prevChannel;
            }

            return (
                <TeamButton
                    key={'switch_team_' + team.name}
                    url={`/${team.name}/channels/${channel}`}
                    tip={team.display_name}
                    active={team.id === this.state.currentTeamId}
                    contents={team.display_name.substr(0, 1).toUpperCase()}
                    unread={team.unread}
                    mentions={team.mentions}
                />
            );
        });

        if (moreTeams) {
            teams.push(
                <TeamButton
                    key='more_teams'
                    url='/select_team'
                    tip={
                        <FormattedMessage
                            id='team_sidebar.join'
                            defaultMessage='Other teams you can join.'
                        />
                    }
                    contents={<i className='fa fa-plus'/>}
                />
            );
        } else if (global.window.mm_config.EnableTeamCreation === 'true' || isSystemAdmin) {
            teams.push(
                <TeamButton
                    key='more_teams'
                    url='/create_team'
                    tip={
                        <FormattedMessage
                            id='navbar_dropdown.create'
                            defaultMessage='Create a New Team'
                        />
                    }
                    contents={<i className='fa fa-plus'/>}
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
