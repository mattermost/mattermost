// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import type {ReactZoomPanPinchRef} from 'react-zoom-pan-pinch';
import {TransformWrapper, TransformComponent} from 'react-zoom-pan-pinch';

import type {FileInfo} from '@mattermost/types/files';

import {getFilePreviewUrl, getFileDownloadUrl} from 'mattermost-redux/utils/file_utils';

import './image_preview.scss';
import WithTooltip from 'components/with_tooltip';

interface Props {
    fileInfo: FileInfo;
    canDownloadFiles: boolean;
}

interface ScaleOption {
    value: number | string;
    label: string;
    key: string;
}

export default function ImagePreview({fileInfo, canDownloadFiles}: Props) {
    const isExternalFile = !fileInfo.id;
    const {formatMessage} = useIntl();
    const [scale, setScale] = React.useState(1);
    const [baseScale, setBaseScale] = React.useState(1);
    const [scaleOptions, setScaleOptions] = React.useState<ScaleOption[]>([]);
    const imageRef = React.useRef<HTMLImageElement>(null);
    const transformWrapperRef = React.useRef<ReactZoomPanPinchRef | null>(null);

    const selectZoomLevel = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newScale = parseFloat(e.target.value);
        if (transformWrapperRef.current) {
            const {wrapperComponent} = transformWrapperRef.current.instance;

            if (wrapperComponent) {
                const originalWidth = wrapperComponent.offsetWidth;
                const originalHeight = wrapperComponent.offsetHeight;

                const scaledWidth = originalWidth * newScale;
                const scaledHeight = originalHeight * newScale;

                const newX = (originalWidth - scaledWidth) / 2;
                const newY = (originalHeight - scaledHeight) / 2;

                transformWrapperRef.current?.setTransform(newX, newY, newScale);
            }
        }
    };

    const toggleFullscreen = () => {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            const elem = document.documentElement;
            elem.requestFullscreen();
        }
    };

    let fileUrl: string | undefined;
    let previewUrl: string | undefined;
    if (isExternalFile) {
        fileUrl = fileInfo.link;
        previewUrl = fileInfo.link;
    } else {
        fileUrl = getFileDownloadUrl(fileInfo.id);
        previewUrl = fileInfo.has_preview_image ? getFilePreviewUrl(fileInfo.id) : fileUrl;
    }

    const computeScaleOptions = React.useCallback(() => {
        const imgEl = imageRef.current;

        if (imgEl) {
            setBaseScale(imgEl.naturalWidth / imgEl.clientWidth);
            setScaleOptions([
                {
                    key: 'auto',
                    value: 1,
                    label: formatMessage({id: 'file_preview_modal_image_zoom_actions.select.auto', defaultMessage: 'Automatic zoom'}),
                },
                {
                    key: 'actual',
                    value: Math.round((imgEl.naturalWidth / imgEl.clientWidth) * 1000) / 1000, // round to 3 decimal places to prevent a duplicate value conflict with 100%
                    label: formatMessage({id: 'file_preview_modal_image_zoom_actions.select.actual_size', defaultMessage: 'Actual size'}),
                },
                ...[50, 75, 100, 125, 150, 200, 300, 400].map((level) => ({
                    key: `${level}%`,
                    value: Math.round((imgEl.naturalWidth / imgEl.clientWidth) * level) / 100,
                    label: `${level}%`,
                })),
            ]);
        }
    }, [formatMessage]);

    React.useEffect(() => {
        const imgEl = imageRef.current;

        const handleLoad = () => {
            computeScaleOptions();
        };

        imgEl?.addEventListener('load', handleLoad);

        return () => {
            imgEl?.removeEventListener('load', handleLoad);
        };
    }, [imageRef, computeScaleOptions]);

    React.useEffect(() => {
        const onFullscreenChange = () => {
            // delay for fullscreen to actually toggle on / off
            setTimeout(computeScaleOptions, 100);
        };

        document.addEventListener('fullscreenchange', onFullscreenChange);

        return () => {
            document.removeEventListener('fullscreenchange', onFullscreenChange);
        };
    }, [computeScaleOptions]);

    if (!canDownloadFiles) {
        return <img src={previewUrl}/>;
    }

    return (
        <a
            className='image_preview'
            href='#'
        >
            <TransformWrapper
                onTransformed={(e) => setScale(e.state.scale)}
                ref={transformWrapperRef}
            >
                {({zoomIn, zoomOut}) => (
                    <>
                        <div className='image_preview_zoom_actions__actions'>
                            <WithTooltip
                                id='zoomInTooltip'
                                title={formatMessage({id: 'file_preview_modal_image_zoom_actions.zoom_in', defaultMessage: 'Zoom in'})}
                                placement='top'
                            >
                                <button
                                    onClick={() => zoomIn()}
                                    className='image_preview_zoom_actions__action-item'
                                >
                                    <i className='icon icon-plus'/>
                                </button>
                            </WithTooltip>
                            <WithTooltip
                                id='zoomOutTooltip'
                                title={formatMessage({id: 'file_preview_modal_image_zoom_actions.zoom_out', defaultMessage: 'Zoom out'})}
                                placement='top'
                            >
                                <button
                                    onClick={() => zoomOut()}
                                    className='image_preview_zoom_actions__action-item'
                                    disabled={scale <= 1}
                                >
                                    <i className='icon icon-minus'/>
                                </button>
                            </WithTooltip>
                            <WithTooltip
                                id='zoomSelectTooltip'
                                title={formatMessage({id: 'file_preview_modal_image_zoom_actions.zoom_select', defaultMessage: 'Zoom'})}
                                placement='top'
                            >
                                <select
                                    className='image_preview_zoom_actions__select-item'
                                    value={scale}
                                    onChange={selectZoomLevel}
                                >
                                    {scaleOptions.map((o) => o.value).includes(scale) ? null : (
                                        <option
                                            className='image_preview_zoom_actions__select-item-option'
                                            value={scale}
                                            hidden={true}
                                        >
                                            {`${Math.round((scale / baseScale) * 100)}%`}
                                        </option>
                                    )}
                                    {scaleOptions.map((opt) => (
                                        <option
                                            key={opt.key}
                                            value={opt.value}
                                            className='image_preview_zoom_actions__select-item-option'
                                        >
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </WithTooltip>
                            <WithTooltip
                                id='fullscreenTooltip'
                                title={formatMessage({id: 'file_preview_modal_image_zoom_actions.fullscreen', defaultMessage: 'Fullscreen'})}
                                placement='top'
                            >
                                <button
                                    onClick={toggleFullscreen}
                                    className='image_preview_zoom_actions__action-item'
                                >
                                    <i className='icon icon-arrow-expand-all'/>
                                </button>
                            </WithTooltip>
                        </div>
                        <TransformComponent>
                            <img
                                className='image_preview__image'
                                loading='lazy'
                                data-testid='imagePreview'
                                alt={'preview url image'}
                                src={previewUrl}
                                ref={imageRef}
                            />
                        </TransformComponent>
                    </>
                )}
            </TransformWrapper>
        </a>
    );
}
