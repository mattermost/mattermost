// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect, useRef} from 'react';

import type {FileInfo} from '@mattermost/types/files';

import {getFilePreviewUrl, getFileDownloadUrl} from 'mattermost-redux/utils/file_utils';

import './image_preview.scss';

interface Props {
    fileInfo: FileInfo;
    canDownloadFiles: boolean;
    scale?: number;
    translate?: {x: number; y: number};
    isZoomed?: boolean;
    isDragging?: boolean;
    onWheel?: (e: WheelEvent) => void;
    onMouseDown?: (e: React.MouseEvent<HTMLElement>) => void;
}

function buildTransform(scale?: number, translate?: {x: number; y: number}): string | undefined {
    const hasScale = scale !== undefined && scale !== 1;
    const hasTranslate = translate && (translate.x !== 0 || translate.y !== 0);
    if (!hasScale && !hasTranslate) {
        return undefined;
    }
    const parts: string[] = [];
    if (hasTranslate) {
        parts.push(`translate(${translate.x}px, ${translate.y}px)`);
    }
    if (hasScale) {
        parts.push(`scale(${scale})`);
    }
    return parts.join(' ');
}

export default function ImagePreview({fileInfo, canDownloadFiles, scale, translate, isZoomed, isDragging, onWheel, onMouseDown}: Props) {
    const isExternalFile = !fileInfo.id;

    // React's synthetic wheel events are passive by default in modern React, so
    // e.preventDefault() inside them is a no-op. Bind a native non-passive
    // listener via ref so the page can't scroll while zooming the image.
    const wrapperRef = useRef<HTMLElement | null>(null);
    useEffect(() => {
        const node = wrapperRef.current;
        if (!node || !onWheel) {
            return undefined;
        }
        node.addEventListener('wheel', onWheel, {passive: false});
        return () => node.removeEventListener('wheel', onWheel);
    }, [onWheel]);

    let fileUrl;
    let previewUrl;
    if (isExternalFile) {
        fileUrl = fileInfo.link;
        previewUrl = fileInfo.link;
    } else {
        fileUrl = getFileDownloadUrl(fileInfo.id);
        previewUrl = fileInfo.has_preview_image ? getFilePreviewUrl(fileInfo.id) : fileUrl;
    }

    const transform = buildTransform(scale, translate);
    const imgStyle: React.CSSProperties = {};
    if (transform) {
        imgStyle.transform = transform;
    }
    if (isZoomed) {
        imgStyle.cursor = 'grab';
    }
    const imgClassName = classNames('image_preview__image', {
        'image_preview__image--zoomed': isZoomed,
    });
    const wrapperClassName = classNames('image_preview', {
        'image_preview--dragging': isDragging,
    });

    if (!canDownloadFiles) {
        return (
            <span
                ref={wrapperRef as React.RefObject<HTMLSpanElement>}
                className={wrapperClassName}
                onMouseDown={onMouseDown}
            >
                <img
                    className={imgClassName}
                    src={previewUrl}
                    style={imgStyle}
                    draggable={false}
                />
            </span>
        );
    }

    const preventLinkNav = (e: React.SyntheticEvent) => e.preventDefault();

    return (
        <a
            ref={wrapperRef as React.RefObject<HTMLAnchorElement>}
            className={wrapperClassName}
            href='#'
            onMouseDown={onMouseDown}
            onClick={preventLinkNav}
            onDragStart={preventLinkNav}
        >
            <img
                className={imgClassName}
                loading='lazy'
                data-testid='imagePreview'
                alt={'preview url image'}
                src={previewUrl}
                style={imgStyle}
                draggable={false}
            />
        </a>
    );
}
