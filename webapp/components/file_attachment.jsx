// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Constants from 'utils/constants.jsx';
import FileStore from 'stores/file_store.jsx';
import * as Utils from 'utils/utils.jsx';

import {Tooltip, OverlayTrigger} from 'react-bootstrap';

import React from 'react';

export default class FileAttachment extends React.Component {
    constructor(props) {
        super(props);

        this.loadFiles = this.loadFiles.bind(this);
        this.onAttachmentClick = this.onAttachmentClick.bind(this);

        this.state = {
            loaded: Utils.getFileType(props.fileInfo.extension) !== 'image'
        };
    }

    componentDidMount() {
        this.loadFiles();
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.fileInfo.id !== this.props.fileInfo.id) {
            this.setState({
                loaded: Utils.getFileType(nextProps.fileInfo.extension) !== 'image'
            });
        }
    }

    componentDidUpdate(prevProps) {
        if (!this.state.loaded && this.props.fileInfo.id !== prevProps.fileInfo.id) {
            this.loadFiles();
        }
    }

    loadFiles() {
        const fileInfo = this.props.fileInfo;
        const fileType = Utils.getFileType(fileInfo.extension);

        if (fileType === 'image') {
            const thumbnailUrl = FileStore.getFileThumbnailUrl(fileInfo.id);

            const img = new Image();
            img.onload = () => {
                this.setState({loaded: true});
            };
            img.load(thumbnailUrl);
        }
    }

    onAttachmentClick(e) {
        e.preventDefault();
        this.props.handleImageClick(this.props.index);
    }

    render() {
        const fileInfo = this.props.fileInfo;
        const fileName = fileInfo.name;
        const fileUrl = FileStore.getFileUrl(fileInfo.id);

        let thumbnail;
        if (this.state.loaded) {
            const type = Utils.getFileType(fileInfo.extension);

            if (type === 'image') {
                let className = 'post-image';

                if (fileInfo.width < Constants.THUMBNAIL_WIDTH && fileInfo.height < Constants.THUMBNAIL_HEIGHT) {
                    className += ' small';
                } else {
                    className += ' normal';
                }

                thumbnail = (
                    <div
                        className={className}
                        style={{
                            backgroundImage: `url(${FileStore.getFileThumbnailUrl(fileInfo.id)})`
                        }}
                    />
                );
            } else {
                thumbnail = <div className={'file-icon ' + Utils.getIconClassName(type)}/>;
            }
        } else {
            thumbnail = <div className='post-image__load'/>;
        }

        let trimmedFilename;
        if (fileName.length > 35) {
            trimmedFilename = fileName.substring(0, Math.min(35, fileName.length)) + '...';
        } else {
            trimmedFilename = fileName;
        }

        let filenameOverlay;
        if (this.props.compactDisplay) {
            filenameOverlay = (
                <OverlayTrigger
                    delayShow={1000}
                    placement='top'
                    overlay={<Tooltip id='file-name__tooltip'>{fileName}</Tooltip>}
                >
                    <a
                        href='#'
                        onClick={this.onAttachmentClick}
                        className='post-image__name'
                        rel='noopener noreferrer'
                    >
                        <span
                            className='icon'
                            dangerouslySetInnerHTML={{__html: Constants.ATTACHMENT_ICON_SVG}}
                        />
                        {trimmedFilename}
                    </a>
                </OverlayTrigger>
            );
        } else {
            filenameOverlay = (
                <OverlayTrigger
                    delayShow={1000}
                    placement='top'
                    overlay={<Tooltip id='file-name__tooltip'>{Utils.localizeMessage('file_attachment.download', 'Download') + ' "' + fileName + '"'}</Tooltip>}
                >
                    <a
                        href={fileUrl}
                        download={fileName}
                        className='post-image__name'
                        target='_blank'
                        rel='noopener noreferrer'
                    >
                        {trimmedFilename}
                    </a>
                </OverlayTrigger>
            );
        }

        return (
            <div className='post-image__column'>
                <a
                    className='post-image__thumbnail'
                    href='#'
                    onClick={this.onAttachmentClick}
                >
                    {thumbnail}
                </a>
                <div className='post-image__details'>
                    {filenameOverlay}
                    <div>
                        <a
                            href={fileUrl}
                            download={fileName}
                            className='post-image__download'
                            target='_blank'
                            rel='noopener noreferrer'
                        >
                            <span className='fa fa-download'/>
                        </a>
                        <span className='post-image__type'>{fileInfo.extension.toUpperCase()}</span>
                        <span className='post-image__size'>{Utils.fileSizeToString(fileInfo.size)}</span>
                    </div>
                </div>
            </div>
        );
    }
}

FileAttachment.propTypes = {
    fileInfo: React.PropTypes.object.isRequired,

    // the index of this attachment preview in the parent FileAttachmentList
    index: React.PropTypes.number.isRequired,

    // handler for when the thumbnail is clicked passed the index above
    handleImageClick: React.PropTypes.func,

    compactDisplay: React.PropTypes.bool
};