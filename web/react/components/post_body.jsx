// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var CreateComment = require( './create_comment.jsx' );
var UserStore = require('../stores/user_store.jsx');
var utils = require('../utils/utils.jsx');
var ViewImageModal = require('./view_image.jsx');
var Constants = require('../utils/constants.jsx');

module.exports = React.createClass({
    handleImageClick: function(e) {
        this.setState({startImgId: parseInt($(e.target.parentNode).attr('data-img-id'))});
    },
    componentWillReceiveProps: function(nextProps) {
        var linkData = utils.extractLinks(nextProps.post.message);
        this.setState({ links: linkData["links"], message: linkData["text"] });
    },
    componentDidMount: function() {
        var filenames = this.props.post.filenames;
        var self = this;
        if (filenames) {
            var re1 = new RegExp(' ', 'g');
            var re2 = new RegExp('\\(', 'g');
            var re3 = new RegExp('\\)', 'g');
            for (var i = 0; i < filenames.length && i < Constants.MAX_DISPLAY_FILES; i++) {
                var fileInfo = utils.splitFileLocation(filenames[i]);
                if (Object.keys(fileInfo).length === 0) continue;

                var type = utils.getFileType(fileInfo.ext);

                if (type === "image") {
                    $('<img/>').attr('src', fileInfo.path+'_thumb.jpg').load(function(path, name){ return function() {
                        $(this).remove();
                        if (name in self.refs) {
                            var imgDiv = self.refs[name].getDOMNode();
                            $(imgDiv).removeClass('post__load');
                            $(imgDiv).addClass('post__image');
                            var url = path.replace(re1, '%20').replace(re2, '%28').replace(re3, '%29');
                            $(imgDiv).css('background-image', 'url('+url+'_thumb.jpg)');
                        }
                    }}(fileInfo.path, filenames[i]));
                }
            }
        }
    },
    getInitialState: function() {
        var linkData = utils.extractLinks(this.props.post.message);
        return { startImgId: 0, links: linkData["links"], message: linkData["text"] };
    },
    render: function() {
        var post = this.props.post;
        var filenames = this.props.post.filenames;
        var parentPost = this.props.parentPost;
        var postImageModalId = "view_image_modal_" + post.id;
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

            var message = parentPost.message;

            comment = (
                <p className="post-link">
                    <span>Commented on {name}{apostrophe} message: <a className="theme" onClick={this.props.handleCommentClick}>{utils.replaceHtmlEntities(message)}</a></span>
                </p>
            );

            postClass += " post-comment";
        }

        var postFiles = [];
        var images = [];
        if (filenames) {
            for (var i = 0; i < filenames.length; i++) {
                var fileInfo = utils.splitFileLocation(filenames[i]);
                if (Object.keys(fileInfo).length === 0) continue;


                var type = utils.getFileType(fileInfo.ext);

                if (type === "image") {
                    if (i < Constants.MAX_DISPLAY_FILES) {
                        postFiles.push(
                            <div className="post-image__column" key={filenames[i]}>
                                <a href="#" onClick={this.handleImageClick} data-img-id={images.length.toString()} data-toggle="modal" data-target={"#" + postImageModalId }><div ref={filenames[i]} className="post__load" style={{backgroundImage: 'url(/static/images/load.gif)'}}></div></a>
                            </div>
                        );
                    }
                    images.push(filenames[i]);
                } else if (i < Constants.MAX_DISPLAY_FILES) {
                    postFiles.push(
                        <div className="post-image__column custom-file" key={fileInfo.name+fileInfo.ext}>
                            <a href={fileInfo.path+"."+fileInfo.ext} download={fileInfo.name+"."+fileInfo.ext}>
                                <div className={"file-icon "+utils.getIconClassName(type)}/>
                            </a>
                        </div>
                    );
                }
            }
        }

        var embed;
        if (postFiles.length === 0 && this.state.links) {
            embed = utils.getEmbed(this.state.links[0]);
        }

        return (
            <div className="post-body">
                { comment }
                <p key={post.Id+"_message"} className={postClass}><span>{inner}</span></p>
                { filenames && filenames.length > 0 ?
                    <div className="post-image__columns">
                        { postFiles }
                    </div>
                : "" }
                { embed }

                { images.length > 0 ?
                    <ViewImageModal
                        channelId={post.channel_id}
                        userId={post.user_id}
                        modalId={postImageModalId}
                        startId={this.state.startImgId}
                        imgCount={post.img_count}
                        filenames={images} />
                : "" }
            </div>
        );
    }
});
