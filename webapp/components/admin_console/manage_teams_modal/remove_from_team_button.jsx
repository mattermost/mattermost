// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {removeUserFromTeam} from 'actions/team_actions.jsx';

export default class RemoveFromTeamButton extends React.PureComponent {
    static propTypes = {
        onError: React.PropTypes.func.isRequired,
        onMemberRemove: React.PropTypes.func.isRequired,
        team: React.PropTypes.object.isRequired,
        user: React.PropTypes.object.isRequired
    };

    constructor(props) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
        this.handleMemberRemove = this.handleMemberRemove.bind(this);
    }

    handleClick(e) {
        e.preventDefault();

        removeUserFromTeam(
            this.props.team.id,
            this.props.user.id,
            this.handleMemberRemove,
            this.props.onError
        );
    }

    handleMemberRemove() {
        this.props.onMemberRemove(this.props.team.id);
    }

    render() {
        return (
            <button
                className='btn btn-default'
                onClick={this.handleClick}
            >
                <FormattedMessage
                    id='team_members_dropdown.leave_team'
                    defaultMessage='Remove from Team'
                />
            </button>
        );
    }
}
