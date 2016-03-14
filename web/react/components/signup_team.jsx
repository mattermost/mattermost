// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ChoosePage from './team_signup_choose_auth.jsx';
import EmailSignUpPage from './team_signup_with_email.jsx';
import SSOSignupPage from './team_signup_with_sso.jsx';
import LdapSignUpPage from './team_signup_with_ldap.jsx';
import Constants from '../utils/constants.jsx';
import TeamStore from '../stores/team_store.jsx';
import * as AsyncClient from '../utils/async_client.jsx';

import {FormattedMessage} from 'mm-intl';

export default class TeamSignUp extends React.Component {
    constructor(props) {
        super(props);

        this.updatePage = this.updatePage.bind(this);
        this.onTeamUpdate = this.onTeamUpdate.bind(this);

        var count = 0;

        if (global.window.mm_config.EnableSignUpWithEmail === 'true') {
            count = count + 1;
        }

        if (global.window.mm_config.EnableSignUpWithGitLab === 'true') {
            count = count + 1;
        }

        if (global.window.mm_config.EnableLdap === 'true') {
            count = count + 1;
        }

        if (count > 1) {
            this.state = {page: 'choose'};
        } else if (global.window.mm_config.EnableSignUpWithEmail === 'true') {
            this.state = {page: 'email'};
        } else if (global.window.mm_config.EnableSignUpWithGitLab === 'true') {
            this.state = {page: 'gitlab'};
        } else if (global.window.mm_config.EnableLdap === 'true') {
            this.state = {page: 'ldap'};
        } else {
            this.state = {page: 'none'};
        }
    }

    updatePage(page) {
        this.setState({page});
    }

    componentWillMount() {
        if (global.window.mm_config.EnableTeamListing === 'true') {
            AsyncClient.getAllTeams();
            this.onTeamUpdate();
        }
    }

    componentDidMount() {
        TeamStore.addChangeListener(this.onTeamUpdate);
    }

    componentWillUnmount() {
        TeamStore.removeChangeListener(this.onTeamUpdate);
    }

    onTeamUpdate() {
        this.setState({
            teams: TeamStore.getAll()
        });
    }

    render() {
        let teamListing = null;

        if (global.window.mm_config.EnableTeamListing === 'true') {
            if (this.state.teams == null) {
                teamListing = (<div/>);
            } else if (this.state.teams.length === 0) {
                if (global.window.mm_config.EnableTeamCreation !== 'true') {
                    teamListing = (
                        <div>
                            <FormattedMessage
                                id='signup_team.noTeams'
                                defaultMessage='There are no teams include in the Team Directory and team creation has been disabled.'
                            />
                        </div>
                    );
                }
            } else {
                teamListing = (
                    <div>
                        <h4>
                            <FormattedMessage
                                id='signup_team.choose'
                                defaultMessage='Choose a Team'
                            />
                        </h4>
                        <div className='signup-team-all'>
                            {
                                Object.values(this.state.teams).map((team) => {
                                    if (team.allow_team_listing) {
                                        return (
                                            <div
                                                key={'team_' + team.name}
                                                className='signup-team-dir'
                                            >
                                                <a
                                                    href={'/' + team.name}
                                                >
                                                    <span className='signup-team-dir__name'>{team.display_name}</span>
                                                    <span
                                                        className='glyphicon glyphicon-menu-right right signup-team-dir__arrow'
                                                        aria-hidden='true'
                                                    />
                                                </a>
                                            </div>
                                        );
                                    }
                                    return null;
                                })
                            }
                        </div>
                        <h4>
                            <FormattedMessage
                                id='signup_team.createTeam'
                                defaultMessage='Or Create a Team'
                            />
                        </h4>
                    </div>
                );
            }
        }

        let signupMethod = null;

        if (global.window.mm_config.EnableTeamCreation !== 'true') {
            if (teamListing == null) {
                signupMethod = (
                    <FormattedMessage
                        id='signup_team.disabled'
                        defaultMessage='Team creation has been disabled.  Please contact an administrator for access.'
                    />
                );
            }
        } else if (this.state.page === 'choose') {
            signupMethod = (
                <ChoosePage
                    updatePage={this.updatePage}
                />
            );
        } else if (this.state.page === 'email') {
            signupMethod = (
                <EmailSignUpPage/>
            );
        } else if (this.state.page === 'ldap') {
            return (
                <div>
                    {teamListing}
                    <LdapSignUpPage/>
                </div>
            );
        } else if (this.state.page === 'gitlab') {
            signupMethod = (
                <SSOSignupPage service={Constants.GITLAB_SERVICE}/>
            );
        } else if (this.state.page === 'google') {
            signupMethod = (
                <SSOSignupPage service={Constants.GOOGLE_SERVICE}/>
            );
        } else if (this.state.page === 'none') {
            signupMethod = (
                <FormattedMessage
                    id='signup_team.none'
                    defaultMessage='No team creation method has been enabled.  Please contact an administrator for access.'
                />
            );
        }

        return (
            <div className='col-sm-12'>
                <div className='signup-team__container'>
                    <img
                        className='signup-team-logo'
                        src='/static/images/logo.png'
                    />
                    <h1>{global.window.mm_config.SiteName}</h1>
                    <h4 className='color--light'>
                        <FormattedMessage
                            id='web.root.singup_info'
                        />
                    </h4>
                    <div id='signup-team'>
                        {teamListing}
                        {signupMethod}
                    </div>
                </div>
            </div>
        );
    }
}

TeamSignUp.propTypes = {
};

