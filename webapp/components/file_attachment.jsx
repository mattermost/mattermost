// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import ReactDOM from 'react-dom';
import * as utils from 'utils/utils.jsx';
import Client from 'client/web_client.jsx';
import Constants from 'utils/constants.jsx';

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import {Tooltip, OverlayTrigger} from 'react-bootstrap';

const holders = defineMessages({
    download: {
        id: 'file_attachment.download',
        defaultMessage: 'Download'
    }
});

import React from 'react';

class FileAttachment extends React.Component {
    constructor(props) {
        super(props);

        this.loadFiles = this.loadFiles.bind(this);
        this.addBackgroundImage = this.addBackgroundImage.bind(this);
        this.onAttachmentClick = this.onAttachmentClick.bind(this);

        this.canSetState = false;
        this.state = {fileSize: -1};
    }
    componentDidMount() {
        this.loadFiles();
    }
    componentDidUpdate(prevProps) {
        if (this.props.filename !== prevProps.filename) {
            this.loadFiles();
        }
    }
    loadFiles() {
        this.canSetState = true;

        var filename = this.props.filename;

        if (filename) {
            var fileInfo = this.getFileInfoFromName(filename);
            var type = utils.getFileType(fileInfo.ext);

            if (type === 'image') {
                var self = this; // Need this reference since we use the given "this"
                $('<img/>').attr('src', fileInfo.path + '_thumb.jpg').on('load', (function loadWrapper(path, name) {
                    return function loader() {
                        $(this).remove();
                        if (name in self.refs) {
                            var imgDiv = ReactDOM.findDOMNode(self.refs[name]);

                            $(imgDiv).removeClass('post-image__load');
                            $(imgDiv).addClass('post-image');

                            var width = this.width || $(this).width();
                            var height = this.height || $(this).height();

                            if (width < Constants.THUMBNAIL_WIDTH &&
                                height < Constants.THUMBNAIL_HEIGHT) {
                                $(imgDiv).addClass('small');
                            } else {
                                $(imgDiv).addClass('normal');
                            }

                            self.addBackgroundImage(name, path);
                        }
                    };
                }(fileInfo.path, filename)));
            }
        }
    }
    componentWillUnmount() {
        // keep track of when this component is mounted so that we can asynchronously change state without worrying about whether or not we're mounted
        this.canSetState = false;
    }
    shouldComponentUpdate(nextProps, nextState) {
        if (!utils.areObjectsEqual(nextProps, this.props)) {
            return true;
        }

        // the only time this object should update is when it receives an updated file size which we can usually handle without re-rendering
        if (nextState.fileSize !== this.state.fileSize) {
            if (this.refs.fileSize) {
                // update the UI element to display the file size without re-rendering the whole component
                ReactDOM.findDOMNode(this.refs.fileSize).innerHTML = utils.fileSizeToString(nextState.fileSize);

                return false;
            }

            // we can't find the element that should hold the file size so we must not have rendered yet
            return true;
        }

        return true;
    }
    getFileInfoFromName(name) {
        var fileInfo = utils.splitFileLocation(name);

        fileInfo.path = Client.getFilesRoute() + '/get' + fileInfo.path;

        return fileInfo;
    }
    addBackgroundImage(name, path) {
        var fileUrl = path;

        if (name in this.refs) {
            if (!path) {
                fileUrl = this.getFileInfoFromName(name).path;
            }

            var imgDiv = ReactDOM.findDOMNode(this.refs[name]);
            var re1 = new RegExp(' ', 'g');
            var re2 = new RegExp('\\(', 'g');
            var re3 = new RegExp('\\)', 'g');
            var url = fileUrl.replace(re1, '%20').replace(re2, '%28').replace(re3, '%29');

            $(imgDiv).css('background-image', 'url(' + url + '_thumb.jpg)');
        }
    }
    removeBackgroundImage(name) {
        if (name in this.refs) {
            $(ReactDOM.findDOMNode(this.refs[name])).css('background-image', 'initial');
        }
    }
    onAttachmentClick(e) {
        e.preventDefault();
        this.props.handleImageClick(this.props.index);
    }
    render() {
        var filename = this.props.filename;

        var fileInfo = utils.splitFileLocation(filename);
        var fileUrl = utils.getFileUrl(filename);
        var type = utils.getFileType(fileInfo.ext);

        var thumbnail;
        if (type === 'image') {
            thumbnail = (
                <div
                    ref={filename}
                    className='post-image__load'
                />
            );
        } else {
            thumbnail = <div className={'file-icon ' + utils.getIconClassName(type)}/>;
        }

        var fileSizeString = '';
        if (this.state.fileSize < 0) {
            Client.getFileInfo(
                filename,
                (data) => {
                    if (this.canSetState) {
                        this.setState({fileSize: parseInt(data.size, 10)});
                    }
                },
                () => {
                    // Do nothing
                }
            );
        } else {
            fileSizeString = utils.fileSizeToString(this.state.fileSize);
        }

        var filenameString = decodeURIComponent(utils.getFileName(filename));
        var trimmedFilename;
        if (filenameString.length > 35) {
            trimmedFilename = filenameString.substring(0, Math.min(35, filenameString.length)) + '...';
        } else {
            trimmedFilename = filenameString;
        }
        var filenameOverlay = (
            <OverlayTrigger
                delayShow={1000}
                placement='top'
                overlay={<Tooltip id='file-name__tooltip'>{this.props.intl.formatMessage(holders.download) + ' "' + filenameString + '"'}</Tooltip>}
            >
                <a
                    href={fileUrl}
                    download={filenameString}
                    className='post-image__name'
                    target='_blank'
                    rel='noopener noreferrer'
                >
                    {trimmedFilename}
                </a>
            </OverlayTrigger>
        );

        if (this.props.compactDisplay) {
            filenameOverlay = (
                <OverlayTrigger
                    delayShow={1000}
                    placement='top'
                    overlay={<Tooltip id='file-name__tooltip'>{filenameString}</Tooltip>}
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
        }

        return (
            <div
                className='post-image__column'
                key={filename}
            >
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
                            download={filenameString}
                            className='post-image__download'
                            target='_blank'
                            rel='noopener noreferrer'
                        >
                            <span
                                className='fa fa-download'
                            />
                        </a>
                        <span className='post-image__type'>{fileInfo.ext.toUpperCase()}</span>
                        <span className='post-image__size'>{fileSizeString}</span>
                    </div>
                </div>
            </div>
        );
    }
}

FileAttachment.propTypes = {
    intl: intlShape.isRequired,

    // a list of file pathes displayed by the parent FileAttachmentList
    filename: React.PropTypes.string.isRequired,

    // the index of this attachment preview in the parent FileAttachmentList
    index: React.PropTypes.number.isRequired,

    // handler for when the thumbnail is clicked passed the index above
    handleImageClick: React.PropTypes.func,

    compactDisplay: React.PropTypes.bool
};

export default injectIntl(FileAttachment);
