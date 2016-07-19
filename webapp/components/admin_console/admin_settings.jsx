// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as AsyncClient from 'utils/async_client.jsx';
import Client from 'client/web_client.jsx';

import FormError from 'components/form_error.jsx';
import SaveButton from 'components/admin_console/save_button.jsx';

export default class AdminSettings extends React.Component {
    static get propTypes() {
        return {
            config: React.PropTypes.object
        };
    }

    constructor(props) {
        super(props);

        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);

        this.state = Object.assign(this.getStateFromConfig(props.config), {
            saveNeeded: false,
            saving: false,
            serverError: null
        });
    }

    handleChange(id, value) {
        this.setState({
            saveNeeded: true,
            [id]: value
        });
    }

    handleSubmit(e) {
        e.preventDefault();

        this.setState({
            saving: true,
            serverError: null
        });

        // clone config so that we aren't modifying data in the stores
        let config = JSON.parse(JSON.stringify(this.props.config));
        config = this.getConfigFromState(config);

        Client.saveConfig(
            config,
            () => {
                AsyncClient.getConfig((savedConfig) => {
                    this.setState(this.getStateFromConfig(savedConfig));
                });

                this.setState({
                    saveNeeded: false,
                    saving: false
                });
            },
            (err) => {
                this.setState({
                    saving: false,
                    serverError: err.message
                });
            }
        );
    }

    parseInt(str, defaultValue) {
        const n = parseInt(str, 10);

        if (isNaN(n)) {
            if (defaultValue) {
                return defaultValue;
            }
            return 0;
        }

        return n;
    }

    parseIntNonZero(str, defaultValue) {
        const n = parseInt(str, 10);

        if (isNaN(n) || n < 1) {
            if (defaultValue) {
                return defaultValue;
            }
            return 1;
        }

        return n;
    }

    render() {
        return (
            <div className='wrapper--fixed'>
                {this.renderTitle()}
                <form
                    className='form-horizontal'
                    role='form'
                    onSubmit={this.handleSubmit}
                >
                    {this.renderSettings()}
                    <div className='form-group'>
                        <FormError error={this.state.serverError}/>
                    </div>
                    <div className='form-group'>
                        <div className='col-sm-12'>
                            <SaveButton
                                saving={this.state.saving}
                                disabled={!this.state.saveNeeded || (this.canSave && !this.canSave())}
                                onClick={this.handleSubmit}
                            />
                        </div>
                    </div>
                </form>
            </div>
        );
    }
}
