// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

interface Props {

    /*
     * The id of the post that was commented on
     */
    parentPostId: string;

    /*
     * An array of file metadata for the parent post
     */
    fileInfos?: Array<{name: string}>;
}

export default class CommentedOnFilesMessage extends React.PureComponent<Props> {
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
                        count: this.props.fileInfos.length - 1,
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
