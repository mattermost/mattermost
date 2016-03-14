// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import MsgTyping from './msg_typing.jsx';
import Textbox from './textbox.jsx';
import FileUpload from './file_upload.jsx';
import FilePreview from './file_preview.jsx';
import PostDeletedModal from './post_deleted_modal.jsx';
import TutorialTip from './tutorial/tutorial_tip.jsx';

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import * as GlobalActions from '../action_creators/global_actions.jsx';
import * as Client from '../utils/client.jsx';
import * as AsyncClient from '../utils/async_client.jsx';
import * as Utils from '../utils/utils.jsx';

import ChannelStore from '../stores/channel_store.jsx';
import PostStore from '../stores/post_store.jsx';
import UserStore from '../stores/user_store.jsx';
import PreferenceStore from '../stores/preference_store.jsx';
import SocketStore from '../stores/socket_store.jsx';

import Constants from '../utils/constants.jsx';

import {intlShape, injectIntl, defineMessages, FormattedHTMLMessage} from 'mm-intl';

const Preferences = Constants.Preferences;
const TutorialSteps = Constants.TutorialSteps;
const ActionTypes = Constants.ActionTypes;
const KeyCodes = Constants.KeyCodes;

const holders = defineMessages({
    comment: {
        id: 'create_post.comment',
        defaultMessage: 'Comment'
    },
    post: {
        id: 'create_post.post',
        defaultMessage: 'Post'
    },
    write: {
        id: 'create_post.write',
        defaultMessage: 'Write a message...'
    }
});

