// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ReactDOM from 'react-dom';
import * as Utils from 'utils/utils.jsx';

import React from 'react';

import loadingGif from 'images/load.gif';

export default class FilePreview extends React.Component {
    constructor(props) {
        super(props);

        this.handleRemove = this.handleRemove.bind(this);
    }

    componentDidUpdate() {
        if (this.props.uploadsInProgress.length > 0) {
            ReactDOM.findDOMNode(this.refs[this.props.uploadsInProgress[0]]).scrollIntoView();
        }
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
        this.props.files.forEach((fullFilename) => {
            var filename = fullFilename;
            var originalFilename = filename;
            var filenameSplit = filename.split('.');
            var ext = filenameSplit[filenameSplit.length - 1];
            var type = Utils.getFileType(ext);

            filename = Utils.getFileUrl(filename);

            if (type === 'image') {
                previews.push(
                    <div
                        key={filename}
                        className='file-preview'
                        data-filename={originalFilename}
                    >
                        <img
                            className='file-preview__image'
                            src={filename}
                        />
                        <a
                            className='file-preview__remove'
                            onClick={this.handleRemove}
                        >
                            <i className='fa fa-remove'/>
                        </a>
                    </div>
                );
            } else {
                previews.push(
                    <div
                        key={filename}
                        className='file-preview custom-file'
                        data-filename={originalFilename}
                    >
                        <div className={'file-icon ' + Utils.getIconClassName(type)}/>
                        <a
                            className='file-preview__remove'
                            onClick={this.handleRemove}
                        >
                            <i className='fa fa-remove'/>
                        </a>
                    </div>
                );
            }
        });

        this.props.uploadsInProgress.forEach((clientId) => {
            previews.push(
                <div
                    ref={clientId}
                    key={clientId}
                    className='file-preview'
                    data-client-id={clientId}
                >
                    <img
                        className='spinner'
                        src={loadingGif}
                    />
                    <a
                        className='file-preview__remove'
                        onClick={this.handleRemove}
                    >
                        <i className='fa fa-remove'/>
                    </a>
                </div>
            );
        });

        return (
            <div className='file-preview__container'>
                {previews}
            </div>
        );
    }
}

FilePreview.defaultProps = {
    files: [],
    uploadsInProgress: []
};
FilePreview.propTypes = {
    onRemove: React.PropTypes.func.isRequired,
    files: React.PropTypes.array,
    uploadsInProgress: React.PropTypes.array
};
