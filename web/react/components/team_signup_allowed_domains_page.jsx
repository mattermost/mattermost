// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../utils/client.jsx');

export default class TeamSignupAllowedDomainsPage extends React.Component {
    constructor(props) {
        super(props);

        this.submitBack = this.submitBack.bind(this);
        this.submitNext = this.submitNext.bind(this);

        this.state = {};
    }
    submitBack(e) {
        e.preventDefault();
        this.props.state.wizard = 'team_url';
        this.props.updateParent(this.props.state);
    }
    submitNext(e) {
        e.preventDefault();

        if (React.findDOMNode(this.refs.open_network).checked) {
            this.props.state.wizard = 'send_invites';
            this.props.state.team.type = 'O';
            this.props.updateParent(this.props.state);
            return;
        }

        if (React.findDOMNode(this.refs.allow).checked) {
            var name = React.findDOMNode(this.refs.name).value.trim();
            var domainRegex = /^\w+\.\w+$/;
            if (!name) {
                this.setState({nameError: 'This field is required'});
                return;
            }

            if (!name.trim().match(domainRegex)) {
                this.setState({nameError: 'The domain doesn\'t appear valid'});
                return;
            }

            this.props.state.wizard = 'send_invites';
            this.props.state.team.allowed_domains = name;
            this.props.state.team.type = 'I';
            this.props.updateParent(this.props.state);
        } else {
            this.props.state.wizard = 'send_invites';
            this.props.state.team.type = 'I';
            this.props.updateParent(this.props.state);
        }
    }
    render() {
        Client.track('signup', 'signup_team_04_allow_domains');

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
                        src='/static/images/logo.png'
                    />
                    <h2>Email Domain</h2>
                    <p>
                        <div className='checkbox'>
                            <label>
                                <input
                                    type='checkbox'
                                    ref='allow'
                                    defaultChecked={true}
                                />
                                {' Allow sign up and ' + strings.Team + ' discovery with a ' + strings.Company + ' email address.'}
                            </label>
                        </div>
                    </p>
                    <p>{'Check this box to allow your ' + strings.Team + ' members to sign up using their ' + strings.Company + ' email addresses if you share the same domain--otherwise, you need to invite everyone yourself.'}</p>
                    <h4>{'Your ' + strings.Team + '\'s domain for emails'}</h4>
                    <div className={nameDivClass}>
                        <div className='row'>
                            <div className='col-sm-9'>
                                <div className='input-group'>
                                    <span className='input-group-addon'>@</span>
                                    <input
                                        type='text'
                                        ref='name'
                                        className='form-control'
                                        placeholder=''
                                        maxLength='128'
                                        defaultValue={this.props.state.team.allowed_domains}
                                        autoFocus={true}
                                        onFocus={this.handleFocus}
                                    />
                                </div>
                            </div>
                        </div>
                        {nameError}
                    </div>
                    <p>To allow signups from multiple domains, separate each with a comma.</p>
                    <p>
                        <div className='checkbox'>
                            <label>
                                <input
                                    type='checkbox'
                                    ref='open_network'
                                    defaultChecked={this.props.state.team.type === 'O'}
                                /> Allow anyone to signup to this domain without an invitation.</label>
                        </div>
                    </p>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={this.submitBack}
                    >
                        <i className='glyphicon glyphicon-chevron-left'></i> Back
                    </button>&nbsp;
                    <button
                        type='submit'
                        className='btn-primary btn'
                        onClick={this.submitNext}
                    >
                        Next<i className='glyphicon glyphicon-chevron-right'></i>
                    </button>
                </form>
            </div>
        );
    }
}

TeamSignupAllowedDomainsPage.defaultProps = {
    state: {}
};
TeamSignupAllowedDomainsPage.propTypes = {
    state: React.PropTypes.object,
    updateParent: React.PropTypes.func
};
