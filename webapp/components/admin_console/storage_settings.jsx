// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import DropdownSetting from './dropdown_setting.jsx';
import {FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';

const DRIVER_LOCAL = 'local';
const DRIVER_S3 = 'amazons3';

export class StorageSettingsPage extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            driverName: props.config.FileSettings.DriverName,
            directory: props.config.FileSettings.Directory,
            amazonS3AccessKeyId: props.config.FileSettings.AmazonS3AccessKeyId,
            amazonS3SecretAccessKey: props.config.FileSettings.AmazonS3SecretAccessKey,
            amazonS3Bucket: props.config.FileSettings.AmazonS3Bucket,
            amazonS3Region: props.config.FileSettings.AmazonS3Region
        });
    }

    getConfigFromState(config) {
        config.FileSettings.DriverName = this.state.driverName;
        config.FileSettings.Directory = this.state.directory;
        config.FileSettings.AmazonS3AccessKeyId = this.state.amazonS3AccessKeyId;
        config.FileSettings.AmazonS3SecretAccessKey = this.state.amazonS3SecretAccessKey;
        config.FileSettings.AmazonS3Bucket = this.state.amazonS3Bucket;
        config.FileSettings.AmazonS3Region = this.state.amazonS3Region;

        return config;
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.files.title'
                    defaultMessage='File Settings'
                />
            </h3>
        );
    }

    renderSettings() {
        return (
            <StorageSettings
                driverName={this.state.driverName}
                directory={this.state.directory}
                amazonS3AccessKeyId={this.state.amazonS3AccessKeyId}
                amazonS3SecretAccessKey={this.state.amazonS3SecretAccessKey}
                amazonS3Bucket={this.state.amazonS3Bucket}
                amazonS3Region={this.state.amazonS3Region}
                onChange={this.handleChange}
            />
        );
    }
}

export class StorageSettings extends React.Component {
    static get propTypes() {
        return {
            driverName: React.PropTypes.string.isRequired,
            directory: React.PropTypes.string.isRequired,
            amazonS3AccessKeyId: React.PropTypes.string.isRequired,
            amazonS3SecretAccessKey: React.PropTypes.string.isRequired,
            amazonS3Bucket: React.PropTypes.string.isRequired,
            amazonS3Region: React.PropTypes.string.isRequired,
            onChange: React.PropTypes.func.isRequired
        };
    }

    render() {
        return (
            <SettingsGroup
                header={
                    <FormattedMessage
                        id='admin.files.storage'
                        defaultMessage='Storage'
                    />
                }
            >
                <DropdownSetting
                    id='driverName'
                    values={[
                        {value: DRIVER_LOCAL, text: Utils.localizeMessage('admin.image.storeLocal', 'Local File System')},
                        {value: DRIVER_S3, text: Utils.localizeMessage('admin.image.storeAmazonS3', 'Amazon S3')}
                    ]}
                    label={
                        <FormattedMessage
                            id='admin.image.storeTitle'
                            defaultMessage='Store Files In:'
                        />
                    }
                    value={this.props.driverName}
                    onChange={this.props.onChange}
                />
                <TextSetting
                    id='directory'
                    label={
                        <FormattedMessage
                            id='admin.image.localTitle'
                            defaultMessage='Local Directory Location:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.image.localExample', 'Ex "./data/"')}
                    helpText={
                        <FormattedMessage
                            id='admin.image.localDescription'
                            defaultMessage='Directory to which image files are written. If blank, will be set to ./data/.'
                        />
                    }
                    value={this.props.directory}
                    onChange={this.props.onChange}
                    disabled={this.props.driverName !== DRIVER_LOCAL}
                />
                <TextSetting
                    id='amazonS3AccessKeyId'
                    label={
                        <FormattedMessage
                            id='admin.image.amazonS3IdTitle'
                            defaultMessage='Amazon S3 Access Key Id:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.image.amazonS3IdExample', 'Ex "AKIADTOVBGERKLCBV"')}
                    helpText={
                        <FormattedMessage
                            id='admin.image.amazonS3IdDescription'
                            defaultMessage='Obtain this credential from your Amazon EC2 administrator.'
                        />
                    }
                    value={this.props.amazonS3AccessKeyId}
                    onChange={this.props.onChange}
                    disabled={this.props.driverName !== DRIVER_S3}
                />
                <TextSetting
                    id='amazonS3SecretAccessKey'
                    label={
                        <FormattedMessage
                            id='admin.image.amazonS3SecretTitle'
                            defaultMessage='Amazon S3 Secret Access Key:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.image.amazonS3SecretExample', 'Ex "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"')}
                    helpText={
                        <FormattedMessage
                            id='admin.image.amazonS3SecretDescription'
                            defaultMessage='Obtain this credential from your Amazon EC2 administrator.'
                        />
                    }
                    value={this.props.amazonS3SecretAccessKey}
                    onChange={this.props.onChange}
                    disabled={this.props.driverName !== DRIVER_S3}
                />
                <TextSetting
                    id='amazonS3Bucket'
                    label={
                        <FormattedMessage
                            id='admin.image.amazonS3BucketTitle'
                            defaultMessage='Amazon S3 Bucket:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.image.amazonS3BucketExample', 'Ex "mattermost-media"')}
                    helpText={
                        <FormattedMessage
                            id='admin.image.amazonS3BucketDescription'
                            defaultMessage='Name you selected for your S3 bucket in AWS.'
                        />
                    }
                    value={this.props.amazonS3Bucket}
                    onChange={this.props.onChange}
                    disabled={this.props.driverName !== DRIVER_S3}
                />
                <TextSetting
                    id='amazonS3Region'
                    label={
                        <FormattedMessage
                            id='admin.image.amazonS3RegionTitle'
                            defaultMessage='Amazon S3 Region:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.image.amazonS3RegionExample', 'Ex "us-east-1"')}
                    helpText={
                        <FormattedMessage
                            id='admin.image.amazonS3RegionDescription'
                            defaultMessage='AWS region you selected for creating your S3 bucket.'
                        />
                    }
                    value={this.props.amazonS3Region}
                    onChange={this.props.onChange}
                    disabled={this.props.driverName !== DRIVER_S3}
                />
            </SettingsGroup>
        );
    }
}
