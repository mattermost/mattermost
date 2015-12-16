// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import * as utils from '../utils/utils.jsx';
import * as client from '../utils/client.jsx';
import Constants from '../utils/constants.jsx';

const messages = defineMessages({
    nameError1: {
        id: 'sso_signup.nameError1',
        defaultMessage: 'Please enter a team name'
    },
    nameError2: {
        id: 'sso_signup.nameError2',
        defaultMessage: 'Name must be 3 or more characters up to a maximum of 15'
    },
    zbox: {
        id: 'sso_signup.zbox',
        defaultMessage: 'Create team with ZBox Account'
    },
    teamName: {
        id: 'sso_signup.teamName',
        defaultMessage: 'Enter name of new team'
    },
    find: {
        id: 'sso_signup.find',
        defaultMessage: 'Find my team'
    }
});

class SSOSignUpPage extends React.Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);
        this.nameChange = this.nameChange.bind(this);

        this.state = {name: ''};
    }
    handleSubmit(e) {
        e.preventDefault();
        const {formatMessage} = this.props.intl;
        var team = {};
        var state = this.state;
        state.nameError = null;
        state.serverError = null;

        team.display_name = this.state.name;

        if (!team.display_name) {
            state.nameError = formatMessage(messages.nameError1);
            this.setState(state);
            return;
        }

        if (team.display_name.length <= 2) {
            state.nameError = formatMessage(messages.nameError2);
            this.setState(state);
            return;
        }

        team.name = utils.cleanUpUrlable(team.display_name);
        team.type = 'O';

        client.createTeamWithSSO(team,
            this.props.service,
            (data) => {
                if (data.follow_link) {
                    window.location.href = data.follow_link;
                } else {
                    window.location.href = '/' + team.name + '/channels/general';
                }
            },
            (err) => {
                state.serverError = err.message;
                this.setState(state);
            }
        );
    }
    nameChange() {
        this.setState({name: ReactDOM.findDOMNode(this.refs.teamname).value.trim()});
    }
    render() {
        const {formatMessage} = this.props.intl;
        var nameError = null;
        var nameDivClass = 'form-group';
        if (this.state.nameError) {
            nameError = <label className='control-label'>{this.state.nameError}</label>;
            nameDivClass += ' has-error';
        }

        var serverError = null;
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        var disabled = false;
        if (this.state.name.length <= 2) {
            disabled = true;
        }

        var button = null;

        if (this.props.service === Constants.GITLAB_SERVICE) {
            button = (
                <a
                    className='btn btn-custom-login gitlab btn-full'
                    href='#'
                    key='gitlab'
                    onClick={this.handleSubmit}
                    disabled={disabled}
                >
                    <span className='icon'/>
                    <span>{'Create team with GitLab Account'}</span>
                </a>
            );
        }

        if (this.props.service === Constants.ZBOX_SERVICE) {
            button = (
                <a
                    className='btn btn-custom-login zbox btn-full'
                    href='#'
                    onClick={this.handleSubmit}
                    disabled={disabled}
                >
                    <span className='icon'/>
                    <span>{formatMessage(messages.zbox)}</span>
                </a>
            );
        }

        return (
            <form
                role='form'
                onSubmit={this.handleSubmit}
            >
                <div className={nameDivClass}>
                    <input
                        autoFocus={true}
                        type='text'
                        ref='teamname'
                        className='form-control'
                        placeholder={formatMessage(messages.teamName)}
                        maxLength='128'
                        onChange={this.nameChange}
                        spellCheck='false'
                    />
                    {nameError}
                </div>
                <div className='form-group'>
                    {button}
                    {serverError}
                </div>
                <div className='form-group margin--extra-2x'>
                    <span><a href='/find_team'>{formatMessage(messages.find)}</a></span>
                </div>
            </form>
        );
    }
}

SSOSignUpPage.defaultProps = {
    service: ''
};
SSOSignUpPage.propTypes = {
    intl: intlShape.isRequired,
    service: React.PropTypes.string
};

export default injectIntl(SSOSignUpPage);