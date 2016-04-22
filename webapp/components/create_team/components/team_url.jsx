// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import ReactDOM from 'react-dom';
import * as Utils from 'utils/utils.jsx';
import Client from 'utils/web_client.jsx';
import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';
import Constants from 'utils/constants.jsx';
import {browserHistory} from 'react-router';

import {injectIntl, intlShape, defineMessages, FormattedMessage, FormattedHTMLMessage} from 'react-intl';

import logoImage from 'images/logo.png';

const holders = defineMessages({
    required: {
        id: 'create_team_url.required',
        defaultMessage: 'This field is required'
    },
    regex: {
        id: 'create_team_url.regex',
        defaultMessage: "Use only lower case letters, numbers and dashes. Must start with a letter and can't end in a dash."
    },
    charLength: {
        id: 'create_team_url.charLength',
        defaultMessage: 'Name must be 4 or more characters up to a maximum of 15'
    },
    taken: {
        id: 'create_team_url.taken',
        defaultMessage: 'URL is taken or contains a reserved word'
    },
    unavailable: {
        id: 'create_team_url.unavailable',
        defaultMessage: 'This URL is unavailable. Please try another.'
    }
});

import React from 'react';

class TeamUrl extends React.Component {
    constructor(props) {
        super(props);

        this.submitBack = this.submitBack.bind(this);
        this.submitNext = this.submitNext.bind(this);
        this.handleFocus = this.handleFocus.bind(this);

        this.state = {nameError: ''};
    }
    submitBack(e) {
        e.preventDefault();
        this.props.state.wizard = 'display_name';
        this.props.updateParent(this.props.state);
    }
    submitNext(e) {
        e.preventDefault();

        const {formatMessage} = this.props.intl;
        const name = ReactDOM.findDOMNode(this.refs.name).value.trim();
        if (!name) {
            this.setState({nameError: formatMessage(holders.required)});
            return;
        }

        const cleanedName = Utils.cleanUpUrlable(name);

        const urlRegex = /^[a-z]+([a-z\-0-9]+|(__)?)[a-z0-9]+$/g;
        if (cleanedName !== name || !urlRegex.test(name)) {
            this.setState({nameError: formatMessage(holders.regex)});
            return;
        } else if (cleanedName.length < 4 || cleanedName.length > 15) {
            this.setState({nameError: formatMessage(holders.charLength)});
            return;
        }

        if (global.window.mm_config.RestrictTeamNames === 'true') {
            for (let index = 0; index < Constants.RESERVED_TEAM_NAMES.length; index++) {
                if (cleanedName.indexOf(Constants.RESERVED_TEAM_NAMES[index]) === 0) {
                    this.setState({nameError: formatMessage(holders.taken)});
                    return;
                }
            }
        }

        $('#finish-button').button('loading');
        var teamSignup = JSON.parse(JSON.stringify(this.props.state));
        teamSignup.team.type = 'O';
        teamSignup.team.name = name;

        Client.findTeamByName(name,
            (findTeam) => {
                if (findTeam) {
                    this.setState({nameError: formatMessage(holders.unavailable)});
                    $('#finish-button').button('reset');
                } else {
                    Client.createTeam(teamSignup.team,
                        (team) => {
                            Client.track('signup', 'signup_team_08_complete');
                            $('#sign-up-button').button('reset');
                            TeamStore.saveTeam(team);
                            TeamStore.appendTeamMember({team_id: team.id, user_id: UserStore.getCurrentId(), roles: 'admin'});
                            TeamStore.emitChange();
                            browserHistory.push('/' + team.name + '/channels/town-square');
                        },
                        (err) => {
                            this.setState({nameError: err.message});
                            $('#finish-button').button('reset');
                        }
                    );

                    $('#finish-button').button('reset');
                }
            },
            (err) => {
                this.setState({nameError: err.message});
                $('#finish-button').button('reset');
            }
        );
    }
    handleFocus(e) {
        e.preventDefault();

        e.currentTarget.select();
    }
    render() {
        $('body').tooltip({selector: '[data-toggle=tooltip]', trigger: 'hover click'});

        Client.track('signup', 'signup_team_03_url');

        let nameError = null;
        let nameDivClass = 'form-group';
        if (this.state.nameError) {
            nameError = <label className='control-label'>{this.state.nameError}</label>;
            nameDivClass += ' has-error';
        }

        const title = `${Utils.getWindowLocationOrigin()}/`;

        return (
            <div>
                <form>
                    <img
                        className='signup-team-logo'
                        src={logoImage}
                    />
                    <h2>
                        <FormattedMessage
                            id='create_team_url.teamUrl'
                            defaultMessage='Team URL'
                        />
                    </h2>
                    <div className={nameDivClass}>
                        <div className='row'>
                            <div className='col-sm-11'>
                                <div className='input-group input-group--limit'>
                                    <span
                                        data-toggle='tooltip'
                                        title={title}
                                        className='input-group-addon'
                                    >
                                        {title}
                                    </span>
                                    <input
                                        type='text'
                                        ref='name'
                                        className='form-control'
                                        placeholder=''
                                        maxLength='128'
                                        defaultValue={this.props.state.team.name}
                                        autoFocus={true}
                                        onFocus={this.handleFocus}
                                        spellCheck='false'
                                    />
                                </div>
                            </div>
                        </div>
                        {nameError}
                    </div>
                    <p>
                        <FormattedMessage
                            id='create_team_url.webAddress'
                            defaultMessage='Choose the web address of your new team:'
                        />
                    </p>
                    <ul className='color--light'>
                        <FormattedHTMLMessage
                            id='create_team_url.hint'
                            defaultMessage="<li>Short and memorable is best</li>
                            <li>Use lowercase letters, numbers and dashes</li>
                            <li>Must start with a letter and can't end in a dash</li>"
                        />
                    </ul>
                    <button
                        type='submit'
                        id='finish-button'
                        className='btn btn-primary margin--extra'
                        onClick={this.submitNext}
                    >
                        <FormattedMessage
                            id='create_team_password.finish'
                            defaultMessage='Finish'
                        />
                    </button>
                    <div className='margin--extra'>
                        <a
                            href='#'
                            onClick={this.submitBack}
                        >
                            <FormattedMessage
                                id='create_team_url.back'
                                defaultMessage='Back to previous step'
                            />
                        </a>
                    </div>
                </form>
            </div>
        );
    }
}

TeamUrl.propTypes = {
    intl: intlShape.isRequired,
    state: React.PropTypes.object,
    updateParent: React.PropTypes.func
};

export default injectIntl(TeamUrl);
