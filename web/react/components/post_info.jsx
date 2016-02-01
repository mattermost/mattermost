// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserStore from '../stores/user_store.jsx';
import TeamStore from '../stores/team_store.jsx';
import * as Utils from '../utils/utils.jsx';
import TimeSince from './time_since.jsx';
import * as EventHelpers from '../dispatcher/event_helpers.jsx';

import Constants from '../utils/constants.jsx';

const Overlay = ReactBootstrap.Overlay;
const Popover = ReactBootstrap.Popover;

export default class PostInfo extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            copiedLink: false,
            show: false
        };

        this.handlePermalinkCopy = this.handlePermalinkCopy.bind(this);
    }
    createDropdown() {
        var post = this.props.post;
        var isOwner = UserStore.getCurrentId() === post.user_id;
        var isAdmin = Utils.isAdmin(UserStore.getCurrentUser().roles);

        if (post.state === Constants.POST_FAILED || post.state === Constants.POST_LOADING || post.state === Constants.POST_DELETED) {
            return '';
        }

        var type = 'Post';
        if (post.root_id && post.root_id.length > 0) {
            type = 'Comment';
        }

        var dropdownContents = [];
        var dataComments = 0;
        if (type === 'Post') {
            dataComments = this.props.commentCount;
        }

        if (this.props.allowReply === 'true') {
            dropdownContents.push(
                 <li
                     key='replyLink'
                     role='presentation'
                 >
                     <a
                         className='link__reply theme'
                         href='#'
                         onClick={this.props.handleCommentClick}
                     >
                         {'Reply'}
                     </a>
                 </li>
             );
        }

        dropdownContents.push(
            <li
                key='copyLink'
                role='presentation'
            >
                <a
                    href='#'
                    onClick={(e) => this.setState({target: e.target, show: !this.state.show})}
                >
                    {'Permalink'}
                </a>
            </li>
        );

        if (isOwner || isAdmin) {
            dropdownContents.push(
                <li
                    key='deletePost'
                    role='presentation'
                >
                    <a
                        href='#'
                        role='menuitem'
                        onClick={() => EventHelpers.showDeletePostModal(post, dataComments)}
                    >
                        {'Delete'}
                    </a>
                </li>
            );
        }

        if (isOwner) {
            dropdownContents.push(
                <li
                    key='editPost'
                    role='presentation'
                >
                    <a
                        href='#'
                        role='menuitem'
                        data-toggle='modal'
                        data-target='#edit_post'
                        data-refocusid='#post_textbox'
                        data-title={type}
                        data-message={post.message}
                        data-postid={post.id}
                        data-channelid={post.channel_id}
                        data-comments={dataComments}
                    >
                        {'Edit'}
                    </a>
                </li>
            );
        }

        if (dropdownContents.length === 0) {
            return '';
        }

        return (
            <div>
                <a
                    href='#'
                    className='dropdown-toggle post__dropdown theme'
                    type='button'
                    data-toggle='dropdown'
                    aria-expanded='false'
                />
                <ul
                    className='dropdown-menu'
                    role='menu'
                >
                    {dropdownContents}
                </ul>
            </div>
        );
    }

    handlePermalinkCopy() {
        const textBox = $(ReactDOM.findDOMNode(this.refs.permalinkbox));
        textBox.select();

        try {
            const successful = document.execCommand('copy');
            if (successful) {
                this.setState({copiedLink: true, show: false});
            } else {
                this.setState({copiedLink: false});
            }
        } catch (err) {
            this.setState({copiedLink: false});
        }
    }
    render() {
        var post = this.props.post;
        var comments = '';
        var showCommentClass = '';
        var commentCountText = this.props.commentCount;

        if (this.props.commentCount >= 1) {
            showCommentClass = ' icon--show';
        } else {
            commentCountText = '';
        }

        if (post.state !== Constants.POST_FAILED && post.state !== Constants.POST_LOADING && post.state !== Constants.POST_DELETED) {
            comments = (
                <a
                    href='#'
                    className={'comment-icon__container' + showCommentClass}
                    onClick={this.props.handleCommentClick}
                >
                    <span
                        className='comment-icon'
                        dangerouslySetInnerHTML={{__html: Constants.REPLY_ICON}}
                    />
                    {commentCountText}
                </a>
            );
        }

        var dropdown = this.createDropdown();

        const permalink = TeamStore.getCurrentTeamUrl() + '/pl/' + post.id;
        const copyButtonText = this.state.copiedLink ? (<div>{'Copy '}<i className='fa fa-check'/></div>) : 'Copy';
        const permalinkOverlay = (
            <Popover
                id='permalink-overlay'
                className='permalink-popover'
                placement='left'
                title=''
            >
                <div className='form-inline'>
                    <input
                        type='text'
                        readOnly='true'
                        ref='permalinkbox'
                        className='permalink-text form-control no-resize'
                        rows='1'
                        value={permalink}
                    />
                    <button
                        data-copy-btn='true'
                        type='button'
                        className='btn btn-primary'
                        onClick={this.handlePermalinkCopy}
                        data-clipboard-text={permalink}
                    >
                        {copyButtonText}
                    </button>
                </div>
            </Popover>
        );

        const containerPadding = 20;

        return (
            <ul className='post__header post__header--info'>
                <li className='col'>
                    <TimeSince
                        eventTime={post.create_at}
                    />
                </li>
                <li className='col col__reply'>
                    <div
                        className='dropdown'
                        ref='dotMenu'
                    >
                        {dropdown}
                    </div>
                    {comments}
                    <Overlay
                        show={this.state.show}
                        target={() => ReactDOM.findDOMNode(this.refs.dotMenu)}
                        onHide={() => this.setState({show: false})}
                        placement='left'
                        container={this}
                        containerPadding={containerPadding}
                        rootClose={true}
                    >
                        {permalinkOverlay}
                    </Overlay>
                </li>
            </ul>
        );
    }
}

PostInfo.defaultProps = {
    post: null,
    commentCount: 0,
    isLastComment: false,
    allowReply: false
};
PostInfo.propTypes = {
    post: React.PropTypes.object,
    commentCount: React.PropTypes.number,
    isLastComment: React.PropTypes.bool,
    allowReply: React.PropTypes.string,
    handleCommentClick: React.PropTypes.func
};
