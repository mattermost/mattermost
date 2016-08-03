// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from 'utils/utils.jsx';

import {checkIfTeamExists, createTeam} from 'actions/team_actions.jsx';
import {track} from 'actions/analytics_actions.jsx';
import Constants from 'utils/constants.jsx';

import logoImage from 'images/logo.png';

import React from 'react';
import ReactDOM from 'react-dom';
import {Button, Tooltip, OverlayTrigger} from 'react-bootstrap';
import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';

export default class TeamUrl extends React.Component {
    constructor(props) {
        super(props);

        this.submitBack = this.submitBack.bind(this);
        this.submitNext = this.submitNext.bind(this);
        this.handleFocus = this.handleFocus.bind(this);

        this.state = {
            nameError: '',
            isLoading: false
        };
    }
    submitBack(e) {
        e.preventDefault();
        this.props.state.wizard = 'display_name';
        this.props.updateParent(this.props.state);
    }
    submitNext(e) {
        e.preventDefault();

        const name = ReactDOM.findDOMNode(this.refs.name).value.trim();
        if (!name) {
            this.setState({nameError: Utils.localizeMessage('create_team.team_url.required', 'This field is required')});
            return;
        }

        const cleanedName = Utils.cleanUpUrlable(name);

        const urlRegex = /^[a-z]+([a-z\-0-9]+|(__)?)[a-z0-9]+$/g;
        if (cleanedName !== name || !urlRegex.test(name)) {
            this.setState({nameError: Utils.localizeMessage('create_team.team_url.regex', "Use only lower case letters, numbers and dashes. Must start with a letter and can't end in a dash.")});
            return;
        } else if (cleanedName.length < Constants.MIN_TEAMNAME_LENGTH || cleanedName.length > Constants.MAX_TEAMNAME_LENGTH) {
            this.setState({nameError: Utils.localizeMessage('create_team.team_url.charLength', 'Name must be 4 or more characters up to a maximum of 15')});
            return;
        }

        if (global.window.mm_config.RestrictTeamNames === 'true') {
            for (let index = 0; index < Constants.RESERVED_TEAM_NAMES.length; index++) {
                if (cleanedName.indexOf(Constants.RESERVED_TEAM_NAMES[index]) === 0) {
                    this.setState({nameError: Utils.localizeMessage('create_team.team_url.taken', 'URL is taken or contains a reserved word')});
                    return;
                }
            }
        }

        this.setState({isLoading: true});
        var teamSignup = JSON.parse(JSON.stringify(this.props.state));
        teamSignup.team.type = 'O';
        teamSignup.team.name = name;

        checkIfTeamExists(name,
            (foundTeam) => {
                if (foundTeam) {
                    this.setState({nameError: Utils.localizeMessage('create_team.team_url.unavailable', 'This URL is unavailable. Please try another.')});
                    this.setState({isLoading: false});
                    return;
                }

                createTeam(teamSignup.team,
                    () => {
                        track('signup', 'signup_team_08_complete');
                    },
                    (err) => {
                        this.setState({nameError: err.message});
                        this.setState({isLoading: false});
                    }
                );
            },
            (err) => {
                this.setState({nameError: err.message});
            }
        );
    }

    handleFocus(e) {
        e.preventDefault();
        e.currentTarget.select();
    }

    render() {
        track('signup', 'signup_team_03_url');

        let nameError = null;
        let nameDivClass = 'form-group';
        if (this.state.nameError) {
            nameError = <label className='control-label'>{this.state.nameError}</label>;
            nameDivClass += ' has-error';
        }

        const title = `${window.mm_config.SiteURL}/`;
        const urlTooltip = (
            <Tooltip id='urlTooltip'>{title}</Tooltip>
        );

        let finishMessage = (
            <FormattedMessage
                id='create_team.team_url.finish'
                defaultMessage='Finish'
            />
        );

        if (this.state.isLoading) {
            finishMessage = (
                <FormattedMessage
                    id='create_team.team_url.creatingTeam'
                    defaultMessage='Creating team...'
                />
            );
        }

        return (
            <div>
                <form>
                    <img
                        className='signup-team-logo'
                        src={logoImage}
                    />
                    <h2>
                        <FormattedMessage
                            id='create_team.team_url.teamUrl'
                            defaultMessage='Team URL'
                        />
                    </h2>
                    <div className={nameDivClass}>
                        <div className='row'>
                            <div className='col-sm-11'>
                                <div className='input-group input-group--limit'>
                                    <OverlayTrigger
                                        delayShow={Constants.OVERLAY_TIME_DELAY}
                                        placement='top'
                                        overlay={urlTooltip}
                                    >
                                        <span className='input-group-addon'>
                                            {title}
                                        </span>
                                    </OverlayTrigger>
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
                            id='create_team.team_url.webAddress'
                            defaultMessage='Choose the web address of your new team:'
                        />
                    </p>
                    <ul className='color--light'>
                        <FormattedHTMLMessage
                            id='create_team.team_url.hint'
                            defaultMessage="<li>Short and memorable is best</li>
                            <li>Use lowercase letters, numbers and dashes</li>
                            <li>Must start with a letter and can't end in a dash</li>"
                        />
                    </ul>
                    <div className='margin--extra'>
                        <Button
                            type='submit'
                            bsStyle='primary'
                            disabled={this.state.isLoading}
                            onClick={this.submitNext}
                        >
                            {finishMessage}
                        </Button>
                    </div>
                    <div className='margin--extra'>
                        <a
                            href='#'
                            onClick={this.submitBack}
                        >
                            <FormattedMessage
                                id='create_team.team_url.back'
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
    state: React.PropTypes.object,
    updateParent: React.PropTypes.func
};
