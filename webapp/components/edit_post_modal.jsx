// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Textbox from './textbox.jsx';

import BrowserStore from 'stores/browser_store.jsx';
import PostStore from 'stores/post_store.jsx';
import MessageHistoryStore from 'stores/message_history_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';

import * as GlobalActions from 'actions/global_actions.jsx';
import {updatePost} from 'actions/post_actions.jsx';

import * as UserAgent from 'utils/user_agent.jsx';
import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';
const KeyCodes = Constants.KeyCodes;

import $ from 'jquery';
import React from 'react';
import ReactDOM from 'react-dom';
import {FormattedMessage} from 'react-intl';

import store from 'stores/redux_store.jsx';
const getState = store.getState;

import * as Selectors from 'mattermost-redux/selectors/entities/posts';

export default class EditPostModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleEdit = this.handleEdit.bind(this);
        this.handleEditKeyPress = this.handleEditKeyPress.bind(this);
        this.handleEditPostEvent = this.handleEditPostEvent.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleChange = this.handleChange.bind(this);
        this.onPreferenceChange = this.onPreferenceChange.bind(this);
        this.onModalHidden = this.onModalHidden.bind(this);
        this.onModalShow = this.onModalShow.bind(this);
        this.onModalShown = this.onModalShown.bind(this);
        this.onModalHide = this.onModalHide.bind(this);
        this.onModalKeyDown = this.onModalKeyDown.bind(this);
        this.handlePostError = this.handlePostError.bind(this);

        this.state = {
            editText: '',
            originalText: '',
            title: '',
            post_id: '',
            channel_id: '',
            comments: 0,
            refocusId: '',
            ctrlSend: PreferenceStore.getBool(Constants.Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter'),
            postError: ''
        };
    }

    handlePostError(postError) {
        if (this.state.postError !== postError) {
            this.setState({postError});
        }
    }

    handleEdit() {
        const updatedPost = {
            message: this.state.editText,
            id: this.state.post_id,
            channel_id: this.state.channel_id
        };

        if (this.state.postError) {
            this.setState({errorClass: 'animation--highlight'});
            setTimeout(() => {
                this.setState({errorClass: null});
            }, Constants.ANIMATION_TIMEOUT);
            return;
        }

        if (updatedPost.message === this.state.originalText) {
            // no changes so just close the modal
            $('#edit_post').modal('hide');
            return;
        }

        MessageHistoryStore.storeMessageInHistory(updatedPost.message);

        if (updatedPost.message.trim().length === 0) {
            var tempState = this.state;
            Reflect.deleteProperty(tempState, 'editText');
            BrowserStore.setItem('edit_state_transfer', tempState);
            $('#edit_post').modal('hide');
            GlobalActions.showDeletePostModal(Selectors.getPost(getState(), this.state.post_id), this.state.comments);
            return;
        }

        updatePost(
            updatedPost,
            () => {
                window.scrollTo(0, 0);
            }
        );

        $('#edit_post').modal('hide');
    }

    handleChange(e) {
        const message = e.target.value;
        this.setState({
            editText: message
        });
    }

    handleEditKeyPress(e) {
        if (!UserAgent.isMobile() && !this.state.ctrlSend && e.which === KeyCodes.ENTER && !e.shiftKey && !e.altKey) {
            e.preventDefault();
            ReactDOM.findDOMNode(this.refs.editbox).blur();
            this.handleEdit();
        } else if (this.state.ctrlSend && e.ctrlKey && e.which === KeyCodes.ENTER) {
            e.preventDefault();
            ReactDOM.findDOMNode(this.refs.editbox).blur();
            this.handleEdit();
        }
    }

    handleEditPostEvent(options) {
        const post = Selectors.getPost(getState(), options.postId);
        if (global.window.mm_license.IsLicensed === 'true') {
            if (global.window.mm_config.AllowEditPost === Constants.ALLOW_EDIT_POST_NEVER) {
                return;
            }
            if (global.window.mm_config.AllowEditPost === Constants.ALLOW_EDIT_POST_TIME_LIMIT) {
                if ((post.create_at + (global.window.mm_config.PostEditTimeLimit * 1000)) < Utils.getTimestamp()) {
                    return;
                }
            }
        }
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
            this.handleEdit();
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

        this.refs.editbox.recalculateSize();
    }

    onModalHide() {
        this.refs.editbox.hidePreview();

        if (this.state.refocusId !== '') {
            setTimeout(() => {
                const element = $(this.state.refocusId).get(0);
                if (element) {
                    element.focus();
                }
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
        const errorBoxClass = 'edit-post-footer' + (this.state.postError ? ' has-error' : '');
        let postError = null;
        if (this.state.postError) {
            const postErrorClass = 'post-error' + (this.state.errorClass ? (' ' + this.state.errorClass) : '');
            postError = (<label className={postErrorClass}>{this.state.postError}</label>);
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
                <div className='modal-dialog modal-push-down modal-xl'>
                    <div className='modal-content'>
                        <div className='modal-header'>
                            <button
                                type='button'
                                className='close'
                                data-dismiss='modal'
                                aria-label='Close'
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
                                onChange={this.handleChange}
                                onKeyPress={this.handleEditKeyPress}
                                onKeyDown={this.handleKeyDown}
                                handlePostError={this.handlePostError}
                                value={this.state.editText}
                                channelId={this.state.channel_id}
                                createMessage={Utils.localizeMessage('edit_post.editPost', 'Edit the post...')}
                                supportsCommands={false}
                                suggestionListStyle='bottom'
                                id='edit_textbox'
                                ref='editbox'
                            />
                            <div className={errorBoxClass}>
                                {postError}
                            </div>
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
