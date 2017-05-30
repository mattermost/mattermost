import PropTypes from 'prop-types';

// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';

import BackstageSidebar from './components/backstage_sidebar.jsx';
import BackstageNavbar from './components/backstage_navbar.jsx';
import AnnouncementBar from 'components/announcement_bar';

export default class BackstageController extends React.Component {
    static get propTypes() {
        return {
            user: PropTypes.object,
            children: PropTypes.node.isRequired
        };
    }

    constructor(props) {
        super(props);

        this.onTeamChange = this.onTeamChange.bind(this);

        const team = TeamStore.getCurrent();

        this.state = {
            team,
            isAdmin: UserStore.isSystemAdminForCurrentUser(this.props.user) ||
                TeamStore.isTeamAdminForCurrentTeam(team)
        };
    }

    componentDidMount() {
        TeamStore.addChangeListener(this.onTeamChange);
    }

    componentWillUnmount() {
        TeamStore.removeChangeListener(this.onTeamChange);
    }

    onTeamChange() {
        const team = TeamStore.getCurrent();

        this.state = {
            team,
            isAdmin: UserStore.isSystemAdminForCurrentUser(this.props.user) ||
                TeamStore.isTeamAdminForCurrentTeam(team)
        };
    }

    render() {
        return (
            <div className='backstage'>
                <AnnouncementBar/>
                <BackstageNavbar team={this.state.team}/>
                <div className='backstage-body'>
                    <BackstageSidebar
                        team={this.state.team}
                        user={this.props.user}
                    />
                    {
                        React.Children.map(this.props.children, (child) => {
                            if (!child) {
                                return child;
                            }

                            return React.cloneElement(child, {
                                team: this.state.team,
                                user: this.props.user,
                                isAdmin: this.state.isAdmin
                            });
                        })
                    }
                </div>
            </div>
        );
    }
}
