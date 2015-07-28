// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.


var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');
var UserStore = require('../stores/user_store.jsx');
var BrowserStore = require('../stores/browser_store.jsx');
var constants = require('../utils/constants.jsx');

WelcomePage = React.createClass({
    submitNext: function (e) {
        if (!BrowserStore.isLocalStorageSupported()) {
            this.setState({ storage_error: "This service requires local storage to be enabled. Please enable it or exit private browsing."} );
            return;
        }
        e.preventDefault();
        this.props.state.wizard = "team_display_name";
        this.props.updateParent(this.props.state);
    },
    handleDiffEmail: function (e) {
        e.preventDefault();
        this.setState({ use_diff: true });
    },
    handleDiffSubmit: function (e) {
        e.preventDefault();

        var state = { use_diff: true, server_error: "" };

        var email = this.refs.email.getDOMNode().value.trim().toLowerCase();
        if (!email || !utils.isEmail(email)) {
            state.email_error = "Please enter a valid email address";
            this.setState(state);
            return;
        }
        else if (!BrowserStore.isLocalStorageSupported()) {
            state.email_error = "This service requires local storage to be enabled. Please enable it or exit private browsing.";
            this.setState(state);
            return;
        }
        else {
            state.email_error = "";
        }

        client.signupTeam(email, this.props.state.team.name,
            function(data) {
                this.props.state.wizard = "finished";
                this.props.updateParent(this.props.state);
                window.location.href = "/signup_team_confirm/?email=" + encodeURI(email);
            }.bind(this),
            function(err) {
                this.state.server_error = err.message;
                this.setState(this.state);
            }.bind(this)
        );
    },
    getInitialState: function() {
        return { use_diff: false };
    },
    handleKeyPress: function(event) {
        if (event.keyCode == 13) {
            this.submitNext(event);
        }
    },
    componentWillMount: function() {
        document.addEventListener("keyup", this.handleKeyPress, false);
    },
    componentWillUnmount: function() {
        document.removeEventListener("keyup", this.handleKeyPress, false);
    },
    render: function() {

        client.track('signup', 'signup_team_01_welcome');

        var storage_error = this.state.storage_error ? <label className="control-label">{ this.state.storage_error }</label> : null;
        var email_error = this.state.email_error ? <label className="control-label">{ this.state.email_error }</label> : null;
        var server_error = this.state.server_error ? <div className={ "form-group has-error" }><label className="control-label">{ this.state.server_error }</label></div> : null;

        return (
            <div>
                <p>
                    <img className="signup-team-logo" src="/static/images/logo.png" />
                    <h3 className="sub-heading">Welcome to:</h3>
                    <h1 className="margin--top-none">{config.SiteName}</h1>
                </p>
                <p className="margin--less">Let's setup your new team</p>
                <p>
                    Please confirm your email address:<br />
                    <div className="inner__content">
                        <div className="block--gray">{ this.props.state.team.email }</div>
                    </div>
                </p>
                <p className="margin--extra color--light">
                    Your account will administer the new team site. <br />
                    You can add other administrators later.
                </p>
                <div className="form-group">
                    <button className="btn-primary btn form-group" type="submit" onClick={this.submitNext}><i className="glyphicon glyphicon-ok"></i>Yes, this address is correct</button>
                    { storage_error }
                </div>
                <hr />
                <div className={ this.state.use_diff ? "" : "hidden" }>
                    <div className={ email_error ? "form-group has-error" : "form-group" }>
                        <div className="row">
                            <div className="col-sm-9">
                                <input type="email" ref="email" className="form-control" placeholder="Email Address" maxLength="128" />
                            </div>
                        </div>
                        { email_error }
                    </div>
                    { server_error }
                    <button className="btn btn-md btn-primary" type="button" onClick={this.handleDiffSubmit} type="submit">Use this instead</button>
                </div>
                <a href="#" onClick={this.handleDiffEmail} className={ this.state.use_diff ? "hidden" : "" }>Use a different email</a>
            </div>
        );
    }
});

