// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';

import ChoosePage from './team_signup_choose_auth.jsx';
import EmailSignUpPage from './team_signup_with_email.jsx';
import SSOSignupPage from './team_signup_with_sso.jsx';
import Constants from '../utils/constants.jsx';

const messages = defineMessages({
    noTeams: {
        id: 'signup_team.noTeams',
        defaultMessage: 'There are no teams include in the Team Directory and team creation has been disabled.'
    },
    choose: {
        id: 'signup_team.choose',
        defaultMessage: 'Choose a Team'
    },
    createTeam: {
        id: 'signup_team.createTeam',
        defaultMessage: 'Or Create a Team'
    },
    disabled: {
        id: 'signup_team.disabled',
        defaultMessage: 'Team creation has been disabled.  Please contact an administrator for access.'
    }
});

class TeamSignUp extends React.Component {
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

        if (global.window.mm_config.EnableSignUpWithZBox === 'true') {
            count = count + 1;
        }

        if (count > 1) {
            this.state = {page: 'choose'};
        } else if (global.window.mm_config.EnableSignUpWithEmail === 'true') {
            this.state = {page: 'email'};
        } else if (global.window.mm_config.EnableSignUpWithGitLab === 'true') {
            this.state = {page: 'gitlab'};
        } else if (global.window.mm_config.EnableSignUpWithZBox === 'true') {
            this.state = {page: 'zbox'};
        }
    }

    updatePage(page) {
        this.setState({page});
    }

    render() {
        const {formatMessage} = this.props.intl;

        var teamListing = null;

        if (global.window.mm_config.EnableTeamListing === 'true') {
            if (this.props.teams.length === 0) {
                if (global.window.mm_config.EnableTeamCreation !== 'true') {
                    teamListing = (<div>{formatMessage(messages.noTeams)}</div>);
                }
            } else {
                teamListing = (
                    <div>
                        <h4>{formatMessage(messages.choose)}</h4>
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
                        <h4>{formatMessage(messages.createTeam)}</h4>
                    </div>
                );
            }
        }

        if (global.window.mm_config.EnableTeamCreation !== 'true') {
            if (teamListing == null) {
                return (<div>{formatMessage(messages.disabled)}</div>);
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
        } else if (this.state.page === 'zbox') {
            return (
                <div>
                    {teamListing}
                    <SSOSignupPage service={Constants.ZBOX_SERVICE} />
                </div>
            );
        }
    }
}

TeamSignUp.propTypes = {
    teams: React.PropTypes.array,
    intl: intlShape.isRequired
};

export default injectIntl(TeamSignUp);

