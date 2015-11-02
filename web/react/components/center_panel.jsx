// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var CreatePost = require('../components/create_post.jsx');
var PostsViewContainer = require('../components/posts_view_container.jsx');
var ChannelHeader = require('../components/channel_header.jsx');
var Navbar = require('../components/navbar.jsx');
var FileUploadOverlay = require('../components/file_upload_overlay.jsx');

export default class CenterPanel extends React.Component {
    constructor(props) {
        super(props);
    }
    render() {
        return (
            <div className='inner__wrap channel__wrap'>
                <div className='row header'>
                    <div id='navbar'>
                        <Navbar/>
                    </div>
                </div>
                <div className='row main'>
                    <FileUploadOverlay
                        id='file_upload_overlay'
                        overlayType='center'
                    />
                    <div
                        id='app-content'
                        className='app__content'
                    >
                        <div id='channel-header'>
                            <ChannelHeader />
                        </div>
                        <div id='post-list'>
                            <PostsViewContainer />
                        </div>
                        <div
                            className='post-create__container'
                            id='post-create'
                        >
                            <CreatePost />
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

CenterPanel.defaultProps = {
};

CenterPanel.propTypes = {
};