TeamDisplayNamePage = React.createClass({
    submitBack: function (e) {
        e.preventDefault();
        this.props.state.wizard = "welcome";
        this.props.updateParent(this.props.state);
    },
    submitNext: function (e) {
        e.preventDefault();

        var display_name = this.refs.name.getDOMNode().value.trim();
        if (!display_name) {
            this.setState({name_error: "This field is required"});
            return;
        }

        this.props.state.wizard = "team_url";
        this.props.state.team.display_name = display_name;
        this.props.state.team.name = utils.cleanUpUrlable(display_name);
        this.props.updateParent(this.props.state);
    },
    getInitialState: function() {
        return {  };
    },
    handleFocus: function(e) {
        e.preventDefault();

        e.currentTarget.select();
    },
    render: function() {

        client.track('signup', 'signup_team_02_name');

        var name_error = this.state.name_error ? <label className="control-label">{ this.state.name_error }</label> : null;

        return (
            <div>
                <form>
                <img className="signup-team-logo" src="/static/images/logo.png" />

                <h2>{utils.toTitleCase(strings.Team) + " Name"}</h2>
                <div className={ name_error ? "form-group has-error" : "form-group" }>
                <div className="row">
                    <div className="col-sm-9">
                        <input type="text" ref="name" className="form-control" placeholder="" maxLength="128" defaultValue={this.props.state.team.display_name} autoFocus={true} onFocus={this.handleFocus} />
                    </div>
                </div>
                { name_error }
                </div>
                <div>{"Name your " + strings.Team + " in any language. Your " + strings.Team + " name shows in menus and headings."}</div>
                <button type="submit" className="btn btn-primary margin--extra" onClick={this.submitNext}>Next<i className="glyphicon glyphicon-chevron-right"></i></button>
                <div className="margin--extra">
                    <a href="#" onClick={this.submitBack}>Back to previous step</a>
                </div>
            </form>
            </div>
        );
    }
});

TeamURLPage = React.createClass({
    submitBack: function (e) {
        e.preventDefault();
        this.props.state.wizard = "team_display_name";
        this.props.updateParent(this.props.state);
    },
    submitNext: function (e) {
        e.preventDefault();

        var name = this.refs.name.getDOMNode().value.trim();
        if (!name) {
            this.setState({name_error: "This field is required"});
            return;
        }

        var cleaned_name = utils.cleanUpUrlable(name);

        var urlRegex = /^[a-z0-9]+([a-z\-0-9]+|(__)?)[a-z0-9]+$/g;
        if (cleaned_name != name || !urlRegex.test(name)) {
            this.setState({name_error: "Must be lowercase alphanumeric characters"});
            return;
        }
        else if (cleaned_name.length <= 3 || cleaned_name.length > 15) {
            this.setState({name_error: "Name must be 4 or more characters up to a maximum of 15"})
            return;
        }

        for (var index = 0; index < constants.RESERVED_TEAM_NAMES.length; index++) {
            if (cleaned_name.indexOf(constants.RESERVED_TEAM_NAMES[index]) == 0) {
                this.setState({name_error: "This team name is unavailable"})
                return;
            }
        }

        client.findTeamByName(name,
            function(data) {
                if (!data) {
                    if (config.AllowSignupDomainsWizard) {
                        this.props.state.wizard = "allowed_domains";
                    } else {
                        this.props.state.wizard = "send_invites";
                        this.props.state.team.type = 'O';
                    }

                    this.props.state.team.name = name;
                    this.props.updateParent(this.props.state);
                }
                else {
                    this.state.name_error = "This URL is unavailable. Please try another.";
                    this.setState(this.state);
                }
            }.bind(this),
            function(err) {
                this.state.name_error = err.message;
                this.setState(this.state);
            }.bind(this)
        );
    },
    getInitialState: function() {
        return { };
    },
    handleFocus: function(e) {
        e.preventDefault();

        e.currentTarget.select();
    },
    render: function() {

        client.track('signup', 'signup_team_03_url');

        var name_error = this.state.name_error ? <label className="control-label">{ this.state.name_error }</label> : null;

        return (
            <div>
                <form>
                <img className="signup-team-logo" src="/static/images/logo.png" />
                <h2>{utils.toTitleCase(strings.Team) + " URL"}</h2>
                <div className={ name_error ? "form-group has-error" : "form-group" }>
               <div className="row">
                    <div className="col-sm-11">
                        <div className="input-group">
                            <span className="input-group-addon">{ window.location.origin + "/" }</span>
                            <input type="text" ref="name" className="form-control" placeholder="" maxLength="128" defaultValue={this.props.state.team.name} autoFocus={true} onFocus={this.handleFocus}/>
                        </div>
                    </div>
                </div>
                { name_error }
                </div>
                <p>{"Choose the web address of your new " + strings.Team + ":"}</p>
                <ul className="color--light">
                    <li>Short and memorable is best</li>
                    <li>Use lower case letters, numbers and dashes</li>
                    <li>Must start with a letter and can't end in a dash</li>
                </ul>
                <button type="submit" className="btn btn-primary margin--extra" onClick={this.submitNext}>Next<i className="glyphicon glyphicon-chevron-right"></i></button>
                <div className="margin--extra">
                    <a href="#" onClick={this.submitBack}>Back to previous step</a>
                </div>
            </form>
            </div>
        );
    }
});

