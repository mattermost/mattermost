// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import EmailToSSO from './email_to_sso.jsx';
import SSOToEmail from './sso_to_email.jsx';
import TeamStore from '../../stores/team_store.jsx';

import {FormattedMessage} from 'mm-intl';

export default class ClaimAccount extends React.Component {
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
            displayName = team.displayName;
        }
        this.setState({
            teamDisplayName: displayName
        });
    }
    onTeamChange() {
        this.updateStateFromStores();
    }
    render() {
        if (this.state.teamDisplayName === '') {
            return (<div/>);
        }
        let content;
        if (this.state.email === '') {
            content = (
                <p>
                    <FormattedMessage
                        id='claim.account.noEmail'
                        defaultMessage='No email specified'
                    />
                </p>
            );
        } else if (this.state.oldType === '' && this.state.newType !== '') {
            content = (
                <EmailToSSO
                    email={this.state.email}
                    type={this.state.newType}
                    teamName={this.state.teamName}
                    teamDisplayName={this.state.teamDisplayName}
                />
            );
        } else {
            content = (
                <SSOToEmail
                    email={this.state.email}
                    currentType={this.state.oldType}
                    teamName={this.state.teamName}
                    teamDisplayName={this.state.teamDisplayName}
                />
            );
        }

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
                            src='/static/images/logo.png'
                        />
                        <div id='claim'>
                            {content}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

ClaimAccount.defaultProps = {
};
ClaimAccount.propTypes = {
    params: React.PropTypes.object.isRequired,
    location: React.PropTypes.object.isRequired
};
