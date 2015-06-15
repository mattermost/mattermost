// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var UserProfile = require( './user_profile.jsx' );
var PostInfo = require('./post_info.jsx');

module.exports = React.createClass({
    getInitialState: function() {
        return {  };
    },
    render: function() {
        var post = this.props.post;

        return (
            <ul className="post-header post-header-post">
                <li className="post-header-col post-header__name"><strong><UserProfile userId={post.user_id} /></strong></li>
                <li className="post-info--hidden">
                    <PostInfo post={post} commentCount={this.props.commentCount} handleCommentClick={this.props.handleCommentClick} allowReply="true" isLastComment={this.props.isLastComment} />
                </li>
            </ul>
        );
    }
});
