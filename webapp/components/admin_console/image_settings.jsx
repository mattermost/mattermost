// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import {FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';

export class ImageSettingsPage extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            thumbnailWidth: props.config.FileSettings.ThumbnailWidth,
            thumbnailHeight: props.config.FileSettings.ThumbnailHeight,
            profileWidth: props.config.FileSettings.ProfileWidth,
            profileHeight: props.config.FileSettings.ProfileHeight,
            previewWidth: props.config.FileSettings.PreviewWidth,
            previewHeight: props.config.FileSettings.PreviewHeight
        });
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
            <ImageSettings
                thumbnailWidth={this.state.thumbnailWidth}
                thumbnailHeight={this.state.thumbnailHeight}
                profileWidth={this.state.profileWidth}
                profileHeight={this.state.profileHeight}
                previewWidth={this.state.previewWidth}
                previewHeight={this.state.previewHeight}
                onChange={this.handleChange}
            />
        );
    }
}

export class ImageSettings extends React.Component {
    static get propTypes() {
        return {
            thumbnailWidth: React.PropTypes.oneOfType([
                React.PropTypes.string,
                React.PropTypes.number
            ]).isRequired,
            thumbnailHeight: React.PropTypes.oneOfType([
                React.PropTypes.string,
                React.PropTypes.number
            ]).isRequired,
            profileWidth: React.PropTypes.oneOfType([
                React.PropTypes.string,
                React.PropTypes.number
            ]).isRequired,
            profileHeight: React.PropTypes.oneOfType([
                React.PropTypes.string,
                React.PropTypes.number
            ]).isRequired,
            previewWidth: React.PropTypes.oneOfType([
                React.PropTypes.string,
                React.PropTypes.number
            ]).isRequired,
            previewHeight: React.PropTypes.oneOfType([
                React.PropTypes.string,
                React.PropTypes.number
            ]).isRequired,
            onChange: React.PropTypes.func.isRequired
        };
    }

    render() {
        return (
            <SettingsGroup
                header={
                    <FormattedMessage
                        id='admin.files.images'
                        defaultMessage='Images'
                    />
                }
            >
                <TextSetting
                    id='thumbnailWidth'
                    label={
                        <FormattedMessage
                            id='admin.image.thumbWidthTitle'
                            defaultMessage='Thumbnail Width:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.image.thumbWidthExample', 'Ex "120"')}
                    helpText={
                        <FormattedMessage
                            id='admin.image.thumbWidthDescription'
                            defaultMessage='Width of thumbnails generated from uploaded images. Updating this value changes how thumbnail images render in future, but does not change images created in the past.'
                        />
                    }
                    value={this.props.thumbnailWidth}
                    onChange={this.props.onChange}
                />
                <TextSetting
                    id='thumbnailHeight'
                    label={
                        <FormattedMessage
                            id='admin.image.thumbHeightTitle'
                            defaultMessage='Thumbnail Height:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.image.thumbHeightExample', 'Ex "100"')}
                    helpText={
                        <FormattedMessage
                            id='admin.image.thumbHeightDescription'
                            defaultMessage='Height of thumbnails generated from uploaded images. Updating this value changes how thumbnail images render in future, but does not change images created in the past.'
                        />
                    }
                    value={this.props.thumbnailHeight}
                    onChange={this.props.onChange}
                />
                <TextSetting
                    id='profileWidth'
                    label={
                        <FormattedMessage
                            id='admin.image.profileWidthTitle'
                            defaultMessage='Profile Width:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.image.profileWidthExample', 'Ex "1024"')}
                    helpText={
                        <FormattedMessage
                            id='admin.image.profileWidthDescription'
                            defaultMessage='Width of profile picture.'
                        />
                    }
                    value={this.props.profileWidth}
                    onChange={this.props.onChange}
                />
                <TextSetting
                    id='profileHeight'
                    label={
                        <FormattedMessage
                            id='admin.image.profileHeightTitle'
                            defaultMessage='Profile Height:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.image.profileHeightExample', 'Ex "0"')}
                    helpText={
                        <FormattedMessage
                            id='admin.image.profileHeightDescription'
                            defaultMessage='Height of profile picture.'
                        />
                    }
                    value={this.props.profileHeight}
                    onChange={this.props.onChange}
                />
                <TextSetting
                    id='previewWidth'
                    label={
                        <FormattedMessage
                            id='admin.image.previewWidthTitle'
                            defaultMessage='Preview Width:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.image.previewWidthExample', 'Ex "1024"')}
                    helpText={
                        <FormattedMessage
                            id='admin.image.previewWidthDescription'
                            defaultMessage='Maximum width of preview image. Updating this value changes how preview images render in future, but does not change images created in the past.'
                        />
                    }
                    value={this.props.previewWidth}
                    onChange={this.props.onChange}
                />
                <TextSetting
                    id='previewHeight'
                    label={
                        <FormattedMessage
                            id='admin.image.previewHeightTitle'
                            defaultMessage='Preview Height:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.image.previewHeightExample', 'Ex "0"')}
                    helpText={
                        <FormattedMessage
                            id='admin.image.previewHeightDescription'
                            defaultMessage='Maximum height of preview image ("0": Sets to auto-size). Updating this value changes how preview images render in future, but does not change images created in the past.'
                        />
                    }
                    value={this.props.previewHeight}
                    onChange={this.props.onChange}
                />
            </SettingsGroup>
        );
    }
}
