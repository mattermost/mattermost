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

const CommentedOnFilesMessage = ({
    fileInfos,
}: Props) => {
    if (!fileInfos || fileInfos.length === 0) {
        return null;
    }

    let plusMore = null;
    if (fileInfos.length > 1) {
        plusMore = (
            <FormattedMessage
                id='post_body.plusMore'
                defaultMessage=' plus {count, number} other {count, plural, one {file} other {files}}'
                values={{
                    count: fileInfos.length - 1,
                }}
            />
        );
    }

    return (
        <span data-testid='fileInfo'>
            {fileInfos[0].name}
            {plusMore}
        </span>
    );
};

export default React.memo(CommentedOnFilesMessage);
