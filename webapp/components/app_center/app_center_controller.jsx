// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import ErrorBar from 'components/error_bar.jsx';
import TeamStore from 'stores/team_store.jsx';

import AppCenterNavbar from './components/app_center_navbar.jsx';

export default class AppCenter extends React.Component {
    static get propTypes() {
        return {
            children: React.PropTypes.node.isRequired,
            params: React.PropTypes.object
        };
    }

    constructor(props) {
        super(props);

        this.handleChange = this.handleChange.bind(this);

        this.state = {
            team: TeamStore.getCurrent()
        };
    }

    componentDidMount() {
        TeamStore.addChangeListener(this.handleChange);
        document.querySelector('body').classList.add('appcenter');
    }

    componentWillUnmount() {
        TeamStore.removeChangeListener(this.handleChange);
        document.querySelector('body').classList.remove('appcenter');
    }

    handleChange() {
        this.setState({
            team: TeamStore.getCurrent()
        });
    }

    render() {
        if (!this.state.team) {
            return null;
        }

        return (
            <div>
                <ErrorBar/>
                <AppCenterNavbar team={this.state.team}/>
                {this.props.children}
            </div>
        );
    }
}
