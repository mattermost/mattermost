// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import MsgTyping from './msg_typing.jsx';
import Textbox from './textbox.jsx';
import FileUpload from './file_upload.jsx';
import FilePreview from './file_preview.jsx';
import TutorialTip from './tutorial/tutorial_tip.jsx';

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import * as EventHelpers from '../dispatcher/event_helpers.jsx';
import * as Client from '../utils/client.jsx';
import * as AsyncClient from '../utils/async_client.jsx';
import * as Utils from '../utils/utils.jsx';

import ChannelStore from '../stores/channel_store.jsx';
import PostStore from '../stores/post_store.jsx';
import UserStore from '../stores/user_store.jsx';
import PreferenceStore from '../stores/preference_store.jsx';
import SocketStore from '../stores/socket_store.jsx';

import Constants from '../utils/constants.jsx';

const Preferences = Constants.Preferences;
const TutorialSteps = Constants.TutorialSteps;
const ActionTypes = Constants.ActionTypes;
const KeyCodes = Constants.KeyCodes;

export default class CreatePost extends React.Component {
    constructor(props) {
        super(props);

        this.lastTime = 0;

        this.getCurrentDraft = this.getCurrentDraft.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.postMsgKeyPress = this.postMsgKeyPress.bind(this);
        this.handleUserInput = this.handleUserInput.bind(this);
        this.resizePostHolder = this.resizePostHolder.bind(this);
        this.handleUploadStart = this.handleUploadStart.bind(this);
        this.handleFileUploadComplete = this.handleFileUploadComplete.bind(this);
        this.handleUploadError = this.handleUploadError.bind(this);
        this.handleTextDrop = this.handleTextDrop.bind(this);
        this.removePreview = this.removePreview.bind(this);
        this.onChange = this.onChange.bind(this);
        this.onPreferenceChange = this.onPreferenceChange.bind(this);
        this.getFileCount = this.getFileCount.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.sendMessage = this.sendMessage.bind(this);

        PostStore.clearDraftUploads();

        const draft = this.getCurrentDraft();
        const tutorialPref = PreferenceStore.getPreference(Preferences.TUTORIAL_STEP, UserStore.getCurrentId(), {value: '999'});

        this.state = {
            channelId: ChannelStore.getCurrentId(),
            messageText: draft.messageText,
            uploadsInProgress: draft.uploadsInProgress,
            previews: draft.previews,
            submitting: false,
            initialText: draft.messageText,
            windowWidth: Utils.windowWidth(),
            windowHeight: Utils.windowHeight(),
            ctrlSend: PreferenceStore.getPreference(Constants.Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter', {value: 'false'}).value,
            showTutorialTip: parseInt(tutorialPref.value, 10) === TutorialSteps.POST_POPOVER
        };

        PreferenceStore.addChangeListener(this.onPreferenceChange);
    }
    handleResize() {
        this.setState({
            windowWidth: Utils.windowWidth(),
            windowHeight: Utils.windowHeight()
        });
    }
    componentDidUpdate(prevProps, prevState) {
        if (prevState.previews.length !== this.state.previews.length) {
            this.resizePostHolder();
            return;
        }

        if (prevState.uploadsInProgress !== this.state.uploadsInProgress) {
            this.resizePostHolder();
            return;
        }

        if (prevState.windowWidth !== this.state.windowWidth || prevState.windowHeight !== this.state.windowHeight) {
            this.resizePostHolder();
            return;
        }
    }
    getCurrentDraft() {
        const draft = PostStore.getCurrentDraft();
        const safeDraft = {previews: [], messageText: '', uploadsInProgress: []};

        if (draft) {
            if (draft.message) {
                safeDraft.messageText = draft.message;
            }
            if (draft.previews) {
                safeDraft.previews = draft.previews;
            }
            if (draft.uploadsInProgress) {
                safeDraft.uploadsInProgress = draft.uploadsInProgress;
            }
        }

        return safeDraft;
    }
    handleSubmit(e) {
        e.preventDefault();

        if (this.state.uploadsInProgress.length > 0 || this.state.submitting) {
            return;
        }

        const post = {};
        post.filenames = [];
        post.message = this.state.messageText;

        if (post.message.trim().length === 0 && this.state.previews.length === 0) {
            return;
        }

        if (post.message.length > Constants.CHARACTER_LIMIT) {
            this.setState({postError: `Post length must be less than ${Constants.CHARACTER_LIMIT} characters.`});
            return;
        }

        this.setState({submitting: true, serverError: null});

        if (post.message.indexOf('/') === 0) {
            Client.executeCommand(
                this.state.channelId,
                post.message,
                false,
                (data) => {
                    if (data.response === 'not implemented') {
                        this.sendMessage(post);
                        return;
                    }

                    PostStore.storeDraft(data.channel_id, null);
                    this.setState({messageText: '', submitting: false, postError: null, previews: [], serverError: null});

                    if (data.goto_location.length > 0) {
                        window.location.href = data.goto_location;
                    }
                },
                (err) => {
                    if (err.sendMessage) {
                        this.sendMessage(post);
                    } else {
                        const state = {};
                        state.serverError = err.message;
                        state.submitting = false;
                        this.setState(state);
                    }
                }
            );
        } else {
            this.sendMessage(post);
        }
    }
    sendMessage(post) {
        post.channel_id = this.state.channelId;
        post.filenames = this.state.previews;

        const time = Utils.getTimestamp();
        const userId = UserStore.getCurrentId();
        post.pending_post_id = `${userId}:${time}`;
        post.user_id = userId;
        post.create_at = time;
        post.root_id = this.state.rootId;
        post.parent_id = this.state.parentId;

        const channel = ChannelStore.get(this.state.channelId);

        EventHelpers.emitUserPostedEvent(post);
        this.setState({messageText: '', submitting: false, postError: null, previews: [], serverError: null});

        Client.createPost(post, channel,
            (data) => {
                AsyncClient.getPosts();

                const member = ChannelStore.getMember(channel.id);
                member.msg_count = channel.total_msg_count;
                member.last_viewed_at = Date.now();
                ChannelStore.setChannelMember(member);

                EventHelpers.emitPostRecievedEvent(data);
            },
            (err) => {
                const state = {};

                if (err.message === 'Invalid RootId parameter') {
                    if ($('#post_deleted').length > 0) {
                        $('#post_deleted').modal('show');
                    }
                    PostStore.removePendingPost(post.pending_post_id);
                } else {
                    post.state = Constants.POST_FAILED;
                    PostStore.updatePendingPost(post);
                }

                state.submitting = false;
                this.setState(state);
            }
        );
    }
    postMsgKeyPress(e) {
        if (this.state.ctrlSend === 'true' && e.ctrlKey || this.state.ctrlSend === 'false') {
            if (e.which === KeyCodes.ENTER && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                ReactDOM.findDOMNode(this.refs.textbox).blur();
                this.handleSubmit(e);
            }
        }

        const t = Date.now();
        if ((t - this.lastTime) > Constants.UPDATE_TYPING_MS) {
            SocketStore.sendMessage({channel_id: this.state.channelId, action: 'typing', props: {parent_id: ''}, state: {}});
            this.lastTime = t;
        }
    }
    handleUserInput(messageText) {
        this.setState({messageText});

        const draft = PostStore.getCurrentDraft();
        draft.message = messageText;
        PostStore.storeCurrentDraft(draft);
    }
    resizePostHolder() {
        if (this.state.windowWidth > 960) {
            $('#post_textbox').focus();
        }
    }
    handleUploadStart(clientIds, channelId) {
        const draft = PostStore.getDraft(channelId);

        draft.uploadsInProgress = draft.uploadsInProgress.concat(clientIds);
        PostStore.storeDraft(channelId, draft);

        this.setState({uploadsInProgress: draft.uploadsInProgress});
    }
    handleFileUploadComplete(filenames, clientIds, channelId) {
        const draft = PostStore.getDraft(channelId);

        // remove each finished file from uploads
        for (let i = 0; i < clientIds.length; i++) {
            const index = draft.uploadsInProgress.indexOf(clientIds[i]);

            if (index !== -1) {
                draft.uploadsInProgress.splice(index, 1);
            }
        }

        draft.previews = draft.previews.concat(filenames);
        PostStore.storeDraft(channelId, draft);

        this.setState({uploadsInProgress: draft.uploadsInProgress, previews: draft.previews});
    }
    handleUploadError(err, clientId) {
        let message = err;
        if (message && typeof message !== 'string') {
            // err is an AppError from the server
            message = err.message;
        }

        if (clientId === -1) {
            this.setState({serverError: message});
        } else {
            const draft = PostStore.getDraft(this.state.channelId);

            const index = draft.uploadsInProgress.indexOf(clientId);
            if (index !== -1) {
                draft.uploadsInProgress.splice(index, 1);
            }

            PostStore.storeDraft(this.state.channelId, draft);

            this.setState({uploadsInProgress: draft.uploadsInProgress, serverError: message});
        }
    }
    handleTextDrop(text) {
        const newText = this.state.messageText + text;
        this.handleUserInput(newText);
        Utils.setCaretPosition(ReactDOM.findDOMNode(this.refs.textbox.refs.message), newText.length);
    }
    removePreview(id) {
        const previews = Object.assign([], this.state.previews);
        const uploadsInProgress = this.state.uploadsInProgress;

        // id can either be the path of an uploaded file or the client id of an in progress upload
        let index = previews.indexOf(id);
        if (index === -1) {
            index = uploadsInProgress.indexOf(id);

            if (index !== -1) {
                uploadsInProgress.splice(index, 1);
                this.refs.fileUpload.cancelUpload(id);
            }
        } else {
            previews.splice(index, 1);
        }

        const draft = PostStore.getCurrentDraft();
        draft.previews = previews;
        draft.uploadsInProgress = uploadsInProgress;
        PostStore.storeCurrentDraft(draft);

        this.setState({previews, uploadsInProgress});
    }
    componentDidMount() {
        ChannelStore.addChangeListener(this.onChange);
        PreferenceStore.addChangeListener(this.onPreferenceChange);
        this.resizePostHolder();
        window.addEventListener('resize', this.handleResize);
    }
    componentWillUnmount() {
        ChannelStore.removeChangeListener(this.onChange);
        PreferenceStore.removeChangeListener(this.onPreferenceChange);
        window.removeEventListener('resize', this.handleResize);
    }
    onChange() {
        const channelId = ChannelStore.getCurrentId();
        if (this.state.channelId !== channelId) {
            const draft = this.getCurrentDraft();

            this.setState({channelId, messageText: draft.messageText, initialText: draft.messageText, submitting: false, serverError: null, postError: null, previews: draft.previews, uploadsInProgress: draft.uploadsInProgress});
        }
    }
    onPreferenceChange() {
        const tutorialPref = PreferenceStore.getPreference(Preferences.TUTORIAL_STEP, UserStore.getCurrentId(), {value: '999'});
        this.setState({
            showTutorialTip: parseInt(tutorialPref.value, 10) === TutorialSteps.POST_POPOVER,
            ctrlSend: PreferenceStore.getPreference(Constants.Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter', {value: 'false'}).value
        });
    }
    getFileCount(channelId) {
        if (channelId === this.state.channelId) {
            return this.state.previews.length + this.state.uploadsInProgress.length;
        }

        const draft = PostStore.getDraft(channelId);
        return draft.previews.length + draft.uploadsInProgress.length;
    }
    handleKeyDown(e) {
        if (this.state.ctrlSend === 'true' && e.keyCode === KeyCodes.ENTER && e.ctrlKey === true) {
            this.postMsgKeyPress(e);
            return;
        }

        if (e.keyCode === KeyCodes.UP && this.state.messageText === '') {
            e.preventDefault();

            const channelId = ChannelStore.getCurrentId();
            const lastPost = PostStore.getCurrentUsersLatestPost(channelId);
            if (!lastPost) {
                return;
            }
            var type = (lastPost.root_id && lastPost.root_id.length > 0) ? 'Comment' : 'Post';

            AppDispatcher.handleViewAction({
                type: ActionTypes.RECIEVED_EDIT_POST,
                refocusId: '#post_textbox',
                title: type,
                message: lastPost.message,
                postId: lastPost.id,
                channelId: lastPost.channel_id,
                comments: PostStore.getCommentCount(lastPost)
            });
        }
    }
    createTutorialTip() {
        const screens = [];

        screens.push(
            <div>
                <h4>{'Sending Messages'}</h4>
                <p>{'Type here to write a message and press '}<strong>{'Enter'}</strong>{' to post it.'}</p>
                <p>{'Click the '}<strong>{'Attachment'}</strong>{' button to upload an image or a file.'}</p>
            </div>
        );

        return (
            <TutorialTip
                placement='top'
                screens={screens}
                overlayClass='tip-overlay--chat'
            />
        );
    }
    render() {
        let serverError = null;
        if (this.state.serverError) {
            serverError = (
                <div className='has-error'>
                    <label className='control-label'>{this.state.serverError}</label>
                </div>
            );
        }

        let postError = null;
        if (this.state.postError) {
            postError = <label className='control-label'>{this.state.postError}</label>;
        }

        let preview = null;
        if (this.state.previews.length > 0 || this.state.uploadsInProgress.length > 0) {
            preview = (
                <FilePreview
                    files={this.state.previews}
                    onRemove={this.removePreview}
                    uploadsInProgress={this.state.uploadsInProgress}
                />
            );
        }

        let postFooterClassName = 'post-create-footer';
        if (postError) {
            postFooterClassName += ' has-error';
        }

        let tutorialTip = null;
        if (this.state.showTutorialTip) {
            tutorialTip = this.createTutorialTip();
        }

        return (
            <form
                id='create_post'
                ref='topDiv'
                role='form'
                onSubmit={this.handleSubmit}
            >
                <div className='post-create'>
                    <div className='post-create-body'>
                        <div className='post-body__cell'>
                            <Textbox
                                onUserInput={this.handleUserInput}
                                onKeyPress={this.postMsgKeyPress}
                                onKeyDown={this.handleKeyDown}
                                onHeightChange={this.resizePostHolder}
                                messageText={this.state.messageText}
                                createMessage='Write a message...'
                                channelId={this.state.channelId}
                                id='post_textbox'
                                ref='textbox'
                            />
                            <FileUpload
                                ref='fileUpload'
                                getFileCount={this.getFileCount}
                                onUploadStart={this.handleUploadStart}
                                onFileUpload={this.handleFileUploadComplete}
                                onUploadError={this.handleUploadError}
                                onTextDrop={this.handleTextDrop}
                                postType='post'
                                channelId=''
                            />
                        </div>
                        <a
                            className='send-button theme'
                            onClick={this.handleSubmit}
                        >
                            <i className='fa fa-paper-plane' />
                        </a>
                        {tutorialTip}
                    </div>
                    <div className={postFooterClassName}>
                        {postError}
                        {serverError}
                        {preview}
                        <MsgTyping
                            channelId={this.state.channelId}
                            parentId=''
                        />
                    </div>
                </div>
            </form>
        );
    }
}
