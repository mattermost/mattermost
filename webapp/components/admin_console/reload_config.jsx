// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import Client from 'utils/web_client.jsx';
import * as Utils from 'utils/utils.jsx';

import {FormattedMessage} from 'react-intl';

export default class ReloadConfigButton extends React.Component {
    constructor(props) {
        super(props);

        this.handleReloadConfig = this.handleReloadConfig.bind(this);

        this.state = {
            loading: false,
            fail: null
        };
    }

    handleReloadConfig(e) {
        e.preventDefault();

        this.setState({
            loading: true,
            fail: null
        });

        Client.reloadConfig(
            () => {
                this.setState({
                    loading: false
                });
            },
            (err) => {
                this.setState({
                    loading: false,
                    fail: err.message + ' - ' + err.detailed_error
                });
            }
        );
    }

    render() {
        let testMessage = null;
        if (this.state.fail) {
            testMessage = (
                <div className='alert alert-warning'>
                    <i className='fa fa-warning'></i>
                    <FormattedMessage
                        id='admin.reload.reloadFail'
                        defaultMessage='Reload unsuccessful: {error}'
                        values={{
                            error: this.state.fail
                        }}
                    />
                </div>
            );
        }

        let contents = null;
        if (this.state.loading) {
            contents = (
                <span>
                    <span className='glyphicon glyphicon-refresh glyphicon-refresh-animate'/>
                    {Utils.localizeMessage('admin.reload.loading', ' Loading...')}
                </span>
            );
        } else {
            contents = (
                <FormattedMessage
                    id='admin.reload.button'
                    defaultMessage='Reload Configuration From Disk'
                />
            );
        }

        return (
            <div className='form-group reload-config'>
                <div className='col-sm-offset-4 col-sm-8'>
                    <div>
                        <button
                            className='btn btn-default'
                            onClick={this.handleReloadConfig}
                        >
                            {contents}
                        </button>
                        {testMessage}
                    </div>
                </div>
            </div>
        );
    }
}