// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Client from '../utils/client.jsx';
import * as AsyncClient from '../utils/async_client.jsx';
import * as GlobalActions from '../action_creators/global_actions.jsx';
import Textbox from './textbox.jsx';
import BrowserStore from '../stores/browser_store.jsx';
import PostStore from '../stores/post_store.jsx';
import PreferenceStore from '../stores/preference_store.jsx';

import Constants from '../utils/constants.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'mm-intl';

var KeyCodes = Constants.KeyCodes;

const holders = defineMessages({
    editPost: {
        id: 'edit_post.editPost',
        defaultMessage: 'Edit the post...'
    }
});

class EditPostModal extends React.Component {
    constructor() {
        super();

        this.handleEdit = this.handleEdit.bind(this);
        this.handleEditInput = this.handleEditInput.bind(this);
        this.handleEditKeyPress = this.handleEditKeyPress.bind(this);
        this.handleUserInput = this.handleUserInput.bind(this);
        this.handleEditPostEvent = this.handleEditPostEvent.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.onPreferenceChange = this.onPreferenceChange.bind(this);

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
            GlobalActions.showDeletePostModal(PostStore.getPost(this.state.channel_id, this.state.post_id), this.state.comments);
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
        if (!this.state.ctrlSend && e.which === KeyCodes.ENTER && !e.shiftKey && !e.altKey) {
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
    handleKeyDown(e) {
        if (this.state.ctrlSend && e.keyCode === KeyCodes.ENTER && e.ctrlKey === true) {
            this.handleEdit(e);
        }
    }
    onPreferenceChange() {
        this.setState({
            ctrlSend: PreferenceStore.getBool(Constants.Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter')
        });
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
            self.setState({editText: $(button).attr('data-message'), title: $(button).attr('data-title'), channel_id: $(button).attr('data-channelid'), post_id: $(button).attr('data-postid'), comments: $(button).attr('data-comments'), refocusId: $(button).attr('data-refocusid')});
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
        PreferenceStore.addChangeListener(this.onPreferenceChange);
    }
    componentWillUnmount() {
        PostStore.removeEditPostListner(this.handleEditPostEvent);
        PreferenceStore.removeChangeListener(this.onPreferenceChange);
    }
    render() {
        var error = (<div className='form-group'><br/></div>);
        if (this.state.error) {
            error = (<div className='form-group has-error'><br/><label className='control-label'>{this.state.error}</label></div>);
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
                        <h4 className='modal-title'>
                            <FormattedMessage
                                id='edit_post.edit'
                                defaultMessage='Edit {title}'
                                values={{
                                    title: this.state.title
                                }}
                            />
                        </h4>
                        </div>
                        <div className='edit-modal-body modal-body'>
                            <Textbox
                                onUserInput={this.handleEditInput}
                                onKeyPress={this.handleEditKeyPress}
                                onKeyDown={this.handleKeyDown}
                                messageText={this.state.editText}
                                createMessage={this.props.intl.formatMessage(holders.editPost)}
                                supportsCommands={false}
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
                                <FormattedMessage
                                    id='edit_post.cancel'
                                    defaultMessage='Cancel'
                                />
                            </button>
                            <button
                                type='button'
                                className='btn btn-primary'
                                onClick={this.handleEdit}
                            >
                                <FormattedMessage
                                    id='edit_post.save'
                                    defaultMessage='Save'
                                />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

EditPostModal.propTypes = {
    intl: intlShape.isRequired
};

export default injectIntl(EditPostModal);