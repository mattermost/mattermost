// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../../utils/client.jsx');
var AsyncClient = require('../../utils/async_client.jsx');

export default class ImageSettings extends React.Component {
    constructor(props) {
        super(props);

        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);

        this.state = {
            saveNeeded: false,
            serverError: null,
            DriverName: this.props.config.ImageSettings.DriverName
        };
    }

    handleChange(action) {
        var s = {saveNeeded: true, serverError: this.state.serverError};

        if (action === 'DriverName') {
            s.DriverName = React.findDOMNode(this.refs.DriverName).value;
        }

        this.setState(s);
    }

    handleSubmit(e) {
        e.preventDefault();
        $('#save-button').button('loading');

        var config = this.props.config;
        config.ImageSettings.DriverName = React.findDOMNode(this.refs.DriverName).value;
        config.ImageSettings.Directory = React.findDOMNode(this.refs.Directory).value;
        config.ImageSettings.AmazonS3AccessKeyId = React.findDOMNode(this.refs.AmazonS3AccessKeyId).value;
        config.ImageSettings.AmazonS3SecretAccessKey = React.findDOMNode(this.refs.AmazonS3SecretAccessKey).value;
        config.ImageSettings.AmazonS3Bucket = React.findDOMNode(this.refs.AmazonS3Bucket).value;
        config.ImageSettings.AmazonS3Region = React.findDOMNode(this.refs.AmazonS3Region).value;

        var thumbnailWidth = 120;
        if (!isNaN(parseInt(React.findDOMNode(this.refs.ThumbnailWidth).value, 10))) {
            thumbnailWidth = parseInt(React.findDOMNode(this.refs.ThumbnailWidth).value, 10);
        }
        config.ImageSettings.ThumbnailWidth = thumbnailWidth;
        React.findDOMNode(this.refs.ThumbnailWidth).value = thumbnailWidth;

        var thumbnailHeight = 100;
        if (!isNaN(parseInt(React.findDOMNode(this.refs.ThumbnailHeight).value, 10))) {
            thumbnailHeight = parseInt(React.findDOMNode(this.refs.ThumbnailHeight).value, 10);
        }
        config.ImageSettings.ThumbnailHeight = thumbnailHeight;
        React.findDOMNode(this.refs.ThumbnailHeight).value = thumbnailHeight;

        var previewWidth = 1024;
        if (!isNaN(parseInt(React.findDOMNode(this.refs.PreviewWidth).value, 10))) {
            previewWidth = parseInt(React.findDOMNode(this.refs.PreviewWidth).value, 10);
        }
        config.ImageSettings.PreviewWidth = previewWidth;
        React.findDOMNode(this.refs.PreviewWidth).value = previewWidth;

        var previewHeight = 0;
        if (!isNaN(parseInt(React.findDOMNode(this.refs.PreviewHeight).value, 10))) {
            previewHeight = parseInt(React.findDOMNode(this.refs.PreviewHeight).value, 10);
        }
        config.ImageSettings.PreviewHeight = previewHeight;
        React.findDOMNode(this.refs.PreviewHeight).value = previewHeight;

        var profileWidth = 128;
        if (!isNaN(parseInt(React.findDOMNode(this.refs.ProfileWidth).value, 10))) {
            profileWidth = parseInt(React.findDOMNode(this.refs.ProfileWidth).value, 10);
        }
        config.ImageSettings.ProfileWidth = profileWidth;
        React.findDOMNode(this.refs.ProfileWidth).value = profileWidth;

        var profileHeight = 128;
        if (!isNaN(parseInt(React.findDOMNode(this.refs.ProfileHeight).value, 10))) {
            profileHeight = parseInt(React.findDOMNode(this.refs.ProfileHeight).value, 10);
        }
        config.ImageSettings.ProfileHeight = profileHeight;
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
                <h3>{'Image Settings'}</h3>
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
                                defaultValue={this.props.config.ImageSettings.DriverName}
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
                                defaultValue={this.props.config.ImageSettings.Directory}
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
                                defaultValue={this.props.config.ImageSettings.AmazonS3AccessKeyId}
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
                                defaultValue={this.props.config.ImageSettings.AmazonS3SecretAccessKey}
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
                                defaultValue={this.props.config.ImageSettings.AmazonS3Bucket}
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
                                defaultValue={this.props.config.ImageSettings.AmazonS3Region}
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
                                defaultValue={this.props.config.ImageSettings.ThumbnailWidth}
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
                                defaultValue={this.props.config.ImageSettings.ThumbnailHeight}
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
                                defaultValue={this.props.config.ImageSettings.PreviewWidth}
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
                                defaultValue={this.props.config.ImageSettings.PreviewHeight}
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
                                defaultValue={this.props.config.ImageSettings.ProfileWidth}
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
                                defaultValue={this.props.config.ImageSettings.ProfileHeight}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{'Height of profile picture.'}</p>
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

ImageSettings.propTypes = {
    config: React.PropTypes.object
};
