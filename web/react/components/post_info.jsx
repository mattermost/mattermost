// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');
var utils = require('../utils/utils.jsx');

var Constants = require('../utils/constants.jsx');

module.exports = React.createClass({
    getInitialState: function() {
        return { };
    },
    render: function() {
        var post = this.props.post;
        var isOwner = UserStore.getCurrentId() == post.user_id;
        var isAdmin = UserStore.getCurrentUser().roles.indexOf("admin") > -1

        var type = "Post"
        if (post.root_id.length > 0) {
            type = "Comment"
        }

        var comments = "";
        var lastCommentClass = this.props.isLastComment ? " comment-icon__container__show" : " comment-icon__container__hide";
        if (this.props.commentCount >= 1  && !post.did_fail && !post.is_loading) {
            comments = <a href="#" className={"comment-icon__container theme" + lastCommentClass} onClick={this.props.handleCommentClick}><span className="comment-icon" dangerouslySetInnerHTML={{__html: Constants.COMMENT_ICON }} />{this.props.commentCount}</a>;
        }

        var show_dropdown = isOwner || (this.props.allowReply === "true" && type != "Comment");
        if (post.did_fail || post.is_loading) show_dropdown = false;

        return (
            <ul className="post-header post-info">
                <li className="post-header-col"><time className="post-profile-time">{ utils.displayDateTime(post.create_at) }</time></li>
                    <li className="post-header-col post-header__reply">
                        <div className="dropdown">
                        { show_dropdown ?
                            <div>
                                <a href="#" className="dropdown-toggle theme" type="button" data-toggle="dropdown" aria-expanded="false" />
                                <ul className="dropdown-menu" role="menu">
                                    { isOwner ? <li role="presentation"><a href="#" role="menuitem" data-toggle="modal" data-target="#edit_post" data-title={type} data-message={post.message} data-postid={post.id} data-channelid={post.channel_id} data-comments={type === "Post" ? this.props.commentCount : 0}>Edit</a></li>
                                    : "" }
                                    { isOwner || isAdmin ? <li role="presentation"><a href="#" role="menuitem" data-toggle="modal" data-target="#delete_post" data-title={type} data-postid={post.id} data-channelid={post.channel_id} data-comments={type === "Post" ? this.props.commentCount : 0}>Delete</a></li>
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
