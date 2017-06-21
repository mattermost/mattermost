// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';

import {getCustomTeamCommands} from 'mattermost-redux/actions/integrations';

export default class CommandsContainer extends React.Component {
    static propTypes = {

            /**
            * The team data needed to pass into child components
            */
            team: PropTypes.object,

            /**
            * The user data needed to pass into child components
            */
            user: PropTypes.object,

            /**
            * The children prop needed to render child component
            */
            children: PropTypes.node.isRequired,

            /**
            * Set if user is admin
            */
            isAdmin: PropTypes.bool
    }

    constructor(props) {
        super(props);
        this.state = {
            loading: true
        };
    }

    componentDidMount() {
        if (window.mm_config.EnableCommands === 'true') {
            this.props.actions.getCustomTeamCommands(this.props.team.id).then(
                () => this.setState({loading: false})
            );
        }
    }

    render() {
        return (
            <div>
                {React.cloneElement(this.props.children, {
                    loading: this.state.loading,
                    commands: this.props.commands || [],
                    users: this.props.users,
                    team: this.props.team,
                    user: this.props.user,
                    isAdmin: this.props.isAdmin
                })}
            </div>
        );
    }
}
