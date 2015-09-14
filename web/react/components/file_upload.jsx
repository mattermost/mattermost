// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var client = require('../utils/client.jsx');
var Constants = require('../utils/constants.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var utils = require('../utils/utils.jsx');

export default class FileUpload extends React.Component {
    constructor(props) {
        super(props);

        this.uploadFiles = this.uploadFiles.bind(this);
        this.handleChange = this.handleChange.bind(this);
        this.handleDrop = this.handleDrop.bind(this);

        this.state = {
            requests: {}
        };
    }

    fileUploadSuccess(channelId, data) {
        var parsedData = $.parseJSON(data);
        this.props.onFileUpload(parsedData.filenames, parsedData.client_ids, channelId);

        var requests = this.state.requests;
        for (var j = 0; j < parsedData.client_ids.length; j++) {
            delete requests[parsedData.client_ids[j]];
        }
        this.setState({requests: requests});
    }

    fileUploadFail(clientId, err) {
        this.props.onUploadError(err, clientId);
    }

    uploadFiles(files) {
        // clear any existing errors
        this.props.onUploadError(null);

        var channelId = this.props.channelId || ChannelStore.getCurrentId();

        var uploadsRemaining = Constants.MAX_UPLOAD_FILES - this.props.getFileCount(channelId);
        var numUploads = 0;

        // keep track of how many files have been too large
        var tooLargeFiles = [];

        for (let i = 0; i < files.length && numUploads < uploadsRemaining; i++) {
            if (files[i].size > Constants.MAX_FILE_SIZE) {
                tooLargeFiles.push(files[i]);
                continue;
            }

            // generate a unique id that can be used by other components to refer back to this upload
            let clientId = utils.generateId();

            // prepare data to be uploaded
            var formData = new FormData();
            formData.append('channel_id', channelId);
            formData.append('files', files[i], files[i].name);
            formData.append('client_ids', clientId);

            var request = client.uploadFile(formData,
                this.fileUploadSuccess.bind(this, channelId),
                this.fileUploadFail.bind(this, clientId)
            );

            var requests = this.state.requests;
            requests[clientId] = request;
            this.setState({requests: requests});

            this.props.onUploadStart([clientId], channelId);

            numUploads += 1;
        }

        if (files.length > uploadsRemaining) {
            this.props.onUploadError(`Uploads limited to ${Constants.MAX_UPLOAD_FILES} files maximum. Please use additional posts for more files.`);
        } else if (tooLargeFiles.length > 1) {
            var tooLargeFilenames = tooLargeFiles.map((file) => file.name).join(', ');

            this.props.onUploadError(`Files above ${Constants.MAX_FILE_SIZE / 1000000}MB could not be uploaded: ${tooLargeFilenames}`);
        } else if (tooLargeFiles.length > 0) {
            this.props.onUploadError(`File above ${Constants.MAX_FILE_SIZE / 1000000}MB could not be uploaded: ${tooLargeFiles[0].name}`);
        }
    }

    handleChange() {
        var element = $(React.findDOMNode(this.refs.fileInput));

        this.uploadFiles(element.prop('files'));

        // clear file input for all modern browsers
        try {
            element[0].value = '';
            if (element.value) {
                element[0].type = 'text';
                element[0].type = 'file';
            }
        } catch(e) {
            // Do nothing
        }
    }

    handleDrop(e) {
        this.props.onUploadError(null);

        var files = e.originalEvent.dataTransfer.files;

        if (typeof files !== 'string' && files.length) {
            this.uploadFiles(files);
        } else {
            this.props.onUploadError('Invalid file upload', -1);
        }
    }

    componentDidMount() {
        var inputDiv = React.findDOMNode(this.refs.input);
        var self = this;

        if (this.props.postType === 'post') {
            $('.row.main').dragster({
                enter() {
                    $('.center-file-overlay').removeClass('hidden');
                },
                leave() {
                    $('.center-file-overlay').addClass('hidden');
                },
                drop(dragsterEvent, e) {
                    $('.center-file-overlay').addClass('hidden');
                    self.handleDrop(e);
                }
            });
        } else if (this.props.postType === 'comment') {
            $('.post-right__container').dragster({
                enter() {
                    $('.right-file-overlay').removeClass('hidden');
                },
                leave() {
                    $('.right-file-overlay').addClass('hidden');
                },
                drop(dragsterEvent, e) {
                    $('.right-file-overlay').addClass('hidden');
                    self.handleDrop(e);
                }
            });
        }

        document.addEventListener('paste', function handlePaste(e) {
            var textarea = $(inputDiv.parentNode.parentNode).find('.custom-textarea')[0];

            if (textarea !== e.target && !$.contains(textarea, e.target)) {
                return;
            }

            self.props.onUploadError(null);

            // This looks redundant, but must be done this way due to
            // setState being an asynchronous call
            var items = e.clipboardData.items;
            var numItems = 0;
            if (items) {
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                        var testExt = items[i].type.split('/')[1].toLowerCase();

                        if (Constants.IMAGE_TYPES.indexOf(testExt) < 0) {
                            continue;
                        }

                        numItems++;
                    }
                }

                var numToUpload = Math.min(Constants.MAX_UPLOAD_FILES - self.props.getFileCount(ChannelStore.getCurrentId()), numItems);

                if (numItems > numToUpload) {
                    self.props.onUploadError('Uploads limited to ' + Constants.MAX_UPLOAD_FILES + ' files maximum. Please use additional posts for more files.');
                }

                for (var i = 0; i < items.length && i < numToUpload; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                        var file = items[i].getAsFile();

                        var ext = items[i].type.split('/')[1].toLowerCase();

                        if (Constants.IMAGE_TYPES.indexOf(ext) < 0) {
                            continue;
                        }

                        var channelId = self.props.channelId || ChannelStore.getCurrentId();

                        // generate a unique id that can be used by other components to refer back to this file upload
                        var clientId = utils.generateId();

                        var formData = new FormData();
                        formData.append('channel_id', channelId);
                        var d = new Date();
                        var hour;
                        if (d.getHours() < 10) {
                            hour = '0' + d.getHours();
                        } else {
                            hour = String(d.getHours());
                        }
                        var min;
                        if (d.getMinutes() < 10) {
                            min = '0' + d.getMinutes();
                        } else {
                            min = String(d.getMinutes());
                        }

                        var name = 'Image Pasted at ' + d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate() + ' ' + hour + '-' + min + '.' + ext;
                        formData.append('files', file, name);
                        formData.append('client_ids', clientId);

                        var request = client.uploadFile(formData,
                            self.fileUploadSuccess.bind(self, channelId),
                            self.fileUploadFail.bind(self, clientId)
                        );

                        var requests = self.state.requests;
                        requests[clientId] = request;
                        self.setState({requests: requests});

                        self.props.onUploadStart([clientId], channelId);
                    }
                }
            }
        });
    }

    cancelUpload(clientId) {
        var requests = this.state.requests;
        var request = requests[clientId];

        if (request) {
            request.abort();

            delete requests[clientId];
            this.setState({requests: requests});
        }
    }

    render() {
        return (
            <span
                ref='input'
                className='btn btn-file'
            >
                <span>
                    <i className='glyphicon glyphicon-paperclip' />
                </span>
                <input
                    ref='fileInput'
                    type='file'
                    onChange={this.handleChange}
                    multiple='true'
                />
            </span>
        );
    }
}

FileUpload.propTypes = {
    onUploadError: React.PropTypes.func,
    getFileCount: React.PropTypes.func,
    onFileUpload: React.PropTypes.func,
    onUploadStart: React.PropTypes.func,
    channelId: React.PropTypes.string,
    postType: React.PropTypes.string
};
