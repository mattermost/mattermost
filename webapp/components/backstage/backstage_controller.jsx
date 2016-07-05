// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import TeamStore from 'stores/team_store.jsx';

import BackstageSidebar from './components/backstage_sidebar.jsx';
import BackstageNavbar from './components/backstage_navbar.jsx';
import ErrorBar from 'components/error_bar.jsx';

export default class BackstageController extends React.Component {
    static get propTypes() {
        return {
            children: React.PropTypes.node.isRequired,
            params: React.PropTypes.object.isRequired,
            user: React.PropTypes.user.isRequired
        };
    }

    constructor(props) {
        super(props);

        this.onTeamChange = this.onTeamChange.bind(this);

        this.state = {
            team: props.params.team ? TeamStore.getByName(props.params.team) : TeamStore.getCurrent()
        };
    }

    componentDidMount() {
        TeamStore.addChangeListener(this.onTeamChange);
    }

    componentWillUnmount() {
        TeamStore.removeChangeListener(this.onTeamChange);
    }

    onTeamChange() {
        this.state = {
            team: this.props.params.team ? TeamStore.getByName(this.props.params.team) : TeamStore.getCurrent()
        };
    }

    render() {
        return (
            <div className='backstage'>
                <ErrorBar/>
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
                                user: this.props.user
                            });
                        })
                    }
                </div>
            </div>
        );
    }
}