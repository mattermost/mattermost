// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import React from 'react';

import ChannelHeader from 'components/channel_header.jsx';
import FileUploadOverlay from 'components/file_upload_overlay.jsx';
import CreatePost from 'components/create_post.jsx';
import PostViewController from 'components/post_view/post_view_controller.jsx';

import ChannelStore from 'stores/channel_store.jsx';

import * as Utils from 'utils/utils.jsx';

export default class ChannelView extends React.Component {
    constructor(props) {
        super(props);

        this.getStateFromStores = this.getStateFromStores.bind(this);
        this.isStateValid = this.isStateValid.bind(this);
        this.updateState = this.updateState.bind(this);

        this.state = this.getStateFromStores(props);
    }
    getStateFromStores(props) {
        const channel = ChannelStore.getByName(props.params.channel);
        const channelId = channel ? channel.id : '';
        return {
            channelId
        };
    }
    isStateValid() {
        return this.state.channelId !== '';
    }
    updateState() {
        this.setState(this.getStateFromStores(this.props));
    }
    componentDidMount() {
        ChannelStore.addChangeListener(this.updateState);

        $('body').addClass('app__body');
    }
    componentWillUnmount() {
        ChannelStore.removeChangeListener(this.updateState);

        $('body').removeClass('app__body');
    }
    componentWillReceiveProps(nextProps) {
        this.setState(this.getStateFromStores(nextProps));
    }
    shouldComponentUpdate(nextProps, nextState) {
        if (!Utils.areObjectsEqual(nextProps.params, this.props.params)) {
            return true;
        }

        if (nextState.channelId !== this.state.channelId) {
            return true;
        }

        return false;
    }
    render() {
        return (
            <div
                id='app-content'
                className='app__content'
            >
                <FileUploadOverlay overlayType='center'/>
                <ChannelHeader
                    channelId={this.state.channelId}
                />
                <PostViewController/>
                <div
                    className='post-create__container'
                    id='post-create'
                >
                    <CreatePost/>
                </div>
            </div>
        );
    }
}
ChannelView.defaultProps = {
};

ChannelView.propTypes = {
    params: React.PropTypes.object.isRequired
};
