// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var Utils = require('../utils/utils.jsx');

export default class FilePreview extends React.Component {
    constructor(props) {
        super(props);

        this.handleRemove = this.handleRemove.bind(this);

        this.state = {};
    }
    handleRemove(e) {
        var previewDiv = e.target.parentNode.parentNode;

        if (previewDiv.hasAttribute('data-filename')) {
            this.props.onRemove(previewDiv.getAttribute('data-filename'));
        } else if (previewDiv.hasAttribute('data-client-id')) {
            this.props.onRemove(previewDiv.getAttribute('data-client-id'));
        }
    }
    render() {
        var previews = [];
        this.props.files.forEach(function setupPreview(fullFilename) {
            var filename = fullFilename;
            var originalFilename = filename;
            var filenameSplit = filename.split('.');
            var ext = filenameSplit[filenameSplit.length - 1];
            var type = Utils.getFileType(ext);

            // This is a temporary patch to fix issue with old files using absolute paths

            if (filename.indexOf('/api/v1/files/get') !== -1) {
                filename = filename.split('/api/v1/files/get')[1];
            }
            filename = Utils.getWindowLocationOrigin() + '/api/v1/files/get' + filename;

            if (type === 'image') {
                previews.push(
                    <div
                        key={filename}
                        className='preview-div'
                        data-filename={originalFilename}
                    >
                        <img
                            className='preview-img'
                            src={filename}
                        />
                        <a
                            className='remove-preview'
                            onClick={this.handleRemove}
                        >
                            <i className='glyphicon glyphicon-remove'/>
                        </a>
                    </div>
                );
            } else {
                previews.push(
                    <div
                        key={filename}
                        className='preview-div custom-file'
                        data-filename={originalFilename}
                    >
                        <div className={'file-icon ' + Utils.getIconClassName(type)}/>
                        <a
                            className='remove-preview'
                            onClick={this.handleRemove}
                        >
                            <i className='glyphicon glyphicon-remove'/>
                        </a>
                    </div>
                );
            }
        }.bind(this));

        this.props.uploadsInProgress.forEach(function addUploadsInProgress(clientId) {
            previews.push(
                <div
                    key={clientId}
                    className='preview-div'
                    data-client-id={clientId}
                >
                    <img
                        className='spinner'
                        src='/static/images/load.gif'
                    />
                    <a
                        className='remove-preview'
                        onClick={this.handleRemove}
                    >
                        <i className='glyphicon glyphicon-remove'/>
                    </a>
                </div>
            );
        }.bind(this));

        return (
            <div className='preview-container'>
                {previews}
            </div>
        );
    }
}

FilePreview.defaultProps = {
    files: null,
    uploadsInProgress: null
};
FilePreview.propTypes = {
    onRemove: React.PropTypes.func.isRequired,
    files: React.PropTypes.array,
    uploadsInProgress: React.PropTypes.array
};
