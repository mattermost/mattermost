// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.


var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');
var UserStore = require('../stores/user_store.jsx');
var constants = require('../utils/constants.jsx')

WelcomePage = React.createClass({
    submitNext: function (e) {
        e.preventDefault();
        this.props.state.wizard = "team_name";
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
    render: function() {

        client.track('signup', 'signup_team_01_welcome');

        var email_error = this.state.email_error ? <label className="control-label">{ this.state.email_error }</label> : null;
        var server_error = this.state.server_error ? <div className={ "form-group has-error" }><label className="control-label">{ this.state.server_error }</label></div> : null;

        return (
            <div>
                <p>
                    <img className="signup-team-logo" src="/static/images/logo.png" />
                    <h2>Welcome!</h2>
                    <h3>{"Let's set up your " + strings.Team + " on " + config.SiteName + "."}</h3>
                </p>
                <p>
                    Please confirm your email address:<br />
                    <span className="black">{ this.props.state.team.email }</span><br />
                </p>
                <div className="form-group">
                    <button className="btn-primary btn form-group" onClick={this.submitNext}><i className="glyphicon glyphicon-ok"></i>Yes, this address is correct</button>
                </div>
                <hr />
                <p>If this is not correct, you can switch to a different email. We'll send you a new invite right away.</p>
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
                    <button className="btn btn-md btn-primary" onClick={this.handleDiffSubmit} type="submit">Use this instead</button>
                </div>
                <button onClick={this.handleDiffEmail} className={ this.state.use_diff ? "btn-default btn hidden" : "btn-default btn" }>Use a different address</button>
            </div>
        );
    }
});

TeamNamePage = React.createClass({
    submitBack: function (e) {
        e.preventDefault();
        this.props.state.wizard = "welcome";
        this.props.updateParent(this.props.state);
    },
    submitNext: function (e) {
        e.preventDefault();

        var name = this.refs.name.getDOMNode().value.trim();
        if (!name) {
            this.setState({name_error: "This field is required"});
            return;
        }

        this.props.state.wizard = "team_url";
        this.props.state.team.name = name;
        this.props.updateParent(this.props.state);
    },
    getInitialState: function() {
        return {  };
    },
    render: function() {

        client.track('signup', 'signup_team_02_name');

        var name_error = this.state.name_error ? <label className="control-label">{ this.state.name_error }</label> : null;

        return (
            <div>
                <img className="signup-team-logo" src="/static/images/logo.png" />

                <h2>{utils.toTitleCase(strings.Team) + " Name"}</h2>
                <div className={ name_error ? "form-group has-error" : "form-group" }>
                <div className="row">
                    <div className="col-sm-9">
                        <input type="text" ref="name" className="form-control" placeholder="" maxLength="128" defaultValue={this.props.state.team.name} />
                    </div>
                </div>
                { name_error }
                </div>
                <p>{"Your " + strings.Team + " name shows in menus and headings. It may include the name of your " + strings.Company + ", but it's not required."}</p>
                <button className="btn btn-default" onClick={this.submitBack}><i className="glyphicon glyphicon-chevron-left"></i> Back</button>&nbsp;
                <button className="btn-primary btn" onClick={this.submitNext}>Next<i className="glyphicon glyphicon-chevron-right"></i></button>
            </div>
        );
    }
});

TeamUrlPage = React.createClass({
    submitBack: function (e) {
        e.preventDefault();
        this.props.state.wizard = "team_name";
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
        if (cleaned_name != name) {
            this.setState({name_error: "Must be lowercase alphanumeric characters"});
            return;
        }
        else if (cleaned_name.length <= 3 || cleaned_name.length > 15) {
            this.setState({name_error: "Domain must be 4 or more characters up to a maximum of 15"})
            return;
        }

        for (var index = 0; index < constants.RESERVED_DOMAINS.length; index++) {
            if (cleaned_name.indexOf(constants.RESERVED_DOMAINS[index]) == 0) {
                this.setState({name_error: "This Team URL name is unavailable"})
                return;
            }
        }

        client.findTeamByDomain(name,
            function(data) {
                if (!data) {
                    if (config.AllowSignupDomainsWizard) {
                        this.props.state.wizard = "allowed_domains";
                    } else {
                        this.props.state.wizard = "send_invites";
                        this.props.state.team.type = 'O';
                    }

                    this.props.state.team.domain = name;
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
    render: function() {

        client.track('signup', 'signup_team_03_url');

        var name_error = this.state.name_error ? <label className="control-label">{ this.state.name_error }</label> : null;

        return (
            <div>
                <img className="signup-team-logo" src="/static/images/logo.png" />
                <h2>{utils.toTitleCase(strings.Team) + " URL"}</h2>
                <div className={ name_error ? "form-group has-error" : "form-group" }>
               <div className="row">
                    <div className="col-sm-9">
                        <div className="input-group">
                            <input type="text" ref="name" className="form-control text-right" placeholder="" maxLength="128" defaultValue={this.props.state.team.domain} />
                            <span className="input-group-addon">.{ utils.getDomainWithOutSub() }</span>
                        </div>
                    </div>
                </div>
                { name_error }
                </div>
                <p className="black">{"Pick something short and memorable for your " + strings.Team + "'s web address."}</p>
                <p>{"Your " + strings.Team + " URL can only contain lowercase letters, numbers and dashes. Also, it needs to start with a letter and cannot end in a dash."}</p>
                <button className="btn btn-default" onClick={this.submitBack}><i className="glyphicon glyphicon-chevron-left"></i> Back</button>&nbsp;
                <button className="btn-primary btn" onClick={this.submitNext}>Next<i className="glyphicon glyphicon-chevron-right"></i></button>
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
                            <input type="text" ref="name" className="form-control" placeholder="" maxLength="128" defaultValue={this.props.state.team.allowed_domains} />
                        </div>
                    </div>
                </div>
                { name_error }
                </div>
                <p>To allow signups from multiple domains, separate each with a comma.</p>
                <p>
                <div className="checkbox"><label><input type="checkbox" ref="open_network" defaultChecked={this.props.state.team.type == 'O'} /> Allow anyone to signup to this domain without an invitation.</label></div>
                </p>
                <button className="btn btn-default" onClick={this.submitBack}><i className="glyphicon glyphicon-chevron-left"></i> Back</button>&nbsp;
                <button className="btn-primary btn" onClick={this.submitNext}>Next<i className="glyphicon glyphicon-chevron-right"></i></button>
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
            this.state.email_error = "Please use an a different email than the one used at signup";
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
                <input type="email" ref="email" className="form-control" placeholder="Email Address" defaultValue={this.props.email} maxLength="128" />
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
            emails.push(<EmailItem key={i} ref={'email_' + i} email={this.props.state.invites[i]} />);
        }

        return (
            <div>
                <img className="signup-team-logo" src="/static/images/logo.png" />
                <h2>Send Invitations</h2>
                { emails }
                <div className="form-group"><button className="btn-default btn" onClick={this.submitAddInvite}>Add Invitation</button></div>
                <div className="form btn-default-group"><button className="btn btn-default" onClick={this.submitBack}><i className="glyphicon glyphicon-chevron-left"></i> Back</button>&nbsp;<button className="btn-primary btn" onClick={this.submitNext}>Next<i className="glyphicon glyphicon-chevron-right"></i></button></div>
                <p>{"If you'd prefer, you can send invitations after you finish setting up the "+ strings.Team + "."}</p>
                <div><a href="#" onClick={this.submitSkip}>Skip this step</a></div>
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
                <img className="signup-team-logo" src="/static/images/logo.png" />
                <h2>Choose a username</h2>
                <div className={ name_error ? "form-group has-error" : "form-group" }>
                <div className="row">
                    <div className="col-sm-9">
                        <input type="text" ref="name" className="form-control" placeholder="" defaultValue={this.props.state.user.username} maxLength="128" />
                    </div>
                </div>
                { name_error }
                </div>
                <p>{"Pick something " + strings.Team + "mates will recognize. Your username is how you will appear to others."}</p>
                <p>It can be made of lowercase letters and numbers.</p>
                <button className="btn btn-default" onClick={this.submitBack}><i className="glyphicon glyphicon-chevron-left"></i> Back</button>&nbsp;
                <button className="btn-primary btn" onClick={this.submitNext}>Next<i className="glyphicon glyphicon-chevron-right"></i></button>
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
            this.setState({name_error: "Please enter at least 5 characters"});
            return;
        }

        $('#finish-button').button('loading');
        var teamSignup = JSON.parse(JSON.stringify(this.props.state));
        teamSignup.user.password = password;
        teamSignup.user.allow_marketing = this.refs.email_service.getDOMNode().checked;
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

                    if (utils.isTestDomain()) {
                        UserStore.setLastDomain(teamSignup.team.domain);
                        UserStore.setLastEmail(teamSignup.team.email);
                        window.location.href = window.location.protocol  + '//' + utils.getDomainWithOutSub() + '/login?email=' + encodeURIComponent(teamSignup.team.email);
                    }
                    else {
                        window.location.href = window.location.protocol + '//' + teamSignup.team.domain + '.' + utils.getDomainWithOutSub() + '/login?email=' + encodeURIComponent(teamSignup.team.email);
                    }

                    // client.loginByEmail(teamSignup.team.domain, teamSignup.team.email, teamSignup.user.password,
                    //     function(data) {
                    //         UserStore.setLastDomain(teamSignup.team.domain);
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
                this.setState({name_error: err.message});
                $('#sign-up-button').button('reset');
            }.bind(this)
        );
    },
    getInitialState: function() {
        return {  };
    },
    render: function() {

        client.track('signup', 'signup_team_07_password');

        var name_error = this.state.name_error ? <label className="control-label">{ this.state.name_error }</label> : null;

        return (
            <div>
                <img className="signup-team-logo" src="/static/images/logo.png" />
                <h2>Choose a password</h2>
                <p>You'll use your email address ({this.props.state.team.email}) and password to log into {config.SiteName}.</p>
                <div className={ name_error ? "form-group has-error" : "form-group" }>
                <div className="row">
                    <div className="col-sm-9">
                        <input type="password" ref="password" className="form-control" placeholder="" maxLength="128" />
                    </div>
                </div>
                    { name_error }
                </div>
                <div className="form-group checkbox">
                    <label><input type="checkbox" ref="email_service" /> It's ok to send me occassional email with updates about the {config.SiteName} service.</label>
                </div>
                <div className="form-group">
                    <button className="btn btn-default" onClick={this.submitBack}><i className="glyphicon glyphicon-chevron-left"></i> Back</button>&nbsp;
                    <button className="btn-primary btn" id="finish-button" data-loading-text={"<span class='glyphicon glyphicon-refresh glyphicon-refresh-animate'></span> Creating "+strings.Team+"..."} onClick={this.submitNext}>Finish</button>
                </div>
                <p>By proceeding to create your account and use { config.SiteName }, you agree to our <a href={ config.TermsLink }>Terms of Service</a> and <a href={ config.PrivacyLink }>Privacy Policy</a>. If you do not agree, you cannot use {config.SiteName}.</p>
            </div>
        );
    }
});

module.exports = React.createClass({
    updateParent: function(state, skipSet) {
        localStorage.setItem(this.props.hash, JSON.stringify(state));

        if (!skipSet) {
            this.setState(state);
        }
    },
    getInitialState: function() {
        var props = null;
        try {
            props = JSON.parse(localStorage.getItem(this.props.hash));
        }
        catch(parse_error) {
        }

        if (!props) {
            props = {};
            props.wizard = "welcome";
            props.team = {};
            props.team.email = this.props.email;
            props.team.name = this.props.name;
            props.team.company_name = this.props.name;
            props.team.domain = utils.cleanUpUrlable(this.props.name);
            props.team.allowed_domains = "";
            props.invites = [];
            props.invites.push("");
            props.invites.push("");
            props.invites.push("");
            props.user = {};
            props.hash = this.props.hash;
            props.data = this.props.data;
        }

        return props ;
    },
    render: function() {
        if (this.state.wizard == "welcome") {
            return <WelcomePage state={this.state} updateParent={this.updateParent} />
        }

        if (this.state.wizard == "team_name") {
            return <TeamNamePage state={this.state} updateParent={this.updateParent} />
        }

        if (this.state.wizard == "team_url") {
            return <TeamUrlPage state={this.state} updateParent={this.updateParent} />
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