AllowedDomainsPage = React.createClass({
    submitBack: function (e) {
        e.preventDefault();
        this.props.state.wizard = "team_url";
        this.props.updateParent(this.props.state);
    },
    submitNext: function (e) {
        e.preventDefault();

        if (this.refs.open_network.getDOMNode().checked) {
            this.props.state.wizard = "send_invites";
            this.props.state.team.type = 'O';
            this.props.updateParent(this.props.state);
            return;
        }

        if (this.refs.allow.getDOMNode().checked) {
            var name = this.refs.name.getDOMNode().value.trim();
            var domainRegex = /^\w+\.\w+$/
            if (!name) {
                this.setState({name_error: "This field is required"});
                return;
            }

            if(!name.trim().match(domainRegex)) {
                this.setState({name_error: "The domain doesn't appear valid"});
                return;
            }

            this.props.state.wizard = "send_invites";
            this.props.state.team.allowed_domains = name;
            this.props.state.team.type = 'I';
            this.props.updateParent(this.props.state);
        }
        else {
            this.props.state.wizard = "send_invites";
            this.props.state.team.type = 'I';
            this.props.updateParent(this.props.state);
        }
    },
    getInitialState: function() {
        return { };
    },
    render: function() {

        client.track('signup', 'signup_team_04_allow_domains');

        var name_error = this.state.name_error ? <label className="control-label">{ this.state.name_error }</label> : null;

        return (
            <div>
                <form>
                <img className="signup-team-logo" src="/static/images/logo.png" />
                <h2>Email Domain</h2>
                <p>
                <div className="checkbox"><label><input type="checkbox" ref="allow" defaultChecked />{" Allow sign up and " + strings.Team + " discovery with a " + strings.Company + " email address."}</label></div>
                </p>
                <p>{"Check this box to allow your " + strings.Team + " members to sign up using their " + strings.Company + " email addresses if you share the same domain--otherwise, you need to invite everyone yourself."}</p>
                <h4>{"Your " + strings.Team + "'s domain for emails"}</h4>
                <div className={ name_error ? "form-group has-error" : "form-group" }>
                <div className="row">
                    <div className="col-sm-9">
                        <div className="input-group">
                            <span className="input-group-addon">@</span>
                            <input type="text" ref="name" className="form-control" placeholder="" maxLength="128" defaultValue={this.props.state.team.allowed_domains} autoFocus={true} onFocus={this.handleFocus}/>
                        </div>
                    </div>
                </div>
                { name_error }
                </div>
                <p>To allow signups from multiple domains, separate each with a comma.</p>
                <p>
                <div className="checkbox"><label><input type="checkbox" ref="open_network" defaultChecked={this.props.state.team.type == 'O'} /> Allow anyone to signup to this domain without an invitation.</label></div>
                </p>
                <button type="button" className="btn btn-default" onClick={this.submitBack}><i className="glyphicon glyphicon-chevron-left"></i> Back</button>&nbsp;
                <button type="submit" className="btn-primary btn" onClick={this.submitNext}>Next<i className="glyphicon glyphicon-chevron-right"></i></button>
            </form>
            </div>
        );
    }
});

