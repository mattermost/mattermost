// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import * as Client from '../../utils/client.jsx';
import * as AsyncClient from '../../utils/async_client.jsx';
import crypto from 'crypto';

const messages = defineMessages({
    fileSettings: {
        id: 'admin.image.fileSettings',
        defaultMessage: 'File Settings'
    },
    storeTitle: {
        id: 'admin.image.storeTitle',
        defaultMessage: 'Store Files In:'
    },
    storeDisabled: {
        id: 'admin.image.storeDisabled',
        defaultMessage: 'Disable File Storage'
    },
    storeLocal: {
        id: 'admin.image.storeLocal',
        defaultMessage: 'Local File System'
    },
    storeAmazonS3: {
        id: 'admin.image.storeAmazonS3',
        defaultMessage: 'Amazon S3'
    },
    localTitle: {
        id: 'admin.image.localTitle',
        defaultMessage: 'Local Directory Location:'
    },
    localExample: {
        id: 'admin.image.localExample',
        defaultMessage: 'Ex "./data/"'
    },
    localDescription: {
        id: 'admin.image.localDescription',
        defaultMessage: 'Directory to which image files are written. If blank, will be set to ./data/.'
    },
    amazonS3IdTitle: {
        id: 'admin.image.amazonS3IdTitle',
        defaultMessage: 'Amazon S3 Access Key Id:'
    },
    amazonS3IdExample: {
        id: 'admin.image.amazonS3IdExample',
        defaultMessage: 'Ex "AKIADTOVBGERKLCBV"'
    },
    amazonS3IdDescription: {
        id: 'admin.image.amazonS3IdDescription',
        defaultMessage: 'Obtain this credential from your Amazon EC2 administrator.'
    },
    amazonS3SecretTitle: {
        id: 'admin.image.amazonS3SecretTitle',
        defaultMessage: 'Amazon S3 Secret Access Key:'
    },
    amazonS3SecretExample: {
        id: 'admin.image.amazonS3SecretExample',
        defaultMessage: 'Ex "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"'
    },
    amazonS3SecretDescription: {
        id: 'admin.image.amazonS3SecretDescription',
        defaultMessage: 'Obtain this credential from your Amazon EC2 administrator.'
    },
    amazonS3BucketTitle: {
        id: 'admin.image.amazonS3BucketTitle',
        defaultMessage: 'Amazon S3 Bucket:'
    },
    amazonS3BucketExample: {
        id: 'admin.image.amazonS3BucketExample',
        defaultMessage: 'Ex "mattermost-media"'
    },
    amazonS3BucketDescription: {
        id: 'admin.image.amazonS3BucketDescription',
        defaultMessage: 'Name you selected for your S3 bucket in AWS.'
    },
    amazonS3RegionTitle: {
        id: 'admin.image.amazonS3RegionTitle',
        defaultMessage: 'Amazon S3 Region:'
    },
    amazonS3RegionExample: {
        id: 'admin.image.amazonS3RegionExample',
        defaultMessage: 'Ex "us-east-1"'
    },
    amazonS3RegionDescription: {
        id: 'admin.image.amazonS3RegionDescription',
        defaultMessage: 'AWS region you selected for creating your S3 bucket.'
    },
    thumbWidthTitle: {
        id: 'admin.image.thumbWidthTitle',
        defaultMessage: 'Thumbnail Width:'
    },
    thumbWidthExample: {
        id: 'admin.image.thumbWidthExample',
        defaultMessage: 'Ex "120"'
    },
    thumbWidthDescription: {
        id: 'admin.image.thumbWidthDescription',
        defaultMessage: 'Width of thumbnails generated from uploaded images. Updating this value changes how thumbnail images render in future, but does not change images created in the past.'
    },
    thumbHeightTitle: {
        id: 'admin.image.thumbHeightTitle',
        defaultMessage: 'Thumbnail Height:'
    },
    thumbHeightExample: {
        id: 'admin.image.thumbHeightExample',
        defaultMessage: 'Ex "100"'
    },
    thumbHeightDescription: {
        id: 'admin.image.thumbHeightDescription',
        defaultMessage: 'Height of thumbnails generated from uploaded images. Updating this value changes how thumbnail images render in future, but does not change images created in the past.'
    },
    previewWidthTitle: {
        id: 'admin.image.previewWidthTitle',
        defaultMessage: 'Preview Width:'
    },
    previewWidthExample: {
        id: 'admin.image.previewWidthExample',
        defaultMessage: 'Ex "1024"'
    },
    previewWidthDescription: {
        id: 'admin.image.previewWidthDescription',
        defaultMessage: 'Maximum width of preview image. Updating this value changes how preview images render in future, but does not change images created in the past.'
    },
    previewHeightTitle: {
        id: 'admin.image.previewHeightTitle',
        defaultMessage: 'Preview Height:'
    },
    previewHeightExample: {
        id: 'admin.image.previewHeightExample',
        defaultMessage: 'Ex "0"'
    },
    previewHeightDescription: {
        id: 'admin.image.previewHeightDescription',
        defaultMessage: 'Maximum height of preview image ("0": Sets to auto-size). Updating this value changes how preview images render in future, but does not change images created in the past.'
    },
    profileWidthTitle: {
        id: 'admin.image.profileWidthTitle',
        defaultMessage: 'Profile Width:'
    },
    profileWidthExample: {
        id: 'admin.image.profileWidthExample',
        defaultMessage: 'Ex "1024"'
    },
    profileWidthDescription: {
        id: 'admin.image.profileWidthDescription',
        defaultMessage: 'Width of profile picture.'
    },
    profileHeightTitle: {
        id: 'admin.image.profileHeightTitle',
        defaultMessage: 'Profile Height:'
    },
    profileHeightExample: {
        id: 'admin.image.profileHeightExample',
        defaultMessage: 'Ex "0"'
    },
    profileHeightDescription: {
        id: 'admin.image.profileHeightDescription',
        defaultMessage: 'Height of profile picture.'
    },
    true: {
        id: 'admin.image.true',
        defaultMessage: 'true'
    },
    false: {
        id: 'admin.image.false',
        defaultMessage: 'false'
    },
    shareTitle: {
        id: 'admin.image.shareTitle',
        defaultMessage: 'Share Public File Link: '
    },
    shareDescription: {
        id: 'admin.image.shareDescription',
        defaultMessage: 'Allow users to share public links to files and images.'
    },
    publicLinkTitle: {
        id: 'admin.image.publicLinkTitle',
        defaultMessage: 'Public Link Salt:'
    },
    publicLinkExample: {
        id: 'admin.image.publicLinkExample',
        defaultMessage: 'Ex "gxHVDcKUyP2y1eiyW8S8na1UYQAfq6J6"'
    },
    publicLinkDescription: {
        id: 'admin.image.publicLinkDescription',
        defaultMessage: '32-character salt added to signing of public image links. Randomly generated on install. Click "Re-Generate" to create new salt.'
    },
    regenerate: {
        id: 'admin.image.regenerate',
        defaultMessage: 'Re-Generate'
    },
    saving: {
        id: 'admin.image.saving',
        defaultMessage: 'Saving Config...'
    },
    save: {
        id: 'admin.image.save',
        defaultMessage: 'Save'
    }
});

