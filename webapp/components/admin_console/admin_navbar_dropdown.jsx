// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import ReactDOM from 'react-dom';

import TeamStore from 'stores/team_store.jsx';
import Constants from 'utils/constants.jsx';
import * as GlobalActions from 'action_creators/global_actions.jsx';

import {FormattedMessage} from 'react-intl';

import {Link} from 'react-router';

import React from 'react';

export default class AdminNavbarDropdown extends React.Component {
    constructor(props) {
        super(props);
        this.blockToggle = false;
        this.onTeamChange = this.onTeamChange.bind(this);

        this.state = {
            teams: TeamStore.getAll(),
            teamMembers: TeamStore.getTeamMembers()
        };
    }

    componentDidMount() {
        $(ReactDOM.findDOMNode(this.refs.dropdown)).on('hide.bs.dropdown', () => {
            this.blockToggle = true;
            setTimeout(() => {
                this.blockToggle = false;
            }, 100);
        });

        TeamStore.addChangeListener(this.onTeamChange);
    }

    componentWillUnmount() {
        $(ReactDOM.findDOMNode(this.refs.dropdown)).off('hide.bs.dropdown');
        TeamStore.removeChangeListener(this.onTeamChange);
    }

    onTeamChange() {
        this.setState({
            teams: TeamStore.getAll(),
            teamMembers: TeamStore.getTeamMembers()
        });
    }

    render() {
        var teams = [];

        if (this.state.teamMembers && this.state.teamMembers.length > 0) {
            teams.push(
                <li
                    key='teamDiv'
                    className='divider'
                ></li>
            );

            for (var index in this.state.teamMembers) {
                if (this.state.teamMembers.hasOwnProperty(index)) {
                    var teamMember = this.state.teamMembers[index];
                    var team = this.state.teams[teamMember.team_id];
                    teams.push(
                        <li key={'team_' + team.name}>
                            <Link
                                to={'/' + team.name + '/channels/town-square'}
                            >
                                {team.display_name}
                            </Link>
                        </li>
                    );
                }
            }
        }

        return (
            <ul className='nav navbar-nav navbar-right'>
                <li
                    ref='dropdown'
                    className='dropdown'
                >
                    <a
                        href='#'
                        className='dropdown-toggle'
                        data-toggle='dropdown'
                        role='button'
                        aria-expanded='false'
                    >
                        <span
                            className='dropdown__icon'
                            dangerouslySetInnerHTML={{__html: Constants.MENU_ICON}}
                        />
                    </a>
                    <ul
                        className='dropdown-menu'
                        role='menu'
                    >
                        <li>
                            <Link
                                to={'/select_team'}
                            >
                                <FormattedMessage
                                    id='admin.nav.switch'
                                    defaultMessage='Switch to {display_name}'
                                    values={{
                                        display_name: global.window.mm_config.SiteName
                                    }}
                                />
                            </Link>
                        </li>
                        {teams}
                        <li
                            key='teamDiv'
                            className='divider'
                        ></li>
                        <li>
                            <a
                                href='#'
                                onClick={GlobalActions.emitUserLoggedOutEvent}
                            >
                                <FormattedMessage
                                    id='admin.nav.logout'
                                    defaultMessage='Logout'
                                />
                            </a>
                        </li>
                    </ul>
                </li>
            </ul>
        );
    }
}
