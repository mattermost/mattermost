// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as AsyncClient from 'utils/async_client.jsx';
import FileStore from 'stores/file_store.jsx';
import * as Utils from 'utils/utils.jsx';

export default class CommentedOnFilesMessageContainer extends React.Component {
    static propTypes = {
        parentPostChannelId: React.PropTypes.string.isRequired,
        parentPostId: React.PropTypes.string.isRequired
    }

    constructor(props) {
        super(props);

        this.handleFileChange = this.handleFileChange.bind(this);

        this.state = {
            fileInfos: FileStore.getInfosForPost(this.props.parentPostId)
        };
    }

    componentDidMount() {
        FileStore.addChangeListener(this.handleFileChange);

        if (!FileStore.hasInfosForPost(this.props.parentPostId)) {
            AsyncClient.getFileInfosForPost(this.props.parentPostChannelId, this.props.parentPostId);
        }
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.parentPostId !== this.props.parentPostId) {
            this.setState({
                fileInfos: FileStore.getInfosForPost(this.props.parentPostId)
            });

            if (!FileStore.hasInfosForPost(this.props.parentPostId)) {
                AsyncClient.getFileInfosForPost(this.props.parentPostChannelId, this.props.parentPostId);
            }
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (nextProps.parentPostId !== this.props.parentPostId) {
            return true;
        }

        if (nextProps.parentPostChannelId !== this.props.parentPostChannelId) {
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
            fileInfos: FileStore.getInfosForPost(this.props.parentPostId)
        });
    }

    componentWillUnmount() {
        FileStore.removeChangeListener(this.handleFileChange);
    }

    render() {
        let message = ' ';

        if (this.state.fileInfos && this.state.fileInfos.length > 0) {
            message = this.state.fileInfos[0].name;

            if (this.state.fileInfos.length === 2) {
                message += Utils.localizeMessage('post_body.plusOne', ' plus 1 other file');
            } else if (this.state.fileInfos.length > 2) {
                message += Utils.localizeMessage('post_body.plusMore', ' plus {count} other files').replace('{count}', (this.state.fileInfos.length - 1).toString());
            }
        }

        return <span>{message}</span>;
    }
}
