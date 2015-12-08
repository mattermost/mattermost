// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as utils from '../utils/utils.jsx';
import * as client from '../utils/client.jsx';
import Constants from '../utils/constants.jsx';

export default class SSOSignUpPage extends React.Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);
        this.nameChange = this.nameChange.bind(this);

        this.state = {name: ''};
    }
    handleSubmit(e) {
        e.preventDefault();
        var team = {};
        var state = this.state;
        state.nameError = null;
        state.serverError = null;

        team.display_name = this.state.name;

        if (!team.display_name) {
            state.nameError = 'Please enter a team name';
            this.setState(state);
            return;
        }

        if (team.display_name.length <= 2) {
            state.nameError = 'Name must be 3 or more characters up to a maximum of 15';
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
                    window.location.href = '/' + team.name + '/channels/town-square';
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
                    onClick={this.handleSubmit}
                    disabled={disabled}
                >
                    <span className='icon'/>
                    <span>{'Create team with GitLab Account'}</span>
                </a>
            );
        } else if (this.props.service === Constants.GOOGLE_SERVICE) {
            button = (
                <a
                    className='btn btn-custom-login google btn-full'
                    href='#'
                    onClick={this.handleSubmit}
                    disabled={disabled}
                >
                    <span className='icon'/>
                    <span>{'Create team with Google Apps Account'}</span>
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
                        placeholder='Enter name of new team'
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
                    <span><a href='/find_team'>{'Find my teams'}</a></span>
                </div>
            </form>
        );
    }
}

SSOSignUpPage.defaultProps = {
    service: ''
};
SSOSignUpPage.propTypes = {
    service: React.PropTypes.string
};
