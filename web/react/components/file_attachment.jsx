// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var utils = require('../utils/utils.jsx');
var Client = require('../utils/client.jsx');
var Constants = require('../utils/constants.jsx');

export default class FileAttachment extends React.Component {
    constructor(props) {
        super(props);

        this.loadFiles = this.loadFiles.bind(this);

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
            var fileInfo = utils.splitFileLocation(filename);
            var type = utils.getFileType(fileInfo.ext);

            // This is a temporary patch to fix issue with old files using absolute paths
            if (fileInfo.path.indexOf('/api/v1/files/get') !== -1) {
                fileInfo.path = fileInfo.path.split('/api/v1/files/get')[1];
            }
            fileInfo.path = utils.getWindowLocationOrigin() + '/api/v1/files/get' + fileInfo.path;

            if (type === 'image') {
                var self = this; // Need this reference since we use the given "this"
                $('<img/>').attr('src', fileInfo.path + '_thumb.jpg').load(function loadWrapper(path, name) {
                    return function loader() {
                        $(this).remove();
                        if (name in self.refs) {
                            var imgDiv = React.findDOMNode(self.refs[name]);

                            $(imgDiv).removeClass('post__load');
                            $(imgDiv).addClass('post__image');

                            var width = this.width || $(this).width();
                            var height = this.height || $(this).height();

                            if (width < Constants.THUMBNAIL_WIDTH &&
                                height < Constants.THUMBNAIL_HEIGHT) {
                                $(imgDiv).addClass('small');
                            } else {
                                $(imgDiv).addClass('normal');
                            }

                            var re1 = new RegExp(' ', 'g');
                            var re2 = new RegExp('\\(', 'g');
                            var re3 = new RegExp('\\)', 'g');
                            var url = path.replace(re1, '%20').replace(re2, '%28').replace(re3, '%29');
                            $(imgDiv).css('background-image', 'url(' + url + '_thumb.jpg)');
                        }
                    };
                }(fileInfo.path, filename));
            }
        }
    }
    componentWillUnmount() {
        // keep track of when this component is mounted so that we can asynchronously change state without worrying about whether or not we're mounted
        this.canSetState = false;
    }
    shouldComponentUpdate(nextProps, nextState) {
        if (!utils.areStatesEqual(nextProps, this.props)) {
            return true;
        }

        // the only time this object should update is when it receives an updated file size which we can usually handle without re-rendering
        if (nextState.fileSize !== this.state.fileSize) {
            if (this.refs.fileSize) {
                // update the UI element to display the file size without re-rendering the whole component
                React.findDOMNode(this.refs.fileSize).innerHTML = utils.fileSizeToString(nextState.fileSize);

                return false;
            }

            // we can't find the element that should hold the file size so we must not have rendered yet
            return true;
        }

        return true;
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
                    className='post__load'
                    style={{backgroundImage: 'url(/static/images/load.gif)'}}
                />
            );
        } else {
            thumbnail = <div className={'file-icon ' + utils.getIconClassName(type)}/>;
        }

        var fileSizeString = '';
        if (this.state.fileSize < 0) {
            Client.getFileInfo(
                filename,
                function success(data) {
                    if (this.canSetState) {
                        this.setState({fileSize: parseInt(data.size, 10)});
                    }
                }.bind(this),
                function error() {}
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

        return (
            <div
                className='post-image__column'
                key={filename}
            >
                <a className='post-image__thumbnail'
                    href='#'
                    onClick={() => this.props.handleImageClick(this.props.index)}
                >
                    {thumbnail}
                </a>
                <div className='post-image__details'>
                    <a
                        href={fileUrl}
                        download={filenameString}
                        data-toggle='tooltip'
                        title={filenameString}
                        className='post-image__name'
                    >
                        {trimmedFilename}
                    </a>
                    <div>
                        <a
                            href={fileUrl}
                            download={filenameString}
                            className='post-image__download'
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

    // a list of file pathes displayed by the parent FileAttachmentList
    filename: React.PropTypes.string.isRequired,

    // the index of this attachment preview in the parent FileAttachmentList
    index: React.PropTypes.number.isRequired,

    // handler for when the thumbnail is clicked passed the index above
    handleImageClick: React.PropTypes.func
};
