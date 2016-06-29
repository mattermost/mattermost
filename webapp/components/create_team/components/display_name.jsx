// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {track} from 'actions/analytics_actions.jsx';

import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';

import logoImage from 'images/logo.png';

import React from 'react';
import ReactDOM from 'react-dom';
import {Link} from 'react-router/es6';
import {FormattedMessage} from 'react-intl';

export default class TeamSignupDisplayNamePage extends React.Component {
    constructor(props) {
        super(props);

        this.submitNext = this.submitNext.bind(this);

        this.state = {};
    }

    submitNext(e) {
        e.preventDefault();

        var displayName = ReactDOM.findDOMNode(this.refs.name).value.trim();
        if (!displayName) {
            this.setState({nameError: Utils.localizeMessage('create_team.display_name.required', 'This field is required')});
            return;
        } else if (displayName.length < Constants.MIN_TEAMNAME_LENGTH || displayName.length > Constants.MAX_TEAMNAME_LENGTH) {
            this.setState({nameError: Utils.localizeMessage('create_team.display_name.charLength', 'Name must be 4 or more characters up to a maximum of 15')});
            return;
        }

        this.props.state.wizard = 'team_url';
        this.props.state.team.display_name = displayName;
        this.props.state.team.name = Utils.cleanUpUrlable(displayName);
        this.props.updateParent(this.props.state);
    }

    handleFocus(e) {
        e.preventDefault();
        e.currentTarget.select();
    }

    render() {
        track('signup', 'signup_team_02_name');

        var nameError = null;
        var nameDivClass = 'form-group';
        if (this.state.nameError) {
            nameError = <label className='control-label'>{this.state.nameError}</label>;
            nameDivClass += ' has-error';
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
                            id='create_team.display_name.teamName'
                            defaultMessage='Team Name'
                        />
                    </h2>
                    <div className={nameDivClass}>
                        <div className='row'>
                            <div className='col-sm-9'>
                                <input
                                    type='text'
                                    ref='name'
                                    className='form-control'
                                    placeholder=''
                                    maxLength='128'
                                    defaultValue={this.props.state.team.display_name}
                                    autoFocus={true}
                                    onFocus={this.handleFocus}
                                    spellCheck='false'
                                />
                            </div>
                        </div>
                        {nameError}
                    </div>
                    <div>
                        <FormattedMessage
                            id='create_team.display_name.nameHelp'
                            defaultMessage='Name your team in any language. Your team name shows in menus and headings.'
                        />
                    </div>
                    <button
                        type='submit'
                        className='btn btn-primary margin--extra'
                        onClick={this.submitNext}
                    >
                        <FormattedMessage
                            id='create_team.display_name.next'
                            defaultMessage='Next'
                        /><i className='fa fa-chevron-right'></i>
                    </button>
                    <div className='margin--extra'>
                        <Link to='/select_team'>
                            <FormattedMessage
                                id='create_team.display_name.back'
                                defaultMessage='Back to previous step'
                            />
                        </Link>
                    </div>
                </form>
            </div>
        );
    }
}

TeamSignupDisplayNamePage.propTypes = {
    state: React.PropTypes.object,
    updateParent: React.PropTypes.func
};
