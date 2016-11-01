// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import Client from 'client/web_client.jsx';
import * as Utils from 'utils/utils.jsx';

import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';

export default class LdapTestButton extends React.Component {
    static get propTypes() {
        return {
            disabled: React.PropTypes.bool,
            submitFunction: React.PropTypes.func,
            saveNeeded: React.PropTypes.bool
        };
    }
    constructor(props) {
        super(props);

        this.handleLdapTest = this.handleLdapTest.bind(this);

        this.state = {
            buisy: false,
            fail: null,
            success: false
        };
    }

    handleLdapTest(e) {
        e.preventDefault();

        this.setState({
            buisy: true,
            fail: null,
            success: false
        });

        const doRequest = () => { //eslint-disable-line func-style
            Client.ldapTest(
                () => {
                    this.setState({
                        buisy: false,
                        success: true
                    });
                },
                (err) => {
                    this.setState({
                        buisy: false,
                        fail: err.message
                    });
                }
            );
        };

        // If we need to run the save function then run it with our request function as callback
        if (this.props.saveNeeded) {
            this.props.submitFunction(doRequest);
        } else {
            doRequest();
        }
    }

    render() {
        let message = null;
        if (this.state.fail) {
            message = (
                <div>
                    <div className='alert alert-warning'>
                        <i className='fa fa-warning'/>
                        <FormattedMessage
                            id='admin.ldap.testFailure'
                            defaultMessage='AD/LDAP Test Failure: {error}'
                            values={{
                                error: this.state.fail
                            }}
                        />
                    </div>
                </div>
            );
        } else if (this.state.success) {
            message = (
                <div>
                    <div className='alert alert-success'>
                        <i className='fa fa-success'/>
                        <FormattedMessage
                            id='admin.ldap.testSuccess'
                            defaultMessage='AD/LDAP Test Successful'
                            values={{
                                error: this.state.fail
                            }}
                        />
                    </div>
                </div>
            );
        }

        const helpText = (
            <FormattedHTMLMessage
                id='admin.ldap.testHelpText'
                defaultMessage='Tests if the Mattermost server can connect to the AD/LDAP server specified. See log file for more detailed error messages.'
            />
        );

        let contents = null;
        if (this.state.loading) {
            contents = (
                <span>
                    <span className='fa fa-refresh icon--rotate'/>
                    {Utils.localizeMessage('admin.reload.loading', ' Loading...')}
                </span>
            );
        } else {
            contents = (
                <FormattedMessage
                    id='admin.ldap.ldap_test_button'
                    defaultMessage='AD/LDAP Test'
                />
            );
        }

        return (
            <div className='form-group reload-config'>
                <div className='col-sm-offset-4 col-sm-8'>
                    <div>
                        <button
                            className='btn btn-default'
                            onClick={this.handleLdapTest}
                            disabled={this.props.disabled}
                        >
                            {contents}
                        </button>
                        {message}
                    </div>
                    <div className='help-text'>
                        {helpText}
                    </div>
                </div>
            </div>
        );
    }
}
