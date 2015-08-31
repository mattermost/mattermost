// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var Utils = require('../utils/utils.jsx');
var Client = require('../utils/client.jsx');

export default class TeamSignupUsernamePage extends React.Component {
    constructor(props) {
        super(props);

        this.submitBack = this.submitBack.bind(this);
        this.submitNext = this.submitNext.bind(this);

        this.state = {};
    }
    submitBack(e) {
        e.preventDefault();
        this.props.state.wizard = 'send_invites';
        this.props.updateParent(this.props.state);
    }
    submitNext(e) {
        e.preventDefault();

        var name = this.refs.name.getDOMNode().value.trim();

        var usernameError = Utils.isValidUsername(name);
        if (usernameError === 'Cannot use a reserved word as a username.') {
            this.setState({nameError: 'This username is reserved, please choose a new one.'});
            return;
        } else if (usernameError) {
            this.setState({nameError: 'Username must begin with a letter, and contain 3 to 15 characters in total, which may be numbers, lowercase letters, or any of the symbols \'.\', \'-\', or \'_\''});
            return;
        }

        this.props.state.wizard = 'password';
        this.props.state.user.username = name;
        this.props.updateParent(this.props.state);
    }
    render() {
        Client.track('signup', 'signup_team_06_username');

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
                    <h2 className='margin--less'>Your username</h2>
                    <h5 className='color--light'>{'Select a memorable username that makes it easy for ' + strings.Team + 'mates to identify you:'}</h5>
                    <div className='inner__content margin--extra'>
                        <div className={nameDivClass}>
                            <div className='row'>
                                <div className='col-sm-11'>
                                    <h5><strong>Choose your username</strong></h5>
                                    <input
                                        autoFocus={true}
                                        type='text'
                                        ref='name'
                                        className='form-control'
                                        placeholder=''
                                        defaultValue={this.props.state.user.username}
                                        maxLength='128'
                                    />
                                    <div className='color--light form__hint'>Usernames must begin with a letter and contain 3 to 15 characters made up of lowercase letters, numbers, and the symbols '.', '-' and '_'</div>
                                </div>
                            </div>
                            {nameError}
                        </div>
                    </div>
                    <button
                        type='submit'
                        className='btn btn-primary margin--extra'
                        onClick={this.submitNext}
                    >
                        Next
                        <i className='glyphicon glyphicon-chevron-right'></i>
                    </button>
                    <div className='margin--extra'>
                        <a
                            href='#'
                            onClick={this.submitBack}
                        >
                            Back to previous step
                        </a>
                    </div>
                </form>
            </div>
        );
    }
}

TeamSignupUsernamePage.defaultProps = {
    state: null
};
TeamSignupUsernamePage.propTypes = {
    state: React.PropTypes.object,
    updateParent: React.PropTypes.func
};
