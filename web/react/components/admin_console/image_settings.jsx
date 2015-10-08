// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../../utils/client.jsx');
var AsyncClient = require('../../utils/async_client.jsx');
var crypto = require('crypto');

export default class FileSettings extends React.Component {
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
            s.DriverName = React.findDOMNode(this.refs.DriverName).value;
        }

        this.setState(s);
    }

    handleGenerate(e) {
        e.preventDefault();
        React.findDOMNode(this.refs.PublicLinkSalt).value = crypto.randomBytes(256).toString('base64').substring(0, 32);
        var s = {saveNeeded: true, serverError: this.state.serverError};
        this.setState(s);
    }

    handleSubmit(e) {
        e.preventDefault();
        $('#save-button').button('loading');

        var config = this.props.config;
        config.FileSettings.DriverName = React.findDOMNode(this.refs.DriverName).value;
        config.FileSettings.Directory = React.findDOMNode(this.refs.Directory).value;
        config.FileSettings.AmazonS3AccessKeyId = React.findDOMNode(this.refs.AmazonS3AccessKeyId).value;
        config.FileSettings.AmazonS3SecretAccessKey = React.findDOMNode(this.refs.AmazonS3SecretAccessKey).value;
        config.FileSettings.AmazonS3Bucket = React.findDOMNode(this.refs.AmazonS3Bucket).value;
        config.FileSettings.AmazonS3Region = React.findDOMNode(this.refs.AmazonS3Region).value;
        config.FileSettings.EnablePublicLink = React.findDOMNode(this.refs.EnablePublicLink).checked;

        config.FileSettings.PublicLinkSalt = React.findDOMNode(this.refs.PublicLinkSalt).value.trim();

        if (config.FileSettings.PublicLinkSalt === '') {
            config.FileSettings.PublicLinkSalt = crypto.randomBytes(256).toString('base64').substring(0, 32);
            React.findDOMNode(this.refs.PublicLinkSalt).value = config.FileSettings.PublicLinkSalt;
        }

        var thumbnailWidth = 120;
        if (!isNaN(parseInt(React.findDOMNode(this.refs.ThumbnailWidth).value, 10))) {
            thumbnailWidth = parseInt(React.findDOMNode(this.refs.ThumbnailWidth).value, 10);
        }
        config.FileSettings.ThumbnailWidth = thumbnailWidth;
        React.findDOMNode(this.refs.ThumbnailWidth).value = thumbnailWidth;

        var thumbnailHeight = 100;
        if (!isNaN(parseInt(React.findDOMNode(this.refs.ThumbnailHeight).value, 10))) {
            thumbnailHeight = parseInt(React.findDOMNode(this.refs.ThumbnailHeight).value, 10);
        }
        config.FileSettings.ThumbnailHeight = thumbnailHeight;
        React.findDOMNode(this.refs.ThumbnailHeight).value = thumbnailHeight;

        var previewWidth = 1024;
        if (!isNaN(parseInt(React.findDOMNode(this.refs.PreviewWidth).value, 10))) {
            previewWidth = parseInt(React.findDOMNode(this.refs.PreviewWidth).value, 10);
        }
        config.FileSettings.PreviewWidth = previewWidth;
        React.findDOMNode(this.refs.PreviewWidth).value = previewWidth;

        var previewHeight = 0;
        if (!isNaN(parseInt(React.findDOMNode(this.refs.PreviewHeight).value, 10))) {
            previewHeight = parseInt(React.findDOMNode(this.refs.PreviewHeight).value, 10);
        }
        config.FileSettings.PreviewHeight = previewHeight;
        React.findDOMNode(this.refs.PreviewHeight).value = previewHeight;

        var profileWidth = 128;
        if (!isNaN(parseInt(React.findDOMNode(this.refs.ProfileWidth).value, 10))) {
            profileWidth = parseInt(React.findDOMNode(this.refs.ProfileWidth).value, 10);
        }
        config.FileSettings.ProfileWidth = profileWidth;
        React.findDOMNode(this.refs.ProfileWidth).value = profileWidth;

        var profileHeight = 128;
        if (!isNaN(parseInt(React.findDOMNode(this.refs.ProfileHeight).value, 10))) {
            profileHeight = parseInt(React.findDOMNode(this.refs.ProfileHeight).value, 10);
        }
        config.FileSettings.ProfileHeight = profileHeight;
        React.findDOMNode(this.refs.ProfileHeight).value = profileHeight;

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
                <h3>{'File Settings'}</h3>
                <form
                    className='form-horizontal'
                    role='form'
                >

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='DriverName'
                        >
                            {'Store Files In:'}
                        </label>
                        <div className='col-sm-8'>
                            <select
                                className='form-control'
                                id='DriverName'
                                ref='DriverName'
                                defaultValue={this.props.config.FileSettings.DriverName}
                                onChange={this.handleChange.bind(this, 'DriverName')}
                            >
                                <option value=''>{'Disable File Storage'}</option>
                                <option value='local'>{'Local File System'}</option>
                                <option value='amazons3'>{'Amazon S3'}</option>
                            </select>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='Directory'
                        >
                            {'Local Directory Location:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='Directory'
                                ref='Directory'
                                placeholder='Ex "./data/"'
                                defaultValue={this.props.config.FileSettings.Directory}
                                onChange={this.handleChange}
                                disabled={!enableFile}
                            />
                            <p className='help-text'>{'Directory to which image files are written. If blank, will be set to ./data/.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='AmazonS3AccessKeyId'
                        >
                            {'Amazon S3 Access Key Id:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='AmazonS3AccessKeyId'
                                ref='AmazonS3AccessKeyId'
                                placeholder='Ex "AKIADTOVBGERKLCBV"'
                                defaultValue={this.props.config.FileSettings.AmazonS3AccessKeyId}
                                onChange={this.handleChange}
                                disabled={!enableS3}
                            />
                            <p className='help-text'>{'Obtain this credential from your Amazon EC2 administrator.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='AmazonS3SecretAccessKey'
                        >
                            {'Amazon S3 Secret Access Key:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='AmazonS3SecretAccessKey'
                                ref='AmazonS3SecretAccessKey'
                                placeholder='Ex "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"'
                                defaultValue={this.props.config.FileSettings.AmazonS3SecretAccessKey}
                                onChange={this.handleChange}
                                disabled={!enableS3}
                            />
                            <p className='help-text'>{'Obtain this credential from your Amazon EC2 administrator.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='AmazonS3Bucket'
                        >
                            {'Amazon S3 Bucket:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='AmazonS3Bucket'
                                ref='AmazonS3Bucket'
                                placeholder='Ex "mattermost-media"'
                                defaultValue={this.props.config.FileSettings.AmazonS3Bucket}
                                onChange={this.handleChange}
                                disabled={!enableS3}
                            />
                            <p className='help-text'>{'Name you selected for your S3 bucket in AWS.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='AmazonS3Region'
                        >
                            {'Amazon S3 Region:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='AmazonS3Region'
                                ref='AmazonS3Region'
                                placeholder='Ex "us-east-1"'
                                defaultValue={this.props.config.FileSettings.AmazonS3Region}
                                onChange={this.handleChange}
                                disabled={!enableS3}
                            />
                            <p className='help-text'>{'AWS region you selected for creating your S3 bucket.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='ThumbnailWidth'
                        >
                            {'Thumbnail Width:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='ThumbnailWidth'
                                ref='ThumbnailWidth'
                                placeholder='Ex "120"'
                                defaultValue={this.props.config.FileSettings.ThumbnailWidth}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{'Width of thumbnails generated from uploaded images. Updating this value changes how thumbnail images render in future, but does not change images created in the past.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='ThumbnailHeight'
                        >
                            {'Thumbnail Height:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='ThumbnailHeight'
                                ref='ThumbnailHeight'
                                placeholder='Ex "100"'
                                defaultValue={this.props.config.FileSettings.ThumbnailHeight}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{'Height of thumbnails generated from uploaded images. Updating this value changes how thumbnail images render in future, but does not change images created in the past.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='PreviewWidth'
                        >
                            {'Preview Width:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='PreviewWidth'
                                ref='PreviewWidth'
                                placeholder='Ex "1024"'
                                defaultValue={this.props.config.FileSettings.PreviewWidth}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{'Maximum width of preview image. Updating this value changes how preview images render in future, but does not change images created in the past.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='PreviewHeight'
                        >
                            {'Preview Height:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='PreviewHeight'
                                ref='PreviewHeight'
                                placeholder='Ex "0"'
                                defaultValue={this.props.config.FileSettings.PreviewHeight}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{'Maximum height of preview image ("0": Sets to auto-size). Updating this value changes how preview images render in future, but does not change images created in the past.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='ProfileWidth'
                        >
                            {'Profile Width:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='ProfileWidth'
                                ref='ProfileWidth'
                                placeholder='Ex "1024"'
                                defaultValue={this.props.config.FileSettings.ProfileWidth}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{'Width of profile picture.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='ProfileHeight'
                        >
                            {'Profile Height:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='ProfileHeight'
                                ref='ProfileHeight'
                                placeholder='Ex "0"'
                                defaultValue={this.props.config.FileSettings.ProfileHeight}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{'Height of profile picture.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnablePublicLink'
                        >
                            {'Share Public File Link: '}
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
                                    {'true'}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnablePublicLink'
                                    value='false'
                                    defaultChecked={!this.props.config.FileSettings.EnablePublicLink}
                                    onChange={this.handleChange}
                                />
                                    {'false'}
                            </label>
                            <p className='help-text'>{'Allow users to share public links to files and images.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='PublicLinkSalt'
                        >
                            {'Public Link Salt:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='PublicLinkSalt'
                                ref='PublicLinkSalt'
                                placeholder='Ex "gxHVDcKUyP2y1eiyW8S8na1UYQAfq6J6"'
                                defaultValue={this.props.config.FileSettings.PublicLinkSalt}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{'32-character salt added to signing of public image links. Randomly generated on install. Click "Re-Generate" to create new salt.'}</p>
                            <div className='help-text'>
                                <button
                                    className='btn btn-default'
                                    onClick={this.handleGenerate}
                                >
                                    {'Re-Generate'}
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
                                data-loading-text={'<span class=\'glyphicon glyphicon-refresh glyphicon-refresh-animate\'></span> Saving Config...'}
                            >
                                {'Save'}
                            </button>
                        </div>
                    </div>

                </form>
            </div>
        );
    }
}

FileSettings.propTypes = {
    config: React.PropTypes.object
};
