// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as AsyncClient from 'utils/async_client.jsx';
import Client from 'utils/web_client.jsx';

import FormError from 'components/form_error.jsx';
import SaveButton from 'components/admin_console/save_button.jsx';
import Constants from 'utils/constants.jsx';

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
        this.onKeyDown = this.onKeyDown.bind(this);

        this.state = {
            saveNeeded: false,
            saving: false,
            serverError: null
        };
    }

    handleChange(id, value) {
        this.setState({
            saveNeeded: true,
            [id]: value
        });
    }

    componentDidMount() {
        document.addEventListener('keydown', this.onKeyDown);
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.onKeyDown);
    }

    onKeyDown(e) {
        if (e.keyCode === Constants.KeyCodes.ENTER) {
            this.handleSubmit(e);
        }
    }

    handleSubmit(e) {
        e.preventDefault();

        this.setState({
            saving: true,
            serverError: null
        });

        const config = this.getConfigFromState(this.props.config);

        Client.saveConfig(
            config,
            () => {
                AsyncClient.getConfig();
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

    parseInt(str) {
        const n = parseInt(str, 10);

        if (isNaN(n)) {
            return 0;
        }

        return n;
    }

    parseIntNonZero(str) {
        const n = parseInt(str, 10);

        if (isNaN(n) || n < 1) {
            return 1;
        }

        return n;
    }

    render() {
        let saveClass = 'btn';
        if (this.state.saveNeeded) {
            saveClass += 'btn-primary';
        }

        return (
            <div className='wrapper--fixed'>
                {this.renderTitle()}
                <form
                    className='form-horizontal'
                    role='form'
                >
                    {this.renderSettings()}
                    <div className='form-group'>
                        <div className='col-sm-12'>
                            <FormError error={this.state.serverError}/>
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
