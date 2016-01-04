// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../../utils/utils.jsx';
import * as Client from '../../utils/client.jsx';

export default class EmailToSSO extends React.Component {
    constructor(props) {
        super(props);

        this.submit = this.submit.bind(this);

        this.state = {};
    }
    submit(e) {
        e.preventDefault();
        var state = {};

        var password = ReactDOM.findDOMNode(this.refs.password).value.trim();
        if (!password) {
            state.error = 'Please enter your password.';
            this.setState(state);
            return;
        }

        state.error = null;
        this.setState(state);

        var postData = {};
        postData.password = password;
        postData.email = this.props.email;
        postData.team_name = this.props.teamName;
        postData.service = this.props.type;

        Client.switchToSSO(postData,
            (data) => {
                if (data.follow_link) {
                    window.location.href = data.follow_link;
                }
            },
            (error) => {
                this.setState({error});
            }
        );
    }
    render() {
        var error = null;
        if (this.state.error) {
            error = <div className='form-group has-error'><label className='control-label'>{this.state.error}</label></div>;
        }

        var formClass = 'form-group';
        if (error) {
            formClass += ' has-error';
        }

        const uiType = Utils.toTitleCase(this.props.type) + ' SSO';

        return (
            <div className='col-sm-12'>
                <div className='signup-team__container'>
                    <h3>{'Switch Email/Password Account to ' + uiType}</h3>
                    <form onSubmit={this.submit}>
                        <p>{'Upon claiming your account, you will only be able to login with ' + Utils.toTitleCase(this.props.type) + ' SSO.'}</p>
                        <p>{'Enter the password for your ' + this.props.teamDisplayName + ' ' + global.window.mm_config.SiteName + ' account.'}</p>
                        <div className={formClass}>
                            <input
                                type='password'
                                className='form-control'
                                name='password'
                                ref='password'
                                placeholder='Password'
                                spellCheck='false'
                            />
                        </div>
                        {error}
                        <button
                            type='submit'
                            className='btn btn-primary'
                        >
                            {'Switch account to ' + uiType}
                        </button>
                    </form>
                </div>
            </div>
        );
    }
}

EmailToSSO.defaultProps = {
};
EmailToSSO.propTypes = {
    type: React.PropTypes.string.isRequired,
    email: React.PropTypes.string.isRequired,
    teamName: React.PropTypes.string.isRequired,
    teamDisplayName: React.PropTypes.string.isRequired
};
