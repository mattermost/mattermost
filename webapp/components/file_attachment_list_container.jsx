// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as AsyncClient from 'utils/async_client.jsx';
import FileStore from 'stores/file_store.jsx';

import FileAttachmentList from './file_attachment_list.jsx';

export default class FileAttachmentListContainer extends React.Component {
    static propTypes = {
        post: React.PropTypes.object.isRequired,
        compactDisplay: React.PropTypes.bool.isRequired
    }

    constructor(props) {
        super(props);

        this.handleFileChange = this.handleFileChange.bind(this);

        this.state = {
            fileInfos: FileStore.getInfosForPost(props.post.id)
        };
    }

    componentDidMount() {
        FileStore.addChangeListener(this.handleFileChange);

        if (this.props.post.id && !FileStore.hasInfosForPost(this.props.post.id)) {
            AsyncClient.getFileInfosForPost(this.props.post.channel_id, this.props.post.id);
        }
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.post.id !== this.props.post.id) {
            this.setState({
                fileInfos: FileStore.getInfosForPost(nextProps.post.id)
            });

            if (nextProps.post.id && !FileStore.hasInfosForPost(nextProps.post.id)) {
                AsyncClient.getFileInfosForPost(nextProps.post.channel_id, nextProps.post.id);
            }
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (this.props.post.id !== nextProps.post.id) {
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
            fileInfos: FileStore.getInfosForPost(this.props.post.id)
        });
    }

    componentWillUnmount() {
        FileStore.removeChangeListener(this.handleFileChange);
    }

    render() {
        let fileCount = 0;
        if (this.props.post.file_ids) {
            fileCount = this.props.post.file_ids.length;
        } else if (this.props.post.filenames) {
            fileCount = this.props.post.filenames.length;
        }

        return (
            <FileAttachmentList
                fileCount={fileCount}
                fileInfos={this.state.fileInfos}
                compactDisplay={this.props.compactDisplay}
            />
        );
    }
}
