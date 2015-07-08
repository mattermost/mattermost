// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var FileAttachmentList = require('./file_attachment_list.jsx');
var UserStore = require('../stores/user_store.jsx');
var utils = require('../utils/utils.jsx');
var formatText = require('../../static/js/marked/lib/marked.js');

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
        var allowTextFormatting = config.AllowTextFormatting;

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
            if(parentPost.message) {
                message = utils.replaceHtmlEntities(parentPost.message)
            } else if (parentPost.filenames.length) {
                message = parentPost.filenames[0].split('/').pop();

                if (parentPost.filenames.length === 2) {
                    message += " plus 1 other file";
                } else if (parentPost.filenames.length > 2) {
                    message += " plus " + (parentPost.filenames.length - 1) + " other files";
                }
            }

            if (allowTextFormatting) {
                message = formatText(message, {sanitize: true, mangle: false, gfm: true, breaks: true, tables: false, smartypants: true, renderer: utils.customMarkedRenderer({disable: true})});
                comment = (
                    <p className="post-link">
                        <span>Commented on {name}{apostrophe} message: <a className="theme" onClick={this.props.handleCommentClick} dangerouslySetInnerHTML={{__html: message}} /></span>
                    </p>
                );
            } else {
                comment = (
                    <p className="post-link">
                        <span>Commented on {name}{apostrophe} message: <a className="theme" onClick={this.props.handleCommentClick}>{message}</a></span>
                    </p>
                );
            }

            postClass += " post-comment";
        }

        var embed;
        if (filenames.length === 0 && this.state.links) {
            embed = utils.getEmbed(this.state.links[0]);
        }

        return (
            <div className="post-body">
                { comment }
                {allowTextFormatting ?
                <div key={post.id+"_message"} className={postClass}><span>{inner}</span></div>
                :
                <p key={post.id+"_message"} className={postClass}><span>{inner}</span></p>
                }
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
