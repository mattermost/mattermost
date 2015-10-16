// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../utils/client.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var Textbox = require('./textbox.jsx');
var BrowserStore = require('../stores/browser_store.jsx');
var PostStore = require('../stores/post_store.jsx');

export default class EditPostModal extends React.Component {
    constructor() {
        super();

        this.handleEdit = this.handleEdit.bind(this);
        this.handleEditInput = this.handleEditInput.bind(this);
        this.handleEditKeyPress = this.handleEditKeyPress.bind(this);
        this.handleUserInput = this.handleUserInput.bind(this);
        this.handleEditPostEvent = this.handleEditPostEvent.bind(this);

        this.state = {editText: '', title: '', post_id: '', channel_id: '', comments: 0, refocusId: ''};
    }
    handleEdit() {
        var updatedPost = {};
        updatedPost.message = this.state.editText.trim();

        if (updatedPost.message.length === 0) {
            var tempState = this.state;
            delete tempState.editText;
            BrowserStore.setItem('edit_state_transfer', tempState);
            $('#edit_post').modal('hide');
            $('#delete_post').modal('show');
            return;
        }

        updatedPost.id = this.state.post_id;
        updatedPost.channel_id = this.state.channel_id;

        Client.updatePost(updatedPost,
            function success() {
                AsyncClient.getPosts(updatedPost.channel_id);
                window.scrollTo(0, 0);
            },
            function error(err) {
                AsyncClient.dispatchError(err, 'updatePost');
            }
        );

        $('#edit_post').modal('hide');
    }
    handleEditInput(editMessage) {
        this.setState({editText: editMessage});
    }
    handleEditKeyPress(e) {
        if (e.which === 13 && !e.shiftKey && !e.altKey) {
            e.preventDefault();
            ReactDOM.findDOMNode(this.refs.editbox).blur();
            this.handleEdit(e);
        }
    }
    handleUserInput(e) {
        this.setState({editText: e.target.value});
    }
    handleEditPostEvent(options) {
        this.setState({
            editText: options.message || '',
            title: options.title || '',
            post_id: options.postId || '',
            channel_id: options.channelId || '',
            comments: options.comments || 0,
            refocusId: options.refocusId || ''
        });

        $(ReactDOM.findDOMNode(this.refs.modal)).modal('show');
    }
    componentDidMount() {
        var self = this;

        $(ReactDOM.findDOMNode(this.refs.modal)).on('hidden.bs.modal', function onHidden() {
            self.setState({editText: '', title: '', channel_id: '', post_id: '', comments: 0, refocusId: '', error: ''});
        });

        $(ReactDOM.findDOMNode(this.refs.modal)).on('show.bs.modal', function onShow(e) {
            var button = e.relatedTarget;
            if (!button) {
                return;
            }
            self.setState({editText: $(button).attr('data-message'), title: $(button).attr('data-title'), channel_id: $(button).attr('data-channelid'), post_id: $(button).attr('data-postid'), comments: $(button).attr('data-comments'), refocusId: $(button).attr('data-refoucsid')});
        });

        $(ReactDOM.findDOMNode(this.refs.modal)).on('shown.bs.modal', function onShown() {
            self.refs.editbox.resize();
            $('#edit_textbox').get(0).focus();
        });

        $(ReactDOM.findDOMNode(this.refs.modal)).on('hide.bs.modal', function onShown() {
            if (self.state.refocusId !== '') {
                setTimeout(() => {
                    $(self.state.refocusId).get(0).focus();
                });
            }
        });

        PostStore.addEditPostListener(this.handleEditPostEvent);
    }
    componentWillUnmount() {
        PostStore.removeEditPostListener(this.handleEditPostEvent);
    }
    render() {
        var error = (<div className='form-group'><br /></div>);
        if (this.state.error) {
            error = (<div className='form-group has-error'><br /><label className='control-label'>{this.state.error}</label></div>);
        }

        return (
            <div
                className='modal fade edit-modal'
                ref='modal'
                id='edit_post'
                role='dialog'
                tabIndex='-1'
                aria-hidden='true'
            >
                <div className='modal-dialog modal-push-down'>
                    <div className='modal-content'>
                        <div className='modal-header'>
                            <button
                                type='button'
                                className='close'
                                data-dismiss='modal'
                                aria-label='Close'
                                onClick={this.handleEditClose}
                            >
                                <span aria-hidden='true'>&times;</span>
                            </button>
                        <h4 className='modal-title'>Edit {this.state.title}</h4>
                        </div>
                        <div className='edit-modal-body modal-body'>
                            <Textbox
                                onUserInput={this.handleEditInput}
                                onKeyPress={this.handleEditKeyPress}
                                messageText={this.state.editText}
                                createMessage='Edit the post...'
                                id='edit_textbox'
                                ref='editbox'
                            />
                            {error}
                        </div>
                        <div className='modal-footer'>
                            <button
                                type='button'
                                className='btn btn-default'
                                data-dismiss='modal'
                            >
                                Cancel
                            </button>
                            <button
                                type='button'
                                className='btn btn-primary'
                                onClick={this.handleEdit}
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