class CreatePost extends React.Component {
    constructor(props) {
        super(props);

        this.lastTime = 0;

        this.getCurrentDraft = this.getCurrentDraft.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.postMsgKeyPress = this.postMsgKeyPress.bind(this);
        this.handleUserInput = this.handleUserInput.bind(this);
        this.handleUploadClick = this.handleUploadClick.bind(this);
        this.handleUploadStart = this.handleUploadStart.bind(this);
        this.handleFileUploadComplete = this.handleFileUploadComplete.bind(this);
        this.handleUploadError = this.handleUploadError.bind(this);
        this.removePreview = this.removePreview.bind(this);
        this.onChange = this.onChange.bind(this);
        this.onPreferenceChange = this.onPreferenceChange.bind(this);
        this.getFileCount = this.getFileCount.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.sendMessage = this.sendMessage.bind(this);
        this.focusTextbox = this.focusTextbox.bind(this);
        this.showPostDeletedModal = this.showPostDeletedModal.bind(this);
        this.hidePostDeletedModal = this.hidePostDeletedModal.bind(this);

        PostStore.clearDraftUploads();

        const draft = this.getCurrentDraft();

        this.state = {
            channelId: ChannelStore.getCurrentId(),
            messageText: draft.messageText,
            uploadsInProgress: draft.uploadsInProgress,
            previews: draft.previews,
            submitting: false,
            initialText: draft.messageText,
            ctrlSend: false,
            showTutorialTip: false,
            showPostDeletedModal: false
        };
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
                    PostStore.storeDraft(this.state.channelId, null);
                    this.setState({messageText: '', submitting: false, postError: null, previews: [], serverError: null});

                    if (data.goto_location && data.goto_location.length > 0) {
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
        post.parent_id = this.state.parentId;

        const channel = ChannelStore.get(this.state.channelId);

        GlobalActions.emitUserPostedEvent(post);
        this.setState({messageText: '', submitting: false, postError: null, previews: [], serverError: null});

        Client.createPost(post, channel,
            (data) => {
                AsyncClient.getPosts();

                const member = ChannelStore.getMember(channel.id);
                member.msg_count = channel.total_msg_count;
                member.last_viewed_at = Date.now();
                ChannelStore.setChannelMember(member);

                GlobalActions.emitPostRecievedEvent(data);
            },
            (err) => {
                if (err.id === 'api.post.create_post.root_id.app_error') {
                    // this should never actually happen since you can't reply from this textbox
                    this.showPostDeletedModal();

                    PostStore.removePendingPost(post.pending_post_id);
                } else {
                    post.state = Constants.POST_FAILED;
                    PostStore.updatePendingPost(post);
                }

                this.setState({
                    submitting: false
                });
            }
        );
    }
    focusTextbox() {
        if (!Utils.isMobile()) {
            this.refs.textbox.focus();
        }
    }
    postMsgKeyPress(e) {
        if (this.state.ctrlSend && e.ctrlKey || !this.state.ctrlSend) {
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
    handleUploadClick() {
        this.focusTextbox();
    }
    handleUploadStart(clientIds, channelId) {
        const draft = PostStore.getDraft(channelId);

        draft.uploadsInProgress = draft.uploadsInProgress.concat(clientIds);
        PostStore.storeDraft(channelId, draft);

        this.setState({uploadsInProgress: draft.uploadsInProgress});

        // this is a bit redundant with the code that sets focus when the file input is clicked,
        // but this also resets the focus after a drag and drop
        this.focusTextbox();
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

        if (clientId !== -1) {
            const draft = PostStore.getDraft(this.state.channelId);

            const index = draft.uploadsInProgress.indexOf(clientId);
            if (index !== -1) {
                draft.uploadsInProgress.splice(index, 1);
            }

            PostStore.storeDraft(this.state.channelId, draft);

            this.setState({uploadsInProgress: draft.uploadsInProgress});
        }

        this.setState({serverError: message});
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
                this.refs.fileUpload.getWrappedInstance().cancelUpload(id);
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
    componentWillMount() {
        const tutorialStep = PreferenceStore.getInt(Preferences.TUTORIAL_STEP, UserStore.getCurrentId(), 999);

        // wait to load these since they may have changed since the component was constructed (particularly in the case of skipping the tutorial)
        this.setState({
            ctrlSend: PreferenceStore.getBool(Constants.Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter'),
            showTutorialTip: tutorialStep === TutorialSteps.POST_POPOVER
        });
    }
    componentDidMount() {
        ChannelStore.addChangeListener(this.onChange);
        PreferenceStore.addChangeListener(this.onPreferenceChange);

        this.focusTextbox();
    }
    componentDidUpdate(prevProps, prevState) {
        if (prevState.channelId !== this.state.channelId) {
            this.focusTextbox();
        }
    }
    componentWillUnmount() {
        ChannelStore.removeChangeListener(this.onChange);
        PreferenceStore.removeChangeListener(this.onPreferenceChange);
    }
    onChange() {
        const channelId = ChannelStore.getCurrentId();
        if (this.state.channelId !== channelId) {
            const draft = this.getCurrentDraft();

            this.setState({channelId, messageText: draft.messageText, initialText: draft.messageText, submitting: false, serverError: null, postError: null, previews: draft.previews, uploadsInProgress: draft.uploadsInProgress});
        }
    }
    onPreferenceChange() {
        const tutorialStep = PreferenceStore.getInt(Preferences.TUTORIAL_STEP, UserStore.getCurrentId(), 999);
        this.setState({
            showTutorialTip: tutorialStep === TutorialSteps.POST_POPOVER,
            ctrlSend: PreferenceStore.getBool(Constants.Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter')
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
        if (this.state.ctrlSend && e.keyCode === KeyCodes.ENTER && e.ctrlKey === true) {
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
            const {formatMessage} = this.props.intl;
            var type = (lastPost.root_id && lastPost.root_id.length > 0) ? formatMessage(holders.comment) : formatMessage(holders.post);

            AppDispatcher.handleViewAction({
                type: ActionTypes.RECEIVED_EDIT_POST,
                refocusId: '#post_textbox',
                title: type,
                message: lastPost.message,
                postId: lastPost.id,
                channelId: lastPost.channel_id,
                comments: PostStore.getCommentCount(lastPost)
            });
        }
    }
    showPostDeletedModal() {
        this.setState({
            showPostDeletedModal: true
        });
    }
    hidePostDeletedModal() {
        this.setState({
            showPostDeletedModal: false
        });
    }
    createTutorialTip() {
        const screens = [];

        screens.push(
            <div>
                <FormattedHTMLMessage
                    id='create_post.tutorialTip'
                    defaultMessage='<h4>Sending Messages</h4><p>Type here to write a message and press <strong>Enter</strong> to post it.</p><p>Click the <strong>Attachment</strong> button to upload an image or a file.</p>'
                />
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
                                messageText={this.state.messageText}
                                createMessage={this.props.intl.formatMessage(holders.write)}
                                channelId={this.state.channelId}
                                id='post_textbox'
                                ref='textbox'
                            />
                            <FileUpload
                                ref='fileUpload'
                                getFileCount={this.getFileCount}
                                onClick={this.handleUploadClick}
                                onUploadStart={this.handleUploadStart}
                                onFileUpload={this.handleFileUploadComplete}
                                onUploadError={this.handleUploadError}
                                postType='post'
                                channelId=''
                            />
                        </div>
                        <a
                            className='send-button theme'
                            onClick={this.handleSubmit}
                        >
                            <i className='fa fa-paper-plane'/>
                        </a>
                        {tutorialTip}
                    </div>
                    <div className={postFooterClassName}>
                        <MsgTyping
                            channelId={this.state.channelId}
                            parentId=''
                        />
                        {preview}
                        {postError}
                        {serverError}
                    </div>
                </div>
                <PostDeletedModal
                    show={this.state.showPostDeletedModal}
                    onHide={this.hidePostDeletedModal}
                />
            </form>
        );
    }
}

CreatePost.propTypes = {
    intl: intlShape.isRequired
};

export default injectIntl(CreatePost);
