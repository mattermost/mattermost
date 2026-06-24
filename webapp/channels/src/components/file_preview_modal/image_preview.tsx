// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect, useRef, useState} from 'react';

import type {FileInfo} from '@mattermost/types/files';

import {getFilePreviewUrl, getFileDownloadUrl} from 'mattermost-redux/utils/file_utils';

import {FileTypes} from 'utils/constants';
import {resolveSvgWithViewBox} from 'utils/svg_preview';
import {getFileType} from 'utils/utils';

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

// useResolvedSvgUrl returns an object URL for an SVG that has no usable sizing
// information once a viewBox has been injected, so the modal can scale it instead
// of clipping it. Until that resolves (or if it cannot be resolved) it returns null
// and the caller falls back to the original preview URL.
function useResolvedSvgUrl(previewUrl: string | undefined, enabled: boolean): string | null {
    const [objectUrl, setObjectUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!enabled || !previewUrl) {
            setObjectUrl(null);
            return undefined;
        }

        let cancelled = false;
        let created: string | null = null;

        resolveSvgWithViewBox(previewUrl).then((url) => {
            if (cancelled) {
                if (url) {
                    URL.revokeObjectURL(url);
                }
                return;
            }
            created = url;
            setObjectUrl(url);
        });

        return () => {
            cancelled = true;
            if (created) {
                URL.revokeObjectURL(created);
            }
        };
    }, [previewUrl, enabled]);

    return objectUrl;
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

    const isSvg = getFileType(fileInfo.extension) === FileTypes.SVG;
    const svgWithoutDimensions = isSvg && !fileInfo.width;
    const resolvedSvgUrl = useResolvedSvgUrl(previewUrl, svgWithoutDimensions);
    const imageUrl = resolvedSvgUrl ?? previewUrl;

    const transform = buildTransform(scale, translate);
    const imgStyle: React.CSSProperties = {};
    if (transform) {
        imgStyle.transform = transform;
    }
    if (isZoomed) {
        imgStyle.cursor = 'grab';
    }
    if (isSvg) {
        if (fileInfo.width) {
            imgStyle.width = fileInfo.width;
            imgStyle.height = 'auto';
        } else if (resolvedSvgUrl) {
            // The resolved SVG carries an intrinsic size and viewBox, so let it
            // scale within the modal bounds while preserving its aspect ratio.
            imgStyle.maxWidth = 'calc(100vw - 96px)';
            imgStyle.maxHeight = 'calc(100vh - 168px)';
        } else {
            imgStyle.width = 'calc(100vw - 96px)';
            imgStyle.height = 'calc(100vh - 168px)';
        }
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
                    src={imageUrl}
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
                src={imageUrl}
                style={imgStyle}
                draggable={false}
            />
        </a>
    );
}
