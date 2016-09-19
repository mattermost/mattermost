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
        if (this.props.fileInfos && this.props.fileInfos.length > 0) {
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
        } else if (this.props.fileIds && this.props.fileIds.length > 0) {
            for (let i = 0; i < this.props.fileIds.length && i < Constants.MAX_DISPLAY_FILES; i++) {
                // Add a placeholder to avoid pop-in once we get the file infos for this post
                postFiles.push(<div className='post-image__column post-image__column--placeholder'/>);
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
    fileIds: React.PropTypes.arrayOf(React.PropTypes.string).isRequired,
    fileInfos: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    compactDisplay: React.PropTypes.bool
};
