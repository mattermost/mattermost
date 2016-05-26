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

export default class StorageSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            maxFileSize: props.config.FileSettings.MaxFileSize,
            driverName: props.config.FileSettings.DriverName,
            directory: props.config.FileSettings.Directory,
            amazonS3AccessKeyId: props.config.FileSettings.AmazonS3AccessKeyId,
            amazonS3SecretAccessKey: props.config.FileSettings.AmazonS3SecretAccessKey,
            amazonS3Bucket: props.config.FileSettings.AmazonS3Bucket,
            amazonS3Region: props.config.FileSettings.AmazonS3Region
        });
    }

    getConfigFromState(config) {
        config.FileSettings.MaxFileSize = this.parseInt(this.state.maxFileSize);
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
            <SettingsGroup
                header={
                    <FormattedMessage
                        id='admin.files.storage'
                        defaultMessage='Storage'
                    />
                }
            >
                <TextSetting
                    id='maxFileSize'
                    label={
                        <FormattedMessage
                            id='admin.image.maxFileSizeTitle'
                            defaultMessage='Max File Size:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.image.maxFileSizeExample', 'Ex "52428800"')}
                    helpText={
                        <FormattedMessage
                            id='admin.image.maxFileSizeDescription'
                            defaultMessage='Max File Size in bytes. If blank, will be set to 52428800 (50MB).'
                        />
                    }
                    value={this.state.maxFileSize}
                    onChange={this.handleChange}
                />
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
                    value={this.state.driverName}
                    onChange={this.handleChange}
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
                    value={this.state.directory}
                    onChange={this.handleChange}
                    disabled={this.state.driverName !== DRIVER_LOCAL}
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
                    value={this.state.amazonS3AccessKeyId}
                    onChange={this.handleChange}
                    disabled={this.state.driverName !== DRIVER_S3}
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
                    value={this.state.amazonS3SecretAccessKey}
                    onChange={this.handleChange}
                    disabled={this.state.driverName !== DRIVER_S3}
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
                    value={this.state.amazonS3Bucket}
                    onChange={this.handleChange}
                    disabled={this.state.driverName !== DRIVER_S3}
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
                    value={this.state.amazonS3Region}
                    onChange={this.handleChange}
                    disabled={this.state.driverName !== DRIVER_S3}
                />
            </SettingsGroup>
        );
    }
}
