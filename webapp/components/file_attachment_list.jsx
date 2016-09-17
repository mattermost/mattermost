// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ViewImageModal from './view_image.jsx';
import FileAttachment from './file_attachment.jsx';
import Constants from 'utils/constants.jsx';

import React from 'react';

export default class FileAttachmentList extends React.Component {
    constructor(props) {
        super(props);

        this.handleImageClick = this.handleImageClick.bind(this);

        this.state = {showPreviewModal: false, startImgIndex: 0};
    }

    handleImageClick(indexClicked) {
        this.setState({showPreviewModal: true, startImgIndex: indexClicked});
    }

    render() {
        const postFiles = [];
        if (this.props.fileInfos) {
            for (let i = 0; i < this.props.fileInfos.length && i < Constants.MAX_DISPLAY_FILES; i++) {
                const fileInfo = this.props.fileInfos[i];

                postFiles.push(
                    <FileAttachment
                        key={fileInfo.id}
                        fileInfo={this.props.fileInfos[i]}
                        index={i}
                        handleImageClick={this.handleImageClick}
                        compactDisplay={this.props.compactDisplay}
                    />
                );
            }
        }

        return (
            <div>
                <div className='post-image__columns'>
                    {postFiles}
                </div>
                <ViewImageModal
                    show={this.state.showPreviewModal}
                    onModalDismissed={() => this.setState({showPreviewModal: false})}
                    startId={this.state.startImgIndex}
                    fileInfos={this.props.fileInfos}
                />
            </div>
        );
    }
}

FileAttachmentList.propTypes = {
    fileInfos: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    compactDisplay: React.PropTypes.bool
};
