// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {ArchiveOutlineIcon} from '@mattermost/compass-icons/components';
import type {FileInfo} from '@mattermost/types/files';

interface Props {
    fileInfo: FileInfo;
}

export default function FileInfoPreview(props: Props) {
    const intl = useIntl();

    const infoString = intl.formatMessage({
        id: 'workspace_limits.archived_file.archived',
        defaultMessage: 'This file is archived',
    });

    const preview = (
        <span className='file-details__preview file-details__preview--archived'>
            <ArchiveOutlineIcon
                size={80}
                color={'rgba(var(--center-channel-color-rgb), 0.48)'}
                data-testid='archived-file-icon'
            />
        </span>
    );

    return (
        <div className='file-details__container'>
            {preview}
            <div className='file-details'>
                <div className='file-details__name'>{props.fileInfo.name}</div>
                <div className='file-details__info'>{infoString}</div>
            </div>
        </div>
    );
}
