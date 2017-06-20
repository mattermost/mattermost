// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

export default class CommentedOnFilesMessage extends React.PureComponent {
    static propTypes = {

        /*
         * The id of the post that was commented on
         */
        parentPostId: React.PropTypes.string.isRequired,

        /*
         * An array of file metadata for the parent post
         */
        fileInfos: React.PropTypes.arrayOf(React.PropTypes.object),

        actions: React.PropTypes.shape({

            /*
             * Function to get file metadata for a post
             */
            getFilesForPost: React.PropTypes.func.isRequired
        }).isRequired
    }

    componentDidMount() {
        if (!this.props.fileInfos || this.props.fileInfos.length === 0) {
            this.props.actions.getFilesForPost(this.props.parentPostId);
        }
    }

    render() {
        let message = ' ';

        if (this.props.fileInfos && this.props.fileInfos.length > 0) {
            message = this.props.fileInfos[0].name;

            if (this.props.fileInfos.length === 2) {
                message += Utils.localizeMessage('post_body.plusOne', ' plus 1 other file');
            } else if (this.props.fileInfos.length > 2) {
                message += Utils.localizeMessage('post_body.plusMore', ' plus {count} other files').replace('{count}', (this.props.fileInfos.length - 1).toString());
            }
        }

        return <span>{message}</span>;
    }
}
