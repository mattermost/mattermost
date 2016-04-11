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
<<<<<<< HEAD
                </h3>
                <form
                    className='form-horizontal'
                    role='form'
                >

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='DriverName'
                        >
                            <FormattedMessage
                                id='admin.image.storeTitle'
                                defaultMessage='Store Files In:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <select
                                className='form-control'
                                id='DriverName'
                                ref='DriverName'
                                defaultValue={this.props.config.FileSettings.DriverName}
                                onChange={this.handleChange.bind(this, 'DriverName')}
                            >
                                <option value='local'>{formatMessage(holders.storeLocal)}</option>
                                <option value='amazons3'>{formatMessage(holders.storeAmazonS3)}</option>
                            </select>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='Directory'
                        >
                            <FormattedMessage
                                id='admin.image.localTitle'
                                defaultMessage='Local Directory Location:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='Directory'
                                ref='Directory'
                                placeholder={formatMessage(holders.localExample)}
                                defaultValue={this.props.config.FileSettings.Directory}
                                onChange={this.handleChange}
                                disabled={!enableFile}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.image.localDescription'
                                    defaultMessage='Directory to which image files are written. If blank, will be set to ./data/.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='AmazonS3AccessKeyId'
                        >
                            <FormattedMessage
                                id='admin.image.amazonS3IdTitle'
                                defaultMessage='Amazon S3 Access Key Id:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='AmazonS3AccessKeyId'
                                ref='AmazonS3AccessKeyId'
                                placeholder={formatMessage(holders.amazonS3IdExample)}
                                defaultValue={this.props.config.FileSettings.AmazonS3AccessKeyId}
                                onChange={this.handleChange}
                                disabled={!enableS3}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.image.amazonS3IdDescription'
                                    defaultMessage='Obtain this credential from your Amazon EC2 administrator.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='AmazonS3SecretAccessKey'
                        >
                            <FormattedMessage
                                id='admin.image.amazonS3SecretTitle'
                                defaultMessage='Amazon S3 Secret Access Key:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='AmazonS3SecretAccessKey'
                                ref='AmazonS3SecretAccessKey'
                                placeholder={formatMessage(holders.amazonS3SecretExample)}
                                defaultValue={this.props.config.FileSettings.AmazonS3SecretAccessKey}
                                onChange={this.handleChange}
                                disabled={!enableS3}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.image.amazonS3SecretDescription'
                                    defaultMessage='Obtain this credential from your Amazon EC2 administrator.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='AmazonS3Bucket'
                        >
                            <FormattedMessage
                                id='admin.image.amazonS3BucketTitle'
                                defaultMessage='Amazon S3 Bucket:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='AmazonS3Bucket'
                                ref='AmazonS3Bucket'
                                placeholder={formatMessage(holders.amazonS3BucketExample)}
                                defaultValue={this.props.config.FileSettings.AmazonS3Bucket}
                                onChange={this.handleChange}
                                disabled={!enableS3}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.image.amazonS3BucketDescription'
                                    defaultMessage='Name you selected for your S3 bucket in AWS.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='AmazonS3Region'
                        >
                            <FormattedMessage
                                id='admin.image.amazonS3RegionTitle'
                                defaultMessage='Amazon S3 Region:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='AmazonS3Region'
                                ref='AmazonS3Region'
                                placeholder={formatMessage(holders.amazonS3RegionExample)}
                                defaultValue={this.props.config.FileSettings.AmazonS3Region}
                                onChange={this.handleChange}
                                disabled={!enableS3}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.image.amazonS3RegionDescription'
                                    defaultMessage='AWS region you selected for creating your S3 bucket.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='ThumbnailWidth'
                        >
                            <FormattedMessage
                                id='admin.image.thumbWidthTitle'
                                defaultMessage='Thumbnail Width:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='ThumbnailWidth'
                                ref='ThumbnailWidth'
                                placeholder={formatMessage(holders.thumbWidthExample)}
                                defaultValue={this.props.config.FileSettings.ThumbnailWidth}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.image.thumbWidthDescription'
                                    defaultMessage='Width of thumbnails generated from uploaded images. Updating this value changes how thumbnail images render in future, but does not change images created in the past.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='ThumbnailHeight'
                        >
                            <FormattedMessage
                                id='admin.image.thumbHeightTitle'
                                defaultMessage='Thumbnail Height:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='ThumbnailHeight'
                                ref='ThumbnailHeight'
                                placeholder={formatMessage(holders.thumbHeightExample)}
                                defaultValue={this.props.config.FileSettings.ThumbnailHeight}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.image.thumbHeightDescription'
                                    defaultMessage='Height of thumbnails generated from uploaded images. Updating this value changes how thumbnail images render in future, but does not change images created in the past.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='PreviewWidth'
                        >
                            <FormattedMessage
                                id='admin.image.previewWidthTitle'
                                defaultMessage='Preview Width:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='PreviewWidth'
                                ref='PreviewWidth'
                                placeholder={formatMessage(holders.previewWidthExample)}
                                defaultValue={this.props.config.FileSettings.PreviewWidth}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.image.previewWidthDescription'
                                    defaultMessage='Maximum width of preview image. Updating this value changes how preview images render in future, but does not change images created in the past.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='PreviewHeight'
                        >
                            <FormattedMessage
                                id='admin.image.previewHeightTitle'
                                defaultMessage='Preview Height:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='PreviewHeight'
                                ref='PreviewHeight'
                                placeholder={formatMessage(holders.previewHeightExample)}
                                defaultValue={this.props.config.FileSettings.PreviewHeight}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.image.previewHeightDescription'
                                    defaultMessage='Maximum height of preview image ("0": Sets to auto-size). Updating this value changes how preview images render in future, but does not change images created in the past.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='ProfileWidth'
                        >
                            <FormattedMessage
                                id='admin.image.profileWidthTitle'
                                defaultMessage='Profile Width:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='ProfileWidth'
                                ref='ProfileWidth'
                                placeholder={formatMessage(holders.profileWidthExample)}
                                defaultValue={this.props.config.FileSettings.ProfileWidth}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.image.profileWidthDescription'
                                    defaultMessage='Width of profile picture.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='ProfileHeight'
                        >
                            <FormattedMessage
                                id='admin.image.profileHeightTitle'
                                defaultMessage='Profile Height:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='ProfileHeight'
                                ref='ProfileHeight'
                                placeholder={formatMessage(holders.profileHeightExample)}
                                defaultValue={this.props.config.FileSettings.ProfileHeight}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.image.profileHeightDescription'
                                    defaultMessage='Height of profile picture.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnablePublicLink'
                        >
                            <FormattedMessage
                                id='admin.image.shareTitle'
                                defaultMessage='Share Public File Link: '
                            />
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnablePublicLink'
                                    value='true'
                                    ref='EnablePublicLink'
                                    defaultChecked={this.props.config.FileSettings.EnablePublicLink}
                                    onChange={this.handleChange}
                                />
                                <FormattedMessage
                                    id='admin.image.true'
                                    defaultMessage='true'
                                />
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnablePublicLink'
                                    value='false'
                                    defaultChecked={!this.props.config.FileSettings.EnablePublicLink}
                                    onChange={this.handleChange}
                                />
                                <FormattedMessage
                                    id='admin.image.false'
                                    defaultMessage='false'
                                />
                            </label>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.image.shareDescription'
                                    defaultMessage='Allow users to share public links to files and images.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='PublicLinkSalt'
                        >
                            <FormattedMessage
                                id='admin.image.publicLinkTitle'
                                defaultMessage='Public Link Salt:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='PublicLinkSalt'
                                ref='PublicLinkSalt'
                                placeholder={formatMessage(holders.publicLinkExample)}
                                defaultValue={this.props.config.FileSettings.PublicLinkSalt}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.image.publicLinkDescription'
                                    defaultMessage='32-character salt added to signing of public image links. Randomly generated on install. Click "Re-Generate" to create new salt.'
                                />
                            </p>
                            <div className='help-text'>
                                <button
                                    className='btn btn-default'
                                    onClick={this.handleGenerate}
                                >
                                    <FormattedMessage
                                        id='admin.image.regenerate'
                                        defaultMessage='Re-Generate'
                                    />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className='form-group'>
                        <div className='col-sm-12'>
                            {serverError}
                            <button
                                disabled={!this.state.saveNeeded}
                                type='submit'
                                className={saveClass}
                                onClick={this.handleSubmit}
                                id='save-button'
                                data-loading-text={'<span class=\'glyphicon glyphicon-refresh glyphicon-refresh-animate\'></span> ' + formatMessage(holders.saving)}
                            >
                                <FormattedMessage
                                    id='admin.image.save'
                                    defaultMessage='Save'
                                />
                            </button>
                        </div>
                    </div>

                </form>
            </div>
        );
    }
}

FileSettings.propTypes = {
    intl: intlShape.isRequired,
    config: React.PropTypes.object
};

export default injectIntl(FileSettings);
=======
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
>>>>>>> 6d02983... Reorganized system console