class FileSettings extends React.Component {
    constructor(props) {
        super(props);

        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleGenerate = this.handleGenerate.bind(this);

        this.state = {
            saveNeeded: false,
            serverError: null,
            DriverName: this.props.config.FileSettings.DriverName
        };
    }

    handleChange(action) {
        var s = {saveNeeded: true, serverError: this.state.serverError};

        if (action === 'DriverName') {
            s.DriverName = ReactDOM.findDOMNode(this.refs.DriverName).value;
        }

        this.setState(s);
    }

    handleGenerate(e) {
        e.preventDefault();
        ReactDOM.findDOMNode(this.refs.PublicLinkSalt).value = crypto.randomBytes(256).toString('base64').substring(0, 32);
        var s = {saveNeeded: true, serverError: this.state.serverError};
        this.setState(s);
    }

    handleSubmit(e) {
        e.preventDefault();
        $('#save-button').button('loading');

        var config = this.props.config;
        config.FileSettings.DriverName = ReactDOM.findDOMNode(this.refs.DriverName).value;
        config.FileSettings.Directory = ReactDOM.findDOMNode(this.refs.Directory).value;
        config.FileSettings.AmazonS3AccessKeyId = ReactDOM.findDOMNode(this.refs.AmazonS3AccessKeyId).value;
        config.FileSettings.AmazonS3SecretAccessKey = ReactDOM.findDOMNode(this.refs.AmazonS3SecretAccessKey).value;
        config.FileSettings.AmazonS3Bucket = ReactDOM.findDOMNode(this.refs.AmazonS3Bucket).value;
        config.FileSettings.AmazonS3Region = ReactDOM.findDOMNode(this.refs.AmazonS3Region).value;
        config.FileSettings.EnablePublicLink = ReactDOM.findDOMNode(this.refs.EnablePublicLink).checked;

        config.FileSettings.PublicLinkSalt = ReactDOM.findDOMNode(this.refs.PublicLinkSalt).value.trim();

        if (config.FileSettings.PublicLinkSalt === '') {
            config.FileSettings.PublicLinkSalt = crypto.randomBytes(256).toString('base64').substring(0, 32);
            ReactDOM.findDOMNode(this.refs.PublicLinkSalt).value = config.FileSettings.PublicLinkSalt;
        }

        var thumbnailWidth = 120;
        if (!isNaN(parseInt(ReactDOM.findDOMNode(this.refs.ThumbnailWidth).value, 10))) {
            thumbnailWidth = parseInt(ReactDOM.findDOMNode(this.refs.ThumbnailWidth).value, 10);
        }
        config.FileSettings.ThumbnailWidth = thumbnailWidth;
        ReactDOM.findDOMNode(this.refs.ThumbnailWidth).value = thumbnailWidth;

        var thumbnailHeight = 100;
        if (!isNaN(parseInt(ReactDOM.findDOMNode(this.refs.ThumbnailHeight).value, 10))) {
            thumbnailHeight = parseInt(ReactDOM.findDOMNode(this.refs.ThumbnailHeight).value, 10);
        }
        config.FileSettings.ThumbnailHeight = thumbnailHeight;
        ReactDOM.findDOMNode(this.refs.ThumbnailHeight).value = thumbnailHeight;

        var previewWidth = 1024;
        if (!isNaN(parseInt(ReactDOM.findDOMNode(this.refs.PreviewWidth).value, 10))) {
            previewWidth = parseInt(ReactDOM.findDOMNode(this.refs.PreviewWidth).value, 10);
        }
        config.FileSettings.PreviewWidth = previewWidth;
        ReactDOM.findDOMNode(this.refs.PreviewWidth).value = previewWidth;

        var previewHeight = 0;
        if (!isNaN(parseInt(ReactDOM.findDOMNode(this.refs.PreviewHeight).value, 10))) {
            previewHeight = parseInt(ReactDOM.findDOMNode(this.refs.PreviewHeight).value, 10);
        }
        config.FileSettings.PreviewHeight = previewHeight;
        ReactDOM.findDOMNode(this.refs.PreviewHeight).value = previewHeight;

        var profileWidth = 128;
        if (!isNaN(parseInt(ReactDOM.findDOMNode(this.refs.ProfileWidth).value, 10))) {
            profileWidth = parseInt(ReactDOM.findDOMNode(this.refs.ProfileWidth).value, 10);
        }
        config.FileSettings.ProfileWidth = profileWidth;
        ReactDOM.findDOMNode(this.refs.ProfileWidth).value = profileWidth;

        var profileHeight = 128;
        if (!isNaN(parseInt(ReactDOM.findDOMNode(this.refs.ProfileHeight).value, 10))) {
            profileHeight = parseInt(ReactDOM.findDOMNode(this.refs.ProfileHeight).value, 10);
        }
        config.FileSettings.ProfileHeight = profileHeight;
        ReactDOM.findDOMNode(this.refs.ProfileHeight).value = profileHeight;

        Client.saveConfig(
            config,
            () => {
                AsyncClient.getConfig();
                this.setState({
                    serverError: null,
                    saveNeeded: false
                });
                $('#save-button').button('reset');
            },
            (err) => {
                this.setState({
                    serverError: err.message,
                    saveNeeded: true
                });
                $('#save-button').button('reset');
            }
        );
    }

