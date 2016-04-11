// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import AdminSettings from './admin_settings.jsx';
import {FormattedMessage} from 'react-intl';
import {ImageSettings} from './image_settings.jsx';
import {StorageSettings} from './storage_settings.jsx';

export default class FileSettings extends AdminSettings {
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
            amazonS3Region: props.config.FileSettings.AmazonS3Region,

            thumbnailWidth: props.config.FileSettings.ThumbnailWidth,
            thumbnailHeight: props.config.FileSettings.ThumbnailHeight,
            profileWidth: props.config.FileSettings.ProfileWidth,
            profileHeight: props.config.FileSettings.ProfileHeight,
            previewWidth: props.config.FileSettings.PreviewWidth,
            previewHeight: props.config.FileSettings.PreviewHeight
        });
    }

    getConfigFromState(config) {
        config.FileSettings.DriverName = this.state.driverName;
        config.FileSettings.Directory = this.state.directory;
        config.FileSettings.AmazonS3AccessKeyId = this.state.amazonS3AccessKeyId;
        config.FileSettings.AmazonS3SecretAccessKey = this.state.amazonS3SecretAccessKey;
        config.FileSettings.AmazonS3Bucket = this.state.amazonS3Bucket;
        config.FileSettings.AmazonS3Region = this.state.amazonS3Region;

        config.FileSettings.ThumbnailWidth = this.parseInt(this.state.thumbnailWidth);
        config.FileSettings.ThumbnailHeight = this.parseInt(this.state.thumbnailHeight);
        config.FileSettings.ProfileWidth = this.parseInt(this.state.profileWidth);
        config.FileSettings.ProfileHeight = this.parseInt(this.state.profileHeight);
        config.FileSettings.PreviewWidth = this.parseInt(this.state.previewWidth);
        config.FileSettings.PreviewHeight = this.parseInt(this.state.previewHeight);

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
            <div>
                <StorageSettings
                    driverName={this.state.driverName}
                    directory={this.state.directory}
                    amazonS3AccessKeyId={this.state.amazonS3AccessKeyId}
                    amazonS3SecretAccessKey={this.state.amazonS3SecretAccessKey}
                    amazonS3Bucket={this.state.amazonS3Bucket}
                    amazonS3Region={this.state.amazonS3Region}
                    onChange={this.handleChange}
                />
                <ImageSettings
                    thumbnailWidth={this.state.thumbnailWidth}
                    thumbnailHeight={this.state.thumbnailHeight}
                    profileWidth={this.state.profileWidth}
                    profileHeight={this.state.profileHeight}
                    previewWidth={this.state.previewWidth}
                    previewHeight={this.state.previewHeight}
                    onChange={this.handleChange}
                />
            </div>
        );
    }
}
