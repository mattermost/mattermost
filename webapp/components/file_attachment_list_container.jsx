// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as AsyncClient from 'utils/async_client.jsx';
import FileStore from 'stores/file_store.jsx';

import FileAttachmentList from './file_attachment_list.jsx';

export default class FileAttachmentListContainer extends React.Component {
    static propTypes = {
        channelId: React.PropTypes.string.isRequred,
        postId: React.PropTypes.string.isRequired,
        compactDisplay: React.PropTypes.bool.isRequired
    }

    constructor(props) {
        super(props);

        this.handleFileChange = this.handleFileChange.bind(this);

        this.state = {
            fileInfos: FileStore.getInfosForPost(props.postId)
        };
    }

    componentDidMount() {
        FileStore.addChangeListener(this.handleFileChange);

        if (!FileStore.hasInfosForPost(this.props.postId)) {
            AsyncClient.getPostFiles(this.props.channelId, this.props.postId);
        }
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.postId !== this.props.postId) {
            this.setState({
                fileInfos: FileStore.getInfosForPost(this.props.postId)
            });

            if (!FileStore.hasInfosForPost(nextProps.postId)) {
                AsyncClient.getPostFiles(this.props.channelId, this.props.postId);
            }
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (this.props.channelId !== nextProps.channelId) {
            return true;
        }

        if (this.props.postId !== nextProps.postId) {
            return true;
        }

        if (this.props.compactDisplay !== nextProps.compactDisplay) {
            return true;
        }

        // fileInfos are treated as immutable by the FileStore
        if (nextState.fileInfos !== this.state.fileInfos) {
            return true;
        }

        return false;
    }

    handleFileChange() {
        this.setState({
            fileInfos: FileStore.getInfosForPost(this.props.postId)
        });
    }

    componentWillUnmount() {
        FileStore.removeChangeListener(this.handleFileChange);
    }

    render() {
        return (
            <FileAttachmentList
                fileInfos={this.state.fileInfos}
                compactDisplay={this.props.compactDisplay}
            />
        );
    }
}
