// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import FileAttachment from 'components/file_attachment.jsx';

import ReactDOM from 'react-dom';

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

    handleRemove(id) {
        this.props.onRemove(id);
    }

    render() {
        var previews = [];
        this.props.fileInfos.forEach((info) => {
            previews.push(
                <FileAttachment
                    key={info.id}
                    fileInfo={info}
                    displayType='preview'
                    handleRemoveClick={this.handleRemove.bind(this, info.id)}
                />
            );
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
                        onClick={this.handleRemove.bind(this, clientId)}
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
    fileInfos: [],
    uploadsInProgress: []
};
FilePreview.propTypes = {
    onRemove: React.PropTypes.func.isRequired,
    fileInfos: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    uploadsInProgress: React.PropTypes.array
};
