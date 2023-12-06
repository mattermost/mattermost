// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';

import type {FileInfo} from '@mattermost/types/files';
import type {Post} from '@mattermost/types/posts';

import FilePreviewModalInfo from '../file_preview_modal_info/file_preview_modal_info';
import FilePreviewModalMainActions from '../file_preview_modal_main_actions/file_preview_modal_main_actions';
import type {LinkInfo} from '../types';

import './file_preview_modal_footer.scss';

interface Props {
    fileInfo: FileInfo | LinkInfo;
    filename: string;
    post?: Post;
    fileURL: string;
    showPublicLink?: boolean;
    enablePublicLink: boolean;
    canDownloadFiles: boolean;
    isExternalFile: boolean;
    handleModalClose: () => void;
    canCopyContent: boolean;
    content: string;
}

const FilePreviewModalFooter: React.FC<Props> = ({post, ...actionProps}: Props) => {
    return (
        <div className='file-preview-modal-footer'>
            <FilePreviewModalInfo
                showFileName={false}
                post={post}
                filename={actionProps.filename}
            />
            <FilePreviewModalMainActions
                {...actionProps}
                showClose={false}
                usedInside='Footer'
                showOnlyClose={false}
            />
        </div>
    );
};
export default memo(FilePreviewModalFooter);