    render() {
        const {formatMessage} = this.props.intl;

        var serverError = '';
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        var saveClass = 'btn';
        if (this.state.saveNeeded) {
            saveClass = 'btn btn-primary';
        }

        var enableFile = false;
        var enableS3 = false;

        if (this.state.DriverName === 'local') {
            enableFile = true;
        }

        if (this.state.DriverName === 'amazons3') {
            enableS3 = true;
        }

        return (
            <div className='wrapper--fixed'>
                <h3>{formatMessage(messages.fileSettings)}</h3>
                <form
                    className='form-horizontal'
                    role='form'
                >

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='DriverName'
                        >
                            {formatMessage(messages.storeTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <select
                                className='form-control'
                                id='DriverName'
                                ref='DriverName'
                                defaultValue={this.props.config.FileSettings.DriverName}
                                onChange={this.handleChange.bind(this, 'DriverName')}
                            >
                                <option value=''>{formatMessage(messages.storeDisabled)}</option>
                                <option value='local'>{formatMessage(messages.storeLocal)}</option>
                                <option value='amazons3'>{formatMessage(messages.storeAmazonS3)}</option>
                            </select>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='Directory'
                        >
                            {formatMessage(messages.localTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='Directory'
                                ref='Directory'
                                placeholder={formatMessage(messages.localExample)}
                                defaultValue={this.props.config.FileSettings.Directory}
                                onChange={this.handleChange}
                                disabled={!enableFile}
                            />
                            <p className='help-text'>{formatMessage(messages.localDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='AmazonS3AccessKeyId'
                        >
                            {formatMessage(messages.amazonS3IdTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='AmazonS3AccessKeyId'
                                ref='AmazonS3AccessKeyId'
                                placeholder={formatMessage(messages.amazonS3IdExample)}
                                defaultValue={this.props.config.FileSettings.AmazonS3AccessKeyId}
                                onChange={this.handleChange}
                                disabled={!enableS3}
                            />
                            <p className='help-text'>{formatMessage(messages.amazonS3IdDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='AmazonS3SecretAccessKey'
                        >
                            {formatMessage(messages.amazonS3SecretTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='AmazonS3SecretAccessKey'
                                ref='AmazonS3SecretAccessKey'
                                placeholder={formatMessage(messages.amazonS3SecretExample)}
                                defaultValue={this.props.config.FileSettings.AmazonS3SecretAccessKey}
                                onChange={this.handleChange}
                                disabled={!enableS3}
                            />
                            <p className='help-text'>{formatMessage(messages.amazonS3SecretDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='AmazonS3Bucket'
                        >
                            {formatMessage(messages.amazonS3BucketTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='AmazonS3Bucket'
                                ref='AmazonS3Bucket'
                                placeholder={formatMessage(messages.amazonS3BucketExample)}
                                defaultValue={this.props.config.FileSettings.AmazonS3Bucket}
                                onChange={this.handleChange}
                                disabled={!enableS3}
                            />
                            <p className='help-text'>{formatMessage(messages.amazonS3BucketDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='AmazonS3Region'
                        >
                            {formatMessage(messages.amazonS3RegionTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='AmazonS3Region'
                                ref='AmazonS3Region'
                                placeholder={formatMessage(messages.amazonS3RegionExample)}
                                defaultValue={this.props.config.FileSettings.AmazonS3Region}
                                onChange={this.handleChange}
                                disabled={!enableS3}
                            />
                            <p className='help-text'>{formatMessage(messages.amazonS3RegionDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='ThumbnailWidth'
                        >
                            {formatMessage(messages.thumbWidthTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='ThumbnailWidth'
                                ref='ThumbnailWidth'
                                placeholder={formatMessage(messages.thumbWidthExample)}
                                defaultValue={this.props.config.FileSettings.ThumbnailWidth}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{formatMessage(messages.thumbWidthDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='ThumbnailHeight'
                        >
                            {formatMessage(messages.thumbHeightTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='ThumbnailHeight'
                                ref='ThumbnailHeight'
                                placeholder={formatMessage(messages.thumbHeightExample)}
                                defaultValue={this.props.config.FileSettings.ThumbnailHeight}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{formatMessage(messages.thumbHeightDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='PreviewWidth'
                        >
                            {formatMessage(messages.previewWidthTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='PreviewWidth'
                                ref='PreviewWidth'
                                placeholder={formatMessage(messages.previewWidthExample)}
                                defaultValue={this.props.config.FileSettings.PreviewWidth}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{formatMessage(messages.previewWidthDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='PreviewHeight'
                        >
                            {formatMessage(messages.previewHeightTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='PreviewHeight'
                                ref='PreviewHeight'
                                placeholder={formatMessage(messages.previewHeightExample)}
                                defaultValue={this.props.config.FileSettings.PreviewHeight}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{formatMessage(messages.previewHeightDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='ProfileWidth'
                        >
                            {formatMessage(messages.profileWidthTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='ProfileWidth'
                                ref='ProfileWidth'
                                placeholder={formatMessage(messages.profileWidthExample)}
                                defaultValue={this.props.config.FileSettings.ProfileWidth}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{formatMessage(messages.profileWidthDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='ProfileHeight'
                        >
                            {formatMessage(messages.profileHeightTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='ProfileHeight'
                                ref='ProfileHeight'
                                placeholder={formatMessage(messages.profileHeightExample)}
                                defaultValue={this.props.config.FileSettings.ProfileHeight}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{formatMessage(messages.profileHeightDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnablePublicLink'
                        >
                            {formatMessage(messages.shareTitle)}
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
                                    {formatMessage(messages.true)}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnablePublicLink'
                                    value='false'
                                    defaultChecked={!this.props.config.FileSettings.EnablePublicLink}
                                    onChange={this.handleChange}
                                />
                                    {formatMessage(messages.false)}
                            </label>
                            <p className='help-text'>{formatMessage(messages.shareDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='PublicLinkSalt'
                        >
                            {formatMessage(messages.publicLinkTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='PublicLinkSalt'
                                ref='PublicLinkSalt'
                                placeholder={formatMessage(messages.publicLinkExample)}
                                defaultValue={this.props.config.FileSettings.PublicLinkSalt}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{formatMessage(messages.publicLinkDescription)}</p>
                            <div className='help-text'>
                                <button
                                    className='btn btn-default'
                                    onClick={this.handleGenerate}
                                >
                                    {formatMessage(messages.regenerate)}
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
                                data-loading-text={'<span class=\'glyphicon glyphicon-refresh glyphicon-refresh-animate\'></span> ' + formatMessage(messages.saving)}
                            >
                                {formatMessage(messages.save)}
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
