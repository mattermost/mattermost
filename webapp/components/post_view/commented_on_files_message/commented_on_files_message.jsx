// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

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
        if (!this.props.fileInfos || this.props.fileInfos.length === 0) {
            return null;
        }

        let plusMore = null;
        if (this.props.fileInfos.length > 1) {
            plusMore = (
                <FormattedMessage
                    id='post_body.plusMore'
                    defaultMessage=' plus {count, number} other {count, plural, one {file} other {files}}'
                    values={{
                        count: this.props.fileInfos.length
                    }}
                />
            );
        }

        return (
            <span>
                {this.props.fileInfos[0].name}
                {plusMore}
            </span>
        );
    }
}