EmailItem = React.createClass({
    getInitialState: function() {
        return { };
    },
    getValue: function() {
        return this.refs.email.getDOMNode().value.trim()
    },
    validate: function(teamEmail) {
        var email = this.refs.email.getDOMNode().value.trim().toLowerCase();

        if (!email) {
            return true;
        }

        if (!utils.isEmail(email)) {
            this.state.email_error = "Please enter a valid email address";
            this.setState(this.state);
            return false;
        }
        else if (email === teamEmail) {
            this.state.email_error = "Please use a different email than the one used at signup";
            this.setState(this.state);
            return false;
        }
        else {
            this.state.email_error = "";
            this.setState(this.state);
            return true;
        }
    },
    render: function() {

        var email_error = this.state.email_error ? <label className="control-label">{ this.state.email_error }</label> : null;

        return (
            <div className={ email_error ? "form-group has-error" : "form-group" }>
                <input autoFocus={this.props.focus} type="email" ref="email" className="form-control" placeholder="Email Address" defaultValue={this.props.email} maxLength="128" />
                { email_error }
            </div>
        );
    }
});


SendInivtesPage = React.createClass({
    submitBack: function (e) {
        e.preventDefault();

        if (config.AllowSignupDomainsWizard) {
            this.props.state.wizard = "allowed_domains";
        } else {
            this.props.state.wizard = "team_url";
        }

        this.props.updateParent(this.props.state);
    },
    submitNext: function (e) {
        e.preventDefault();

        var valid = true;
        var emails = [];

        for (var i = 0; i < this.props.state.invites.length; i++) {
            if (!this.refs['email_' + i].validate(this.props.state.team.email)) {
                valid = false;
            } else {
                emails.push(this.refs['email_' + i].getValue());
            }
        }

        if (!valid) {
            return;
        }

        this.props.state.wizard = "username";
        this.props.state.invites = emails;
        this.props.updateParent(this.props.state);
    },
    submitAddInvite: function (e) {
        e.preventDefault();
        this.props.state.wizard = "send_invites";
        if (this.props.state.invites == null || this.props.state.invites.length == 0) {
            this.props.state.invites = [];
        }
        this.props.state.invites.push("");
        this.props.updateParent(this.props.state);
    },
    submitSkip: function (e) {
        e.preventDefault();
        this.props.state.wizard = "username";
        this.props.updateParent(this.props.state);
    },
    getInitialState: function() {
        return { };
    },
    render: function() {

        client.track('signup', 'signup_team_05_send_invites');

        var name_error = this.state.name_error ? <label className="control-label">{ this.state.name_error }</label> : null;

        var emails = [];

        for (var i = 0; i < this.props.state.invites.length; i++) {
            if (i == 0) {
                emails.push(<EmailItem focus={true} key={i} ref={'email_' + i} email={this.props.state.invites[i]} />);
            } else {
                emails.push(<EmailItem focus={false} key={i} ref={'email_' + i} email={this.props.state.invites[i]} />);
            }
        }

        return (
            <div>
                <form>
                    <img className="signup-team-logo" src="/static/images/logo.png" />
                    <h2>Invite Team Members</h2>
                    { emails }
                    <div className="form-group text-right"><a href="#" onClick={this.submitAddInvite}>Add Invitation</a></div>
                    <div className="form-group"><button type="submit" className="btn-primary btn" onClick={this.submitNext}>Next<i className="glyphicon glyphicon-chevron-right"></i></button></div>
                </form>
                <p className="color--light">if you prefer, you can invite team members later<br /> and <a href="#" onClick={this.submitSkip}>skip this step</a> for now.</p>
                <div className="margin--extra">
                    <a href="#" onClick={this.submitBack}>Back to previous step</a>
                </div>
            </div>
        );
    }
});

