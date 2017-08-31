// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import LoadingScreen from 'components/loading_screen.jsx';
import Banner from 'components/admin_console/banner.jsx';

import * as Utils from 'utils/utils.jsx';

import React from 'react';
import PropTypes from 'prop-types';
import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';

export default class PluginSettings extends React.Component {
    static propTypes = {

        /*
         * The config
         */
        config: PropTypes.object.isRequired,

        /*
         * Plugins object with ids as keys and manifests as values
         */
        plugins: PropTypes.object.isRequired,

        actions: PropTypes.shape({

            /*
             * Function to upload a plugin
             */
            uploadPlugin: PropTypes.func.isRequired,

            /*
             * Function to remove a plugin
             */
            removePlugin: PropTypes.func.isRequired,

            /*
             * Function to get installed plugins
             */
            getPlugins: PropTypes.func.isRequired
        }).isRequired
    }

    constructor(props) {
        super(props);

        this.state = {
            loading: true,
            fileSelected: false,
            fileName: null,
            serverError: null
        };
    }

    componentDidMount() {
        this.props.actions.getPlugins().then(
            () => this.setState({loading: false})
        );
    }

    handleChange = () => {
        const element = this.refs.fileInput;
        if (element.files.length > 0) {
            this.setState({fileSelected: true, fileName: element.files[0].name});
        }
    }

    handleSubmit = async (e) => {
        e.preventDefault();

        const element = this.refs.fileInput;
        if (element.files.length === 0) {
            return;
        }
        const file = element.files[0];

        this.setState({uploading: true});

        const {error} = await this.props.actions.uploadPlugin(file);
        this.setState({fileSelected: false, fileName: null, uploading: false});
        Utils.clearFileInput(element[0]);

        if (error) {
            this.setState({serverError: error.message});
        }
    }

    handleRemove = async (pluginId) => {
        this.setState({removing: pluginId});

        const {error} = await this.props.actions.removePlugin(pluginId);
        this.setState({removing: null});

        if (error) {
            this.setState({serverError: error.message});
        }
    }

    render() {
        let serverError = '';
        if (this.state.serverError) {
            serverError = <div className='col-sm-12'><div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div></div>;
        }

        let btnClass = 'btn';
        if (this.state.fileSelected) {
            btnClass = 'btn btn-primary';
        }

        let fileName;
        if (this.state.fileName) {
            fileName = this.state.fileName;
        }

        let uploadButtonText;
        if (this.state.uploading) {
            uploadButtonText = (
                <FormattedMessage
                    id='admin.plugin.uploading'
                    defaultMessage='Uploading...'
                />
            );
        } else {
            uploadButtonText = (
                <FormattedMessage
                    id='admin.plugin.upload'
                    defaultMessage='Upload'
                />
            );
        }

        let activePluginsList;
        const plugins = Object.values(this.props.plugins);
        if (this.state.loading) {
            activePluginsList = <LoadingScreen/>;
        } else if (plugins.length === 0) {
            activePluginsList = (
                <FormattedMessage
                    id='admin.plugin.no_plugins'
                    defaultMessage='No active plugins.'
                />
            );
        } else {
            activePluginsList = plugins.map(
                (p) => {
                    let removeButtonText;
                    if (this.state.removing === p.id) {
                        removeButtonText = (
                            <FormattedMessage
                                id='admin.plugin.removing'
                                defaultMessage='Removing...'
                            />
                        );
                    } else {
                        removeButtonText = (
                            <FormattedMessage
                                id='admin.plugin.remove'
                                defaultMessage='Remove'
                            />
                        );
                    }

                    return (
                        <div key={p.id}>
                            <span>
                                <strong>
                                    <FormattedMessage
                                        id='admin.plugin.id'
                                        defaultMessage='ID:'
                                    />
                                </strong>
                                {' ' + p.id}
                            </span>
                            <span style={{marginLeft: '5px'}}>
                                <strong>
                                    <FormattedMessage
                                        id='admin.plugin.desc'
                                        defaultMessage='Description:'
                                    />
                                </strong>
                                {' ' + p.description}
                            </span>
                            <button
                                style={{marginLeft: '10px'}}
                                className='btn btn-danger'
                                disabled={this.state.removing === p.id}
                                onClick={() => this.handleRemove(p.id)}
                            >
                                {removeButtonText}
                            </button>
                        </div>
                    );
                }
            );
        }

        return (
            <div className='wrapper--fixed'>
                <h3 className='admin-console-header'>
                    <FormattedMessage
                        id='admin.plugin.title'
                        defaultMessage='Plugins (experimental)'
                    />
                </h3>
                <Banner
                    description={
                        <FormattedHTMLMessage
                            id='admin.plugin.banner'
                            defaultMessage='Plugins are experimental stage and are not yet recommended for use in production environments. <br/><br/> Webapp plugins will require users to refresh their browsers or desktop apps before the plugin will take effect. Similarly when a plugin is removed, users will continue to see the plugin until they refresh their browser or app.'
                        />
                    }
                />
                <form
                    className='form-horizontal'
                    role='form'
                >
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                        >
                            <FormattedMessage
                                id='admin.plugin.uploadTitle'
                                defaultMessage='Upload a plugin: '
                            />
                        </label>
                        <div className='col-sm-8'>
                            <div className='file__upload'>
                                <button className='btn btn-primary'>
                                    <FormattedMessage
                                        id='admin.plugin.choose'
                                        defaultMessage='Choose File'
                                    />
                                </button>
                                <input
                                    ref='fileInput'
                                    type='file'
                                    accept='.gz'
                                    onChange={this.handleChange}
                                />
                            </div>
                            <button
                                className={btnClass}
                                disabled={!this.state.fileSelected}
                                onClick={this.handleSubmit}
                            >
                                {uploadButtonText}
                            </button>
                            <div className='help-text no-margin'>
                                {fileName}
                            </div>
                            <br/>
                            {serverError}
                            <p className='help-text no-margin'>
                                <FormattedHTMLMessage
                                    id='admin.plugin.uploadDesc'
                                    defaultMessage='Upload a plugin.'
                                />
                            </p>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                        >
                            <FormattedMessage
                                id='admin.plugin.activeTitle'
                                defaultMessage='Active plugins: '
                            />
                        </label>
                        <div className='col-sm-8'>
                            {activePluginsList}
                        </div>
                    </div>
                </form>
            </div>
        );
    }
}
