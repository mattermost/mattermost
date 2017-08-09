// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ViewImageModal from 'components/view_image.jsx';
import FileAttachment from 'components/file_attachment.jsx';
import Constants from 'utils/constants.jsx';

import PropTypes from 'prop-types';

import React from 'react';

export default class FileAttachmentList extends React.Component {
    static propTypes = {

        /*
         * The post the files are attached to
         */
        post: PropTypes.object.isRequired,

        /*
         * The number of files attached to the post
         */
        fileCount: PropTypes.number.isRequired,

        /*
         * Array of metadata for each file attached to the post
         */
        fileInfos: PropTypes.arrayOf(PropTypes.object),

        /*
         * Set to render compactly
         */
        compactDisplay: PropTypes.bool,

        actions: PropTypes.shape({

            /*
             * Function to get file metadata for a post
             */
            getMissingFilesForPost: PropTypes.func.isRequired
        }).isRequired
    }

    constructor(props) {
        super(props);

        this.handleImageClick = this.handleImageClick.bind(this);

        this.state = {showPreviewModal: false, startImgIndex: 0};
    }

    componentDidMount() {
        if (this.props.post.file_ids || this.props.post.filenames) {
            this.props.actions.getMissingFilesForPost(this.props.post.id);
        }
    }

    handleImageClick(indexClicked) {
        this.setState({showPreviewModal: true, startImgIndex: indexClicked});
    }

    render() {
        const postFiles = [];
        let fileInfos = [];
        if (this.props.fileInfos && this.props.fileInfos.length > 0) {
            fileInfos = this.props.fileInfos.sort((a, b) => a.create_at - b.create_at);
            for (let i = 0; i < Math.min(fileInfos.length, Constants.MAX_DISPLAY_FILES); i++) {
                const fileInfo = fileInfos[i];

                postFiles.push(
                    <FileAttachment
                        key={fileInfo.id}
                        fileInfo={fileInfos[i]}
                        index={i}
                        handleImageClick={this.handleImageClick}
                        compactDisplay={this.props.compactDisplay}
                    />
                );
            }
        } else if (this.props.fileCount > 0) {
            for (let i = 0; i < Math.min(this.props.fileCount, Constants.MAX_DISPLAY_FILES); i++) {
                // Add a placeholder to avoid pop-in once we get the file infos for this post
                postFiles.push(
                    <div
                        key={`fileCount-${i}`}
                        className='post-image__column post-image__column--placeholder'
                    />
            );
            }
        }

        return (
            <div>
                <div className='post-image__columns clearfix'>
                    {postFiles}
                </div>
                <ViewImageModal
                    show={this.state.showPreviewModal}
                    onModalDismissed={() => this.setState({showPreviewModal: false})}
                    startId={this.state.startImgIndex}
                    fileInfos={fileInfos}
                />
            </div>
        );
    }
}