UsernamePage = React.createClass({
    submitBack: function (e) {
        e.preventDefault();
        this.props.state.wizard = "send_invites";
        this.props.updateParent(this.props.state);
    },
    submitNext: function (e) {
        e.preventDefault();

        var name = this.refs.name.getDOMNode().value.trim();

        var username_error = utils.isValidUsername(name);
        if (username_error === "Cannot use a reserved word as a username.") {
            this.setState({name_error: "This username is reserved, please choose a new one." });
            return;
        } else if (username_error) {
            this.setState({name_error: "Username must begin with a letter, and contain between 3 to 15 lowercase characters made up of numbers, letters, and the symbols '.', '-' and '_'." });
            return;
        }


        this.props.state.wizard = "password";
        this.props.state.user.username = name;
        this.props.updateParent(this.props.state);
    },
    getInitialState: function() {
        return {  };
    },
    render: function() {

        client.track('signup', 'signup_team_06_username');

        var name_error = this.state.name_error ? <label className="control-label">{ this.state.name_error }</label> : null;

        return (
            <div>
                <form>
                <img className="signup-team-logo" src="/static/images/logo.png" />
                <h2 className="margin--less">Your username</h2>
                <h5 className="color--light">Select a memorable username that makes it easy for teammates to identify you:</h5>
                <div className="inner__content margin--extra">
                    <div className={ name_error ? "form-group has-error" : "form-group" }>
                    <div className="row">
                        <div className="col-sm-11">
                            <h5><strong>Choose your username</strong></h5>
                            <input autoFocus={true} type="text" ref="name" className="form-control" placeholder="" defaultValue={this.props.state.user.username} maxLength="128" />
                            <div className="color--light form__hint">Usernames must begin with a letter and contain 3 to 15 characters made up of lowercase letters, numbers, and the symbols '.', '-' and '_'</div>
                        </div>
                    </div>
                    { name_error }
                    </div>
                </div>
                <button type="submit" className="btn btn-primary margin--extra" onClick={this.submitNext}>Next<i className="glyphicon glyphicon-chevron-right"></i></button>
                <div className="margin--extra">
                    <a href="#" onClick={this.submitBack}>Back to previous step</a>
                </div>
            </form>
            </div>
        );
    }
});

