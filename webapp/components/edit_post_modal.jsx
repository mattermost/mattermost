// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import ReactDOM from 'react-dom';
import Client from 'client/web_client.jsx';
import * as AsyncClient from 'utils/async_client.jsx';
import * as GlobalActions from 'actions/global_actions.jsx';
import Textbox from './textbox.jsx';
import BrowserStore from 'stores/browser_store.jsx';
import PostStore from 'stores/post_store.jsx';
import MessageHistoryStore from 'stores/message_history_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';
import * as Utils from 'utils/utils.jsx';

import Constants from 'utils/constants.jsx';

import {FormattedMessage} from 'react-intl';

var KeyCodes = Constants.KeyCodes;

import React from 'react';

export default class EditPostModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleEdit = this.handleEdit.bind(this);
        this.handleEditKeyPress = this.handleEditKeyPress.bind(this);
        this.handleEditPostEvent = this.handleEditPostEvent.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleInput = this.handleInput.bind(this);
        this.onPreferenceChange = this.onPreferenceChange.bind(this);
        this.onModalHidden = this.onModalHidden.bind(this);
        this.onModalShow = this.onModalShow.bind(this);
        this.onModalShown = this.onModalShown.bind(this);
        this.onModalHide = this.onModalHide.bind(this);
        this.onModalKeyDown = this.onModalKeyDown.bind(this);

        this.state = {editText: '', originalText: '', title: '', post_id: '', channel_id: '', comments: 0, refocusId: ''};
    }

    handleEdit() {
        var updatedPost = {};
        updatedPost.message = this.state.editText.trim();

        if (updatedPost.message === this.state.originalText.trim()) {
            // no changes so just close the modal
            $('#edit_post').modal('hide');
            return;
        }

        MessageHistoryStore.storeMessageInHistory(updatedPost.message);

        if (updatedPost.message.length === 0) {
            var tempState = this.state;
            Reflect.deleteProperty(tempState, 'editText');
            BrowserStore.setItem('edit_state_transfer', tempState);
            $('#edit_post').modal('hide');
            GlobalActions.showDeletePostModal(PostStore.getPost(this.state.channel_id, this.state.post_id), this.state.comments);
            return;
        }

        updatedPost.id = this.state.post_id;
        updatedPost.channel_id = this.state.channel_id;

        Client.updatePost(
            updatedPost,
            () => {
                AsyncClient.getPosts(updatedPost.channel_id);
                window.scrollTo(0, 0);
            },
            (err) => {
                AsyncClient.dispatchError(err, 'updatePost');
            }
        );

        $('#edit_post').modal('hide');
    }

    handleInput(e) {
        this.setState({
            editText: e.target.value
        });
    }

    handleEditKeyPress(e) {
        if (!this.state.ctrlSend && e.which === KeyCodes.ENTER && !e.shiftKey && !e.altKey) {
            e.preventDefault();
            ReactDOM.findDOMNode(this.refs.editbox).blur();
            this.handleEdit(e);
        } else if (this.state.ctrlSend && e.ctrlKey && e.which === KeyCodes.ENTER) {
            e.preventDefault();
            ReactDOM.findDOMNode(this.refs.editbox).blur();
            this.handleSubmit(e);
        }
    }

    handleEditPostEvent(options) {
        this.setState({
            editText: options.message || '',
            originalText: options.message || '',
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

    onModalHidden() {
        this.setState({editText: '', originalText: '', title: '', channel_id: '', post_id: '', comments: 0, refocusId: '', error: '', typing: false});
    }

    onModalShow(e) {
        var button = e.relatedTarget;
        if (!button) {
            return;
        }
        this.setState({
            editText: $(button).attr('data-message'),
            originalText: $(button).attr('data-message'),
            title: $(button).attr('data-title'),
            channel_id: $(button).attr('data-channelid'),
            post_id: $(button).attr('data-postid'),
            comments: $(button).attr('data-comments'),
            refocusId: $(button).attr('data-refocusid'),
            typing: false
        });
    }

    onModalShown() {
        this.refs.editbox.focus();
    }

    onModalHide() {
        if (this.state.refocusId !== '') {
            setTimeout(() => {
                $(this.state.refocusId).get(0).focus();
            });
        }
    }

    onModalKeyDown(e) {
        if (e.which === Constants.KeyCodes.ESCAPE) {
            e.stopPropagation();
        }
    }

    componentDidMount() {
        $(this.refs.modal).on('hidden.bs.modal', this.onModalHidden);
        $(this.refs.modal).on('show.bs.modal', this.onModalShow);
        $(this.refs.modal).on('shown.bs.modal', this.onModalShown);
        $(this.refs.modal).on('hide.bs.modal', this.onModalHide);
        $(this.refs.modal).on('keydown', this.onModalKeyDown);
        PostStore.addEditPostListener(this.handleEditPostEvent);
        PreferenceStore.addChangeListener(this.onPreferenceChange);
    }

    componentWillUnmount() {
        $(this.refs.modal).off('hidden.bs.modal', this.onModalHidden);
        $(this.refs.modal).off('show.bs.modal', this.onModalShow);
        $(this.refs.modal).off('shown.bs.modal', this.onModalShown);
        $(this.refs.modal).off('hide.bs.modal', this.onModalHide);
        $(this.refs.modal).off('keydown', this.onModalKeyDown);
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
                                <span aria-hidden='true'>{'×'}</span>
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
                                onInput={this.handleInput}
                                onKeyPress={this.handleEditKeyPress}
                                onKeyDown={this.handleKeyDown}
                                messageText={this.state.editText}
                                createMessage={Utils.localizeMessage('edit_post.editPost', 'Edit the post...')}
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
