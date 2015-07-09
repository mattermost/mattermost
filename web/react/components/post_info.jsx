// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');
var utils = require('../utils/utils.jsx');

module.exports = React.createClass({
    componentDidMount: function() {
        UserStore.addStatusesChangeListener(this._onChange);
    },
    componentWillUnmount: function() {
        UserStore.removeStatusesChangeListener(this._onChange);
    },
    _onChange: function() {
        this.forceUpdate();
    },
    getInitialState: function() {
        return { };
    },
    render: function() {
        var post = this.props.post;
        var isOwner = UserStore.getCurrentId() == post.user_id;

        var type = "Post"
        if (post.root_id.length > 0) {
            type = "Comment"
        }

        var comments = "";
        var lastCommentClass = this.props.isLastComment ? " comment-icon__container__show" : " comment-icon__container__hide";
        if (this.props.commentCount >= 1) {
            comments = <a href="#" className={"comment-icon__container theme" + lastCommentClass} onClick={this.props.handleCommentClick}><span className="comment-icon" dangerouslySetInnerHTML={{__html: "<svg version='1.1' id='Layer_2' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px'width='15px' height='15px' viewBox='1 1.5 15 15' enable-background='new 1 1.5 15 15' xml:space='preserve'> <g> <g> <path fill='#211B1B' d='M14,1.5H3c-1.104,0-2,0.896-2,2v8c0,1.104,0.896,2,2,2h1.628l1.884,3l1.866-3H14c1.104,0,2-0.896,2-2v-8 C16,2.396,15.104,1.5,14,1.5z M15,11.5c0,0.553-0.447,1-1,1H8l-1.493,2l-1.504-1.991L5,12.5H3c-0.552,0-1-0.447-1-1v-8 c0-0.552,0.448-1,1-1h11c0.553,0,1,0.448,1,1V11.5z'/> </g> </g> </svg>"}} />{this.props.commentCount}</a>;
        }

        return (
            <ul className="post-header post-info">
                <li className="post-header-col"><time className="post-profile-time">{ utils.displayDateTime(post.create_at) }</time></li>
                    <li className="post-header-col post-header__reply">
                        <div className="dropdown">
                        { isOwner || (this.props.allowReply === "true" && type != "Comment") ?
                            <div>
                                <a href="#" className="dropdown-toggle theme" type="button" data-toggle="dropdown" aria-expanded="false">
                                    [...]
                                </a>
                                <ul className="dropdown-menu" role="menu">
                                    { isOwner ? <li role="presentation"><a href="#" role="menuitem" data-toggle="modal" data-target="#edit_post" data-title={type} data-message={post.message} data-postid={post.id} data-channelid={post.channel_id} data-comments={type === "Post" ? this.props.commentCount : 0}>Edit</a></li>
                                    : "" }
                                    { isOwner ? <li role="presentation"><a href="#" role="menuitem" data-toggle="modal" data-target="#delete_post" data-title={type} data-postid={post.id} data-channelid={post.channel_id} data-comments={type === "Post" ? this.props.commentCount : 0}>Delete</a></li>
                                    : "" }
                                    { this.props.allowReply === "true" ? <li role="presentation"><a className="reply-link theme" href="#" onClick={this.props.handleCommentClick}>Reply</a></li>
                                    : "" }
                                </ul>
                            </div>
                            : "" }
                        </div>
                        { comments }
                    </li>
            </ul>
        );
    }
});
