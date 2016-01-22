// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Client from '../../utils/client.jsx';
import * as Utils from '../../utils/utils.jsx';

export default class ManageLanguage extends React.Component {
    constructor(props) {
        super(props);

        this.setupInitialState = this.setupInitialState.bind(this);
        this.setLanguage = this.setLanguage.bind(this);
        this.changeLanguage = this.changeLanguage.bind(this);
        this.submitUser = this.submitUser.bind(this);
        this.state = this.setupInitialState(props);
    }
    setupInitialState(props) {
        var user = props.user;
        return {
            languages: Utils.languages(),
            locale: user.locale
        };
    }
    setLanguage(e) {
        this.setState({locale: e.target.value});
    }
    changeLanguage(e) {
        e.preventDefault();

        var user = this.props.user;
        var locale = this.state.locale;

        user.locale = locale;

        this.submitUser(user);
    }
    submitUser(user) {
        Client.updateUser(user,
            () => {
                window.location.reload(true);
            },
            (err) => {
                let serverError;
                if (err.message) {
                    serverError = err.message;
                } else {
                    serverError = err;
                }
                this.setState({serverError});
            }
        );
    }
    render() {
        let serverError;
        if (this.state.serverError) {
            serverError = <label className='has-error'>{this.state.serverError}</label>;
        }

        const options = [];
        this.state.languages.forEach((lang) => {
            options.push(
                <option
                    key={lang.value}
                    value={lang.value}
                >
                    {lang.name}
                </option>);
        });

        return (
            <div key='changeLanguage'>
                <br/>
                <label className='control-label'>{'Change interface language'}</label>
                <div className='padding-top'>
                    <select
                        ref='language'
                        className='form-control'
                        value={this.state.locale}
                        onChange={this.setLanguage}
                    >
                        {options}
                    </select>
                    {serverError}
                    <div className='padding-top'>
                        <a
                            className={'btn btn-sm btn-primary'}
                            href='#'
                            onClick={this.changeLanguage}
                        >
                            {'Set language'}
                        </a>
                    </div>
                </div>
            </div>
        );
    }
}

ManageLanguage.propTypes = {
    user: React.PropTypes.object
};