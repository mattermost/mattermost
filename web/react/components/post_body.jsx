// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var FileAttachmentList = require('./file_attachment_list.jsx');
var UserStore = require('../stores/user_store.jsx');
var utils = require('../utils/utils.jsx');
var Constants = require('../utils/constants.jsx');

module.exports = React.createClass({
    componentWillReceiveProps: function(nextProps) {
        var linkData = utils.extractLinks(nextProps.post.message);
        this.setState({ links: linkData["links"], message: linkData["text"] });
    },
    getInitialState: function() {
        var linkData = utils.extractLinks(this.props.post.message);
        return { links: linkData["links"], message: linkData["text"] };
    },
    render: function() {
        var post = this.props.post;
        var filenames = this.props.post.filenames;
        var parentPost = this.props.parentPost;
        var inner = utils.textToJsx(this.state.message);

        var comment = "";
        var reply = "";
        var postClass = "";

        if (parentPost) {
            var profile = UserStore.getProfile(parentPost.user_id);
            var apostrophe = "";
            var name = "...";
            if (profile != null) {
                if (profile.username.slice(-1) === 's') {
                    apostrophe = "'";
                } else {
                    apostrophe = "'s";
                }
                name = <a className="theme" onClick={function(){ utils.searchForTerm(profile.username); }}>{profile.username}</a>;
            }

            var message = ""
            if (parentPost.message) {
                message = utils.replaceHtmlEntities(parentPost.message)
            } else if (parentPost.filenames.length) {
                message = parentPost.filenames[0].split('/').pop();

                if (parentPost.filenames.length === 2) {
                    message += " plus 1 other file";
                } else if (parentPost.filenames.length > 2) {
                    message += " plus " + (parentPost.filenames.length - 1) + " other files";
                }
            }

            comment = (
                <p className="post-link">
                    <span>Commented on {name}{apostrophe} message: <a className="theme" onClick={this.props.handleCommentClick}>{message}</a></span>
                </p>
            );

            postClass += " post-comment";
        }

        var loading;
        if (post.state === Constants.POST_FAILED) {
            postClass += " post-fail";
            loading = <a className="theme post-retry pull-right" href="#" onClick={this.props.retryPost}>Retry</a>;
        } else if (post.state === Constants.POST_LOADING) {
            postClass += " post-waiting";
            loading = <img className="post-loading-gif pull-right" src="/static/images/load.gif"/>;
        }

        var embed;
        if (filenames.length === 0 && this.state.links) {
            embed = utils.getEmbed(this.state.links[0]);
        }

        return (
            <div className="post-body">
                { comment }
                <p key={post.id+"_message"} className={postClass}>{loading}<span>{inner}</span></p>
                { filenames && filenames.length > 0 ?
                    <FileAttachmentList
                        filenames={filenames}
                        modalId={"view_image_modal_" + post.id}
                        channelId={post.channel_id}
                        userId={post.user_id} />
                : "" }
                { embed }
            </div>
        );
    }
});
