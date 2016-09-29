// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {Link} from 'react-router/es6';

export default class SelectTeamItem extends React.Component {
    static propTypes = {
        team: React.PropTypes.object.isRequired,
        url: React.PropTypes.string.isRequired,
        onTeamClick: React.PropTypes.func.isRequired,
        loading: React.PropTypes.bool.isRequired
    };

    constructor(props) {
        super(props);

        this.handleTeamClick = this.handleTeamClick.bind(this);
    }

    handleTeamClick() {
        this.props.onTeamClick(this.props.team);
    }

    render() {
        let icon;
        if (this.props.loading) {
            icon = (
                <span className='fa fa-refresh fa-spin right signup-team__icon'/>
            );
        } else {
            icon = (
                <span className='fa fa-angle-right right signup-team__icon'/>
            );
        }

        return (
            <div className='signup-team-dir'>
                <Link
                    to={this.props.url}
                    onClick={this.handleTeamClick}
                >
                    <span className='signup-team-dir__name'>{this.props.team.display_name}</span>
                    {icon}
                </Link>
            </div>
        );
    }
}
