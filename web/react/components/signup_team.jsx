// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ChoosePage from './team_signup_choose_auth.jsx';
import EmailSignUpPage from './team_signup_with_email.jsx';
import SSOSignupPage from './team_signup_with_sso.jsx';
import Constants from '../utils/constants.jsx';

import {FormattedMessage} from 'mm-intl';

export default class TeamSignUp extends React.Component {
    constructor(props) {
        super(props);

        this.updatePage = this.updatePage.bind(this);

        var count = 0;

        if (global.window.mm_config.EnableSignUpWithEmail === 'true') {
            count = count + 1;
        }

        if (global.window.mm_config.EnableSignUpWithGitLab === 'true') {
            count = count + 1;
        }

        if (count > 1) {
            this.state = {page: 'choose'};
        } else if (global.window.mm_config.EnableSignUpWithEmail === 'true') {
            this.state = {page: 'email'};
        } else if (global.window.mm_config.EnableSignUpWithGitLab === 'true') {
            this.state = {page: 'gitlab'};
        } else {
            this.state = {page: 'none'};
        }
    }

    updatePage(page) {
        this.setState({page});
    }

    render() {
        var teamListing = null;

        if (global.window.mm_config.EnableTeamListing === 'true') {
            if (this.props.teams.length === 0) {
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
                                this.props.teams.map((team) => {
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

        if (global.window.mm_config.EnableTeamCreation !== 'true') {
            if (teamListing == null) {
                return (
                    <div>
                        <FormattedMessage
                            id='signup_team.disabled'
                            defaultMessage='Team creation has been disabled.  Please contact an administrator for access.'
                        />
                    </div>
                );
            }

            return (
                <div>
                    {teamListing}
                </div>
            );
        }

        if (this.state.page === 'choose') {
            return (
                <div>
                    {teamListing}
                    <ChoosePage
                        updatePage={this.updatePage}
                    />
                </div>
            );
        }

        if (this.state.page === 'email') {
            return (
                <div>
                    {teamListing}
                    <EmailSignUpPage />
                </div>
            );
        } else if (this.state.page === 'gitlab') {
            return (
                <div>
                    {teamListing}
                    <SSOSignupPage service={Constants.GITLAB_SERVICE} />
                </div>
            );
        } else if (this.state.page === 'google') {
            return (
                <div>
                    {teamListing}
                    <SSOSignupPage service={Constants.GOOGLE_SERVICE} />
                </div>
            );
        } else if (this.state.page === 'none') {
            return (
                <div>
                    <FormattedMessage
                        id='signup_team.none'
                        defaultMessage='No team creation method has been enabled.  Please contact an administrator for access.'
                    />
                </div>
            );
        }
    }
}

TeamSignUp.propTypes = {
    teams: React.PropTypes.array
};