PasswordPage = React.createClass({
    submitBack: function (e) {
        e.preventDefault();
        this.props.state.wizard = "username";
        this.props.updateParent(this.props.state);
    },
    submitNext: function (e) {
        e.preventDefault();

        var password = this.refs.password.getDOMNode().value.trim();
        if (!password || password.length < 5) {
            this.setState({password_error: "Please enter at least 5 characters"});
            return;
        }

        this.setState({password_error: null, server_error: null});
        $('#finish-button').button('loading');
        var teamSignup = JSON.parse(JSON.stringify(this.props.state));
        teamSignup.user.password = password;
        teamSignup.user.allow_marketing = true;
        delete teamSignup.wizard;
        var ctl = this;

        client.createTeamFromSignup(teamSignup,
            function(data) {

                client.track('signup', 'signup_team_08_complete');

                var props = this.props;

                setTimeout(function() {
                    $('#sign-up-button').button('reset');
                    props.state.wizard = "finished";
                    props.updateParent(props.state, true);

                    window.location.href = window.location.origin + '/' + props.state.team.name + '/login?email=' + encodeURIComponent(teamSignup.team.email);

                    // client.loginByEmail(teamSignup.team.domain, teamSignup.team.email, teamSignup.user.password,
                    //     function(data) {
                    //         TeamStore.setLastName(teamSignup.team.domain);
                    //         UserStore.setLastEmail(teamSignup.team.email);
                    //         UserStore.setCurrentUser(data);
                    //         window.location.href = '/channels/town-square';
                    //     }.bind(ctl),
                    //     function(err) {
                    //         this.setState({name_error: err.message});
                    //     }.bind(ctl)
                    // );
                }, 5000);
            }.bind(this),
            function(err) {
                this.setState({server_error: err.message});
                $('#sign-up-button').button('reset');
            }.bind(this)
        );
    },
    getInitialState: function() {
        return {  };
    },
    render: function() {

        client.track('signup', 'signup_team_07_password');

        var password_error = this.state.password_error ? <label className="control-label">{ this.state.password_error }</label> : null;
        var server_error = this.state.server_error ? <label className="control-label">{ this.state.server_error }</label> : null;

        return (
            <div>
                <form>
                <img className="signup-team-logo" src="/static/images/logo.png" />
                <h2 className="margin--less">Your password</h2>
                <h5 className="color--light">Select a password that you'll use to login with your email address:</h5>
                <div className="inner__content margin--extra">
                    <h5><strong>Email</strong></h5>
                    <div className="block--gray form-group">{this.props.state.team.email}</div>
                    <div className={ password_error ? "form-group has-error" : "form-group" }>
                    <div className="row">
                        <div className="col-sm-11">
                            <h5><strong>Choose your password</strong></h5>
                            <input autoFocus={true} type="password" ref="password" className="form-control" placeholder="" maxLength="128" />
                            <div className="color--light form__hint">Passwords must contain 5 to 50 characters. Your password will be strongest if it contains a mix of symbols, numbers, and upper and lowercase characters.</div>
                        </div>
                    </div>
                        { password_error }
                        { server_error }
                    </div>
                </div>
                <div className="form-group">
                    <button type="submit" className="btn btn-primary margin--extra" id="finish-button" data-loading-text={"<span class='glyphicon glyphicon-refresh glyphicon-refresh-animate'></span> Creating "+strings.Team+"..."} onClick={this.submitNext}>Finish</button>
                </div>
                <p>By proceeding to create your account and use { config.SiteName }, you agree to our <a href={ config.TermsLink }>Terms of Service</a> and <a href={ config.PrivacyLink }>Privacy Policy</a>. If you do not agree, you cannot use {config.SiteName}.</p>
                <div className="margin--extra">
                    <a href="#" onClick={this.submitBack}>Back to previous step</a>
                </div>
            </form>
            </div>
        );
    }
});

module.exports = React.createClass({
    updateParent: function(state, skipSet) {
        BrowserStore.setGlobalItem(this.props.hash, state);

        if (!skipSet) {
            this.setState(state);
        }
    },
    getInitialState: function() {
        var props = BrowserStore.getGlobalItem(this.props.hash);

        if (!props) {
            props = {};
            props.wizard = "welcome";
            props.team = {};
            props.team.email = this.props.email;
            props.team.allowed_domains = "";
            props.invites = [];
            props.invites.push("");
            props.invites.push("");
            props.invites.push("");
            props.user = {};
            props.hash = this.props.hash;
            props.data = this.props.data;
        }

        return props;
    },
    render: function() {
        if (this.state.wizard == "welcome") {
            return <WelcomePage state={this.state} updateParent={this.updateParent} />
        }

        if (this.state.wizard == "team_display_name") {
            return <TeamDisplayNamePage state={this.state} updateParent={this.updateParent} />
        }

        if (this.state.wizard == "team_url") {
            return <TeamURLPage state={this.state} updateParent={this.updateParent} />
        }

        if (this.state.wizard == "allowed_domains") {
            return <AllowedDomainsPage state={this.state} updateParent={this.updateParent} />
        }

        if (this.state.wizard == "send_invites") {
            return <SendInivtesPage state={this.state} updateParent={this.updateParent} />
        }

        if (this.state.wizard == "username") {
            return <UsernamePage state={this.state} updateParent={this.updateParent} />
        }

        if (this.state.wizard == "password") {
            return <PasswordPage state={this.state} updateParent={this.updateParent} />
        }

        return (<div>You've already completed the signup process for this invitation or this invitation has expired.</div>);
    }
});


