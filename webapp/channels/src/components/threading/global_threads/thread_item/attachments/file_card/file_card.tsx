// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, memo} from 'react';
import cn from 'classnames';

import {FileInfo} from '@mattermost/types/files';
import {fileSizeToString, getCompassIconClassName, getFileType} from 'utils/utils';

import {getFileThumbnailUrl, getFileUrl} from 'mattermost-redux/utils/file_utils';
import {FileTypes} from 'utils/constants';

import './file_card.scss';

type Props = {
    file?: FileInfo;
    enableSVGs: boolean;
}

type FileProps = FileInfo & {
    enableSVGs: boolean;
}

type CardProps = {
    children?: React.ReactElement<typeof Image>;
    title: string;
    size?: number;
}

function File({
    id,
    has_preview_image: hasPreviewImage,
    mini_preview: miniPreview,
    mime_type: mimeType,
    extension,
    enableSVGs,
}: FileProps) {
    const imgSrc = useMemo(() => {
        if (!hasPreviewImage) {
            return undefined;
        }
        if (miniPreview) {
            return `data:${mimeType};base64,${miniPreview}`;
        }
        return getFileThumbnailUrl(id);
    }, [id, miniPreview, mimeType, hasPreviewImage]);

    const fileType = getFileType(extension);

    switch (fileType) {
    case FileTypes.SVG:
        if (enableSVGs) {
            return (
                <img
                    alt='file preview'
                    className='file_card__image post-image small'
                    src={getFileUrl(id)}
                />
            );
        }
        return (
            <div
                className={cn(
                    'icon',
                    'icon-20',
                    getCompassIconClassName(fileType),
                    'file_card__attachment',
                )}
            />
        );
    case FileTypes.IMAGE:
        return (
            <img
                alt='file preview'
                className='file_card__image post-image small'
                src={imgSrc}
            />
        );
    default:
        return (
            <i
                className={cn(
                    'icon',
                    'icon-20',
                    getCompassIconClassName(fileType),
                    'file_card__attachment',
                )}
            />
        );
    }
}

function Card({children, title, size}: CardProps) {
    return (
        <div
            className='file_card'
            title={title}
        >
            {children}
            <div className='file_card__name'>
                {title}
            </div>
            {size != null && (
                <div className='file_card__size'>
                    {fileSizeToString(size)}
                </div>
            )}
        </div>
    );
}

function FileCard({file, enableSVGs}: Props) {
    if (!file) {
        return null;
    }

    return (
        <Card
            title={file.name}
            size={file.size}
        >
            <File
                enableSVGs={enableSVGs}
                {...file}
            />
        </Card>
    );
}

export default memo(FileCard);
