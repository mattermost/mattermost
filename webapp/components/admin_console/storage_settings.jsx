// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import DropdownSetting from './dropdown_setting.jsx';
import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';
import BooleanSetting from './boolean_setting.jsx';

const DRIVER_LOCAL = 'local';
const DRIVER_S3 = 'amazons3';

export default class StorageSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);
    }

    getConfigFromState(config) {
        config.FileSettings.EnableFileAttachments = this.state.enableFileAttachments;
        config.FileSettings.EnableMobileUpload = this.state.enableMobileUpload;
        config.FileSettings.EnableMobileDownload = this.state.enableMobileDownload;
        config.FileSettings.MaxFileSize = this.parseInt(this.state.maxFileSize) * 1024 * 1024;
        config.FileSettings.DriverName = this.state.driverName;
        config.FileSettings.Directory = this.state.directory;
        config.FileSettings.AmazonS3AccessKeyId = this.state.amazonS3AccessKeyId;
        config.FileSettings.AmazonS3SecretAccessKey = this.state.amazonS3SecretAccessKey;
        config.FileSettings.AmazonS3Bucket = this.state.amazonS3Bucket;
        config.FileSettings.AmazonS3Endpoint = this.state.amazonS3Endpoint;
        config.FileSettings.AmazonS3SSL = this.state.amazonS3SSL;
        config.FileSettings.AmazonS3SSE = this.state.amazonS3SSE;

        return config;
    }

    getStateFromConfig(config) {
        return {
            enableFileAttachments: config.FileSettings.EnableFileAttachments,
            enableMobileUpload: config.FileSettings.EnableMobileUpload,
            enableMobileDownload: config.FileSettings.EnableMobileDownload,
            maxFileSize: config.FileSettings.MaxFileSize / 1024 / 1024,
            driverName: config.FileSettings.DriverName,
            directory: config.FileSettings.Directory,
            amazonS3AccessKeyId: config.FileSettings.AmazonS3AccessKeyId,
            amazonS3SecretAccessKey: config.FileSettings.AmazonS3SecretAccessKey,
            amazonS3Bucket: config.FileSettings.AmazonS3Bucket,
            amazonS3Endpoint: config.FileSettings.AmazonS3Endpoint,
            amazonS3SSL: config.FileSettings.AmazonS3SSL,
            amazonS3SSE: config.FileSettings.AmazonS3SSE
        };
    }

    renderTitle() {
        return (
            <FormattedMessage
                id='admin.files.storage'
                defaultMessage='Storage'
            />
        );
    }

    renderSettings() {
        let amazonSSEComp;
        const mobileUploadDownloadSettings = [];
        if (window.mm_license.IsLicensed === 'true' && window.mm_license.Compliance === 'true') {
            mobileUploadDownloadSettings.push(
                <BooleanSetting
                    key='enableMobileUpload'
                    id='enableMobileUpload'
                    label={
                        <FormattedMessage
                            id='admin.file.enableMobileUploadTitle'
                            defaultMessage='Allow File Uploads on Mobile:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.file.enableMobileUploadDesc'
                            defaultMessage='When false, disables file uploads on mobile apps. If Allow File Sharing is set to true, users can still upload files from a mobile web browser.'
                        />
                    }
                    value={this.state.enableMobileUpload}
                    onChange={this.handleChange}
                    disabled={!this.state.enableFileAttachments}
                />
            );

            mobileUploadDownloadSettings.push(
                <BooleanSetting
                    key='enableMobileDownload'
                    id='enableMobileDownload'
                    label={
                        <FormattedMessage
                            id='admin.file.enableMobileDownloadTitle'
                            defaultMessage='Allow File Downloads on Mobile:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.file.enableMobileDownloadDesc'
                            defaultMessage='When false, disables file downloads on mobile apps. Users can still download files from a mobile web browser.'
                        />
                    }
                    value={this.state.enableMobileDownload}
                    onChange={this.handleChange}
                    disabled={!this.state.enableFileAttachments}
                />
            );

            amazonSSEComp =
                (
                    <BooleanSetting
                        id='amazonS3SSE'
                        label={
                            <FormattedMessage
                                id='admin.image.amazonS3SSETitle'
                                defaultMessage='Enable Server-Side Encryption for Amazon S3:'
                            />
                        }
                        placeholder={Utils.localizeMessage('admin.image.amazonS3SSEExample', 'Ex "false"')}
                        helpText={
                            <FormattedHTMLMessage
                                id='admin.image.amazonS3SSEDescription'
                                defaultMessage='When true, encrypt files in Amazon S3 using server-side encryption with Amazon S3-managed keys. See <a href="https://about.mattermost.com/default-server-side-encryption" target="_blank">documentation</a> to learn more.'
                            />
                        }
                        value={this.state.amazonS3SSE}
                        onChange={this.handleChange}
                        disabled={this.state.driverName !== DRIVER_S3}
                    />
                );
        }

        return (
            <SettingsGroup>
                <DropdownSetting
                    id='driverName'
                    values={[
                        {value: DRIVER_LOCAL, text: Utils.localizeMessage('admin.image.storeLocal', 'Local File System')},
                        {value: DRIVER_S3, text: Utils.localizeMessage('admin.image.storeAmazonS3', 'Amazon S3')}
                    ]}
                    label={
                        <FormattedMessage
                            id='admin.image.storeTitle'
                            defaultMessage='File Storage System:'
                        />
                    }
                    helpText={
                        <FormattedHTMLMessage
                            id='admin.image.storeDescription'
                            defaultMessage='Storage system where files and image attachments are saved.<br /><br />
                            Selecting "Amazon S3" enables fields to enter your Amazon credentials and bucket details.<br /><br />
                            Selecting "Local File System" enables the field to specify a local file directory.'
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
                            defaultMessage='Local Storage Directory:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.image.localExample', 'Ex "./data/"')}
                    helpText={
                        <FormattedMessage
                            id='admin.image.localDescription'
                            defaultMessage='Directory to which files and images are written. If blank, defaults to ./data/.'
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
                            defaultMessage='Amazon S3 Access Key ID:'
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
                    id='amazonS3Endpoint'
                    label={
                        <FormattedMessage
                            id='admin.image.amazonS3EndpointTitle'
                            defaultMessage='Amazon S3 Endpoint:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.image.amazonS3EndpointExample', 'Ex "s3.amazonaws.com"')}
                    helpText={
                        <FormattedMessage
                            id='admin.image.amazonS3EndpointDescription'
                            defaultMessage='Hostname of your S3 Compatible Storage provider. Defaults to `s3.amazonaws.com`.'
                        />
                    }
                    value={this.state.amazonS3Endpoint}
                    onChange={this.handleChange}
                    disabled={this.state.driverName !== DRIVER_S3}
                />
                <BooleanSetting
                    id='amazonS3SSL'
                    label={
                        <FormattedMessage
                            id='admin.image.amazonS3SSLTitle'
                            defaultMessage='Enable Secure Amazon S3 Connections:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.image.amazonS3SSLExample', 'Ex "true"')}
                    helpText={
                        <FormattedMessage
                            id='admin.image.amazonS3SSLDescription'
                            defaultMessage='When false, allow insecure connections to Amazon S3. Defaults to secure connections only.'
                        />
                    }
                    value={this.state.amazonS3SSL}
                    onChange={this.handleChange}
                    disabled={this.state.driverName !== DRIVER_S3}
                />
                {amazonSSEComp}
                <BooleanSetting
                    id='enableFileAttachments'
                    label={
                        <FormattedMessage
                            id='admin.file.enableFileAttachments'
                            defaultMessage='Allow File Sharing:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.file.enableFileAttachmentsDesc'
                            defaultMessage='When false, disables file sharing on the server. All file and image uploads on messages are forbidden across clients and devices, including mobile.'
                        />
                    }
                    value={this.state.enableFileAttachments}
                    onChange={this.handleChange}
                />
                {mobileUploadDownloadSettings}
                <TextSetting
                    id='maxFileSize'
                    label={
                        <FormattedMessage
                            id='admin.image.maxFileSizeTitle'
                            defaultMessage='Maximum File Size:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.image.maxFileSizeExample', '50')}
                    helpText={
                        <FormattedMessage
                            id='admin.image.maxFileSizeDescription'
                            defaultMessage='Maximum file size for message attachments in megabytes. Caution: Verify server memory can support your setting choice. Large file sizes increase the risk of server crashes and failed uploads due to network interruptions.'
                        />
                    }
                    value={this.state.maxFileSize}
                    onChange={this.handleChange}
                    disabled={!this.state.enableFileAttachments}
                />
            </SettingsGroup>
        );
    }
}
