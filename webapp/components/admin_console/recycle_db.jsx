// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import Client from 'utils/web_client.jsx';
import * as Utils from 'utils/utils.jsx';

import {FormattedMessage} from 'react-intl';

export default class RecycleDbButton extends React.Component {
    constructor(props) {
        super(props);

        this.handleRecycle = this.handleRecycle.bind(this);

        this.state = {
            loading: false,
            fail: null
        };
    }

    handleRecycle(e) {
        e.preventDefault();

        this.setState({
            loading: true,
            fail: null
        });

        Client.recycleDatabaseConnection(
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
        if (global.window.mm_license.IsLicensed !== 'true') {
            return <div></div>;
        }

        let testMessage = null;
        if (this.state.fail) {
            testMessage = (
                <div className='alert alert-warning'>
                    <i className='fa fa-warning'></i>
                    <FormattedMessage
                        id='admin.recycle.reloadFail'
                        defaultMessage='Recycling unsuccessful: {error}'
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
                    {Utils.localizeMessage('admin.recycle.loading', ' Recycling...')}
                </span>
            );
        } else {
            contents = (
                <FormattedMessage
                    id='admin.recycle.button'
                    defaultMessage='Recycle Database Connections'
                />
            );
        }

        return (
            <div className='form-group recycle-db'>
                <div className='col-sm-offset-4 col-sm-8'>
                    <div>
                        <button
                            className='btn btn-default'
                            onClick={this.handleRecycle}
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