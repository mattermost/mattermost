// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');
var constants = require('../utils/constants.jsx');

module.exports = React.createClass({
    displayName: 'TeamSignupURLPage',
    propTypes: {
        state: React.PropTypes.object,
        updateParent: React.PropTypes.func
    },
    submitBack: function(e) {
        e.preventDefault();
        this.props.state.wizard = 'team_display_name';
        this.props.updateParent(this.props.state);
    },
    submitNext: function(e) {
        e.preventDefault();

        var name = this.refs.name.getDOMNode().value.trim();
        if (!name) {
            this.setState({nameError: 'This field is required'});
            return;
        }

        var cleanedName = utils.cleanUpUrlable(name);

        var urlRegex = /^[a-z]+([a-z\-0-9]+|(__)?)[a-z0-9]+$/g;
        if (cleanedName !== name || !urlRegex.test(name)) {
            this.setState({nameError: "Use only lower case letters, numbers and dashes. Must start with a letter and can't end in a dash."});
            return;
        } else if (cleanedName.length <= 3 || cleanedName.length > 15) {
            this.setState({nameError: 'Name must be 4 or more characters up to a maximum of 15'});
            return;
        }

        for (var index = 0; index < constants.RESERVED_TEAM_NAMES.length; index++) {
            if (cleanedName.indexOf(constants.RESERVED_TEAM_NAMES[index]) === 0) {
                this.setState({nameError: 'This team name is unavailable'});
                return;
            }
        }

        client.findTeamByName(name,
            function success(data) {
                if (!data) {
                    if (config.AllowSignupDomainsWizard) {
                        this.props.state.wizard = 'allowed_domains';
                    } else {
                        this.props.state.wizard = 'send_invites';
                        this.props.state.team.type = 'O';
                    }

                    this.props.state.team.name = name;
                    this.props.updateParent(this.props.state);
                } else {
                    this.state.nameError = 'This URL is unavailable. Please try another.';
                    this.setState(this.state);
                }
            }.bind(this),
            function error(err) {
                this.state.nameError = err.message;
                this.setState(this.state);
            }.bind(this)
        );
    },
    getInitialState: function() {
        return {};
    },
    handleFocus: function(e) {
        e.preventDefault();

        e.currentTarget.select();
    },
    render: function() {
        $('body').tooltip({selector: '[data-toggle=tooltip]', trigger: 'hover click'});

        client.track('signup', 'signup_team_03_url');

        var nameError = null;
        var nameDivClass = 'form-group';
        if (this.state.nameError) {
            nameError = <label className='control-label'>{this.state.nameError}</label>;
            nameDivClass += ' has-error';
        }

        return (
            <div>
                <form>
                    <img className='signup-team-logo' src='/static/images/logo.png' />
                    <h2>{utils.toTitleCase(strings.Team) + ' URL'}</h2>
                    <div className={nameDivClass}>
                        <div className='row'>
                            <div className='col-sm-11'>
                                <div className='input-group input-group--limit'>
                                    <span data-toggle='tooltip' title={utils.getWindowLocationOrigin() + '/'} className='input-group-addon'>{utils.getWindowLocationOrigin() + '/'}</span>
                                    <input type='text' ref='name' className='form-control' placeholder='' maxLength='128' defaultValue={this.props.state.team.name} autoFocus={true} onFocus={this.handleFocus}/>
                                </div>
                            </div>
                        </div>
                        {nameError}
                    </div>
                    <p>{'Choose the web address of your new ' + strings.Team + ':'}</p>
                    <ul className='color--light'>
                        <li>Short and memorable is best</li>
                        <li>Use lowercase letters, numbers and dashes</li>
                        <li>Must start with a letter and can't end in a dash</li>
                    </ul>
                    <button type='submit' className='btn btn-primary margin--extra' onClick={this.submitNext}>Next<i className='glyphicon glyphicon-chevron-right'></i></button>
                    <div className='margin--extra'>
                        <a href='#' onClick={this.submitBack}>Back to previous step</a>
                    </div>
                </form>
            </div>
        );
    }
});
