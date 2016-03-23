// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import TeamStore from 'stores/team_store.jsx';

import React from 'react';
import {FormattedMessage} from 'react-intl';

import logoImage from 'images/logo.png';

export default class Claim extends React.Component {
    constructor(props) {
        super(props);

        this.onTeamChange = this.onTeamChange.bind(this);
        this.updateStateFromStores = this.updateStateFromStores.bind(this);

        this.state = {};
    }
    componentWillMount() {
        this.setState({
            email: this.props.location.query.email,
            newType: this.props.location.query.new_type,
            oldType: this.props.location.query.old_type,
            teamName: this.props.params.team,
            teamDisplayName: ''
        });
        this.updateStateFromStores();
    }
    componentDidMount() {
        TeamStore.addChangeListener(this.onTeamChange);
    }
    componentWillUnmount() {
        TeamStore.removeChangeListener(this.onTeamChange);
    }
    updateStateFromStores() {
        const team = TeamStore.getByName(this.state.teamName);
        let displayName = '';
        if (team) {
            displayName = team.display_name;
        }
        this.setState({
            teamDisplayName: displayName
        });
    }
    onTeamChange() {
        this.updateStateFromStores();
    }
    render() {
        return (
            <div>
                <div className='signup-header'>
                    <a href='/'>
                        <span className='fa fa-chevron-left'/>
                        <FormattedMessage
                            id='web.header.back'
                        />
                    </a>
                </div>
                <div className='col-sm-12'>
                    <div className='signup-team__container'>
                        <img
                            className='signup-team-logo'
                            src={logoImage}
                        />
                        <div id='claim'>
                            {React.cloneElement(this.props.children, {
                                teamName: this.state.teamName,
                                teamDisplayName: this.state.teamDisplayName,
                                currentType: this.state.oldType,
                                newType: this.state.newType,
                                email: this.state.email
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

Claim.defaultProps = {
};
Claim.propTypes = {
    params: React.PropTypes.object.isRequired,
    location: React.PropTypes.object.isRequired,
    children: React.PropTypes.node
};
