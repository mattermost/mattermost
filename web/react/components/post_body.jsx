// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var FileAttachmentList = require('./file_attachment_list.jsx');
var UserStore = require('../stores/user_store.jsx');
var utils = require('../utils/utils.jsx');
var Marked = require('marked');

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
        var useMarkdown = config.AllowMarkdown && UserStore.getCurrentUser().props.enable_markdown === "true" ? true : false;

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

            var customMarkedRenderer = new Marked.Renderer();
            customMarkedRenderer.code = function(code, language) {
                return code;
            };
            customMarkedRenderer.blockquote = function(quote) {
                return quote;
            };
            customMarkedRenderer.list = function(body, ordered) {
                return body;
            };
            customMarkedRenderer.listitem = function(text) {
                return text + " ";
            };
            customMarkedRenderer.paragraph = function(text) {
                return text + " ";
            };
            customMarkedRenderer.heading = function(text, level) {
                var hashText = "";
                for (var i = 0; i < level; i++)
                    hashText += "#";

                return hashText + text + "";
            };
            customMarkedRenderer.codespan = function(code) {
                return "<pre>" + code + "</pre>";
            };
            customMarkedRenderer.del = function(text) {
                return "<s>" + text + "</s>";
            };
            customMarkedRenderer.link = function(href, title, text) {
                return " " + href + " ";
            };
            customMarkedRenderer.image = function(href, title, text) {
                return " " + href + " ";
            };

            message = Marked(message, {sanitize: true, gfm: true, breaks: true, tables: false, smartypants: true, renderer: customMarkedRenderer});

            if (message.indexOf("<p>") === 0) {
                message = message.slice(3);
            }

            comment = (
                <div className="post-link">
                    <span>Commented on {name}{apostrophe} message: <a className="theme" onClick={this.props.handleCommentClick} dangerouslySetInnerHTML={{__html: message}} /></span>
                </div>
            );

            postClass += " post-comment";
        }

        var embed;
        if (filenames.length === 0 && this.state.links) {
            embed = utils.getEmbed(this.state.links[0]);
        }

        return (
            <div className="post-body">
                { comment }
                <div key={post.id+"_message"} className={postClass}><span>{inner}</span></div>
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
