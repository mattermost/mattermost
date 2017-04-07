// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import {FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';

export default class ImageSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);
    }

    getConfigFromState(config) {
        config.FileSettings.ThumbnailWidth = this.parseInt(this.state.thumbnailWidth);
        config.FileSettings.ThumbnailHeight = this.parseInt(this.state.thumbnailHeight);
        config.FileSettings.ProfileWidth = this.parseInt(this.state.profileWidth);
        config.FileSettings.ProfileHeight = this.parseInt(this.state.profileHeight);
        config.FileSettings.PreviewWidth = this.parseInt(this.state.previewWidth);
        config.FileSettings.PreviewHeight = this.parseInt(this.state.previewHeight);

        return config;
    }

    getStateFromConfig(config) {
        return {
            thumbnailWidth: config.FileSettings.ThumbnailWidth,
            thumbnailHeight: config.FileSettings.ThumbnailHeight,
            profileWidth: config.FileSettings.ProfileWidth,
            profileHeight: config.FileSettings.ProfileHeight,
            previewWidth: config.FileSettings.PreviewWidth,
            previewHeight: config.FileSettings.PreviewHeight
        };
    }

    renderTitle() {
        return (
            <FormattedMessage
                id='admin.files.images'
                defaultMessage='Images'
            />
        );
    }

    renderSettings() {
        return (
            <SettingsGroup>
                <TextSetting
                    id='thumbnailWidth'
                    label={
                        <FormattedMessage
                            id='admin.image.thumbWidthTitle'
                            defaultMessage='Attachment Thumbnail Width:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.image.thumbWidthExample', 'Ex "120"')}
                    helpText={
                        <FormattedMessage
                            id='admin.image.thumbWidthDescription'
                            defaultMessage='Width of thumbnails generated from uploaded images. Updating this value changes how thumbnail images render in future, but does not change images created in the past.'
                        />
                    }
                    value={this.state.thumbnailWidth}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='thumbnailHeight'
                    label={
                        <FormattedMessage
                            id='admin.image.thumbHeightTitle'
                            defaultMessage='Attachment Thumbnail Height:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.image.thumbHeightExample', 'Ex "100"')}
                    helpText={
                        <FormattedMessage
                            id='admin.image.thumbHeightDescription'
                            defaultMessage='Height of thumbnails generated from uploaded images. Updating this value changes how thumbnail images render in future, but does not change images created in the past.'
                        />
                    }
                    value={this.state.thumbnailHeight}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='profileWidth'
                    label={
                        <FormattedMessage
                            id='admin.image.profileWidthTitle'
                            defaultMessage='Profile Picture Width:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.image.profileWidthExample', 'Ex "1024"')}
                    helpText={
                        <FormattedMessage
                            id='admin.image.profileWidthDescription'
                            defaultMessage='Width of profile picture.'
                        />
                    }
                    value={this.state.profileWidth}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='profileHeight'
                    label={
                        <FormattedMessage
                            id='admin.image.profileHeightTitle'
                            defaultMessage='Profile Picture Height:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.image.profileHeightExample', 'Ex "0"')}
                    helpText={
                        <FormattedMessage
                            id='admin.image.profileHeightDescription'
                            defaultMessage='Height of profile picture.'
                        />
                    }
                    value={this.state.profileHeight}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='previewWidth'
                    label={
                        <FormattedMessage
                            id='admin.image.previewWidthTitle'
                            defaultMessage='Image Preview Width:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.image.previewWidthExample', 'Ex "1024"')}
                    helpText={
                        <FormattedMessage
                            id='admin.image.previewWidthDescription'
                            defaultMessage='Maximum width of preview image. Updating this value changes how preview images render in future, but does not change images created in the past.'
                        />
                    }
                    value={this.state.previewWidth}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='previewHeight'
                    label={
                        <FormattedMessage
                            id='admin.image.previewHeightTitle'
                            defaultMessage='Image Preview Height:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.image.previewHeightExample', 'Ex "0"')}
                    helpText={
                        <FormattedMessage
                            id='admin.image.previewHeightDescription'
                            defaultMessage='Maximum height of preview image ("0": Sets to auto-size). Updating this value changes how preview images render in future, but does not change images created in the past.'
                        />
                    }
                    value={this.state.previewHeight}
                    onChange={this.handleChange}
                />
            </SettingsGroup>
        );
    }
}
