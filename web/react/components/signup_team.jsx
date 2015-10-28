// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const ChoosePage = require('./team_signup_choose_auth.jsx');
const EmailSignUpPage = require('./team_signup_with_email.jsx');
const SSOSignupPage = require('./team_signup_with_sso.jsx');
const Constants = require('../utils/constants.jsx');

export default class TeamSignUp extends React.Component {
    constructor(props) {
        super(props);

        this.updatePage = this.updatePage.bind(this);

        if (global.window.mm_config.EnableTeamListing === 'true') {
            this.state = {page: 'team_listing'};
            return;
        }

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
        }
    }

    componentDidMount() {
        if (global.window.mm_config.EnableTeamListing === 'true' && this.props.teams.length === 1) {
            window.location.href = '/' + this.props.teams[0].name;
        }
    }

    updatePage(page) {
        this.setState({page});
    }

    render() {
        if (this.state.page === 'team_listing') {
            return (
                <div>
                    <h3>{'Choose a Team'}</h3>
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
                                            <div className='signup-team-dir__group'>
                                                <span className='signup-team-dir__name'>{team.display_name}</span>
                                                <span
                                                    className='glyphicon glyphicon-menu-right right signup-team-dir__arrow'
                                                    aria-hidden='true'
                                                />
                                            </div>
                                        </a>
                                    </div>
                                );
                            })
                        }
                    </div>
                </div>
            );
        }

        if (this.state.page === 'choose') {
            return (
                <ChoosePage
                    updatePage={this.updatePage}
                />
            );
        }

        if (this.state.page === 'email') {
            return <EmailSignUpPage />;
        } else if (this.state.page === 'gitlab') {
            return <SSOSignupPage service={Constants.GITLAB_SERVICE} />;
        }
    }
}

TeamSignUp.propTypes = {
    teams: React.PropTypes.array
};

