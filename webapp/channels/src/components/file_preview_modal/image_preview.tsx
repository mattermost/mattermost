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
    handleCloseModal: () => void;
}

interface ScaleOption {
    value: number | string;
    label: string;
    key: string;
}

export default function ImagePreview({fileInfo, canDownloadFiles, handleCloseModal}: Props) {
    const isExternalFile = !fileInfo.id;
    const {formatMessage} = useIntl();
    const [scale, setScale] = React.useState(1);
    const [baseScale, setBaseScale] = React.useState(1);
    const [scaleOptions, setScaleOptions] = React.useState<ScaleOption[]>([]);
    const imageRef = React.useRef<HTMLImageElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const transformWrapperRef = React.useRef<ReactZoomPanPinchRef | null>(null);

    const selectZoomLevel = (newScale: number) => {
        if (transformWrapperRef.current) {
            const {wrapperComponent, contentComponent} = transformWrapperRef.current.instance;

            if (wrapperComponent && contentComponent) {
                const bounds = calculateBoundsForNewScale(newScale, wrapperComponent, contentComponent);

                const newPositionX = (bounds.maxPositionX + bounds.minPositionX) / 2;
                const newPositionY = (bounds.maxPositionY + bounds.minPositionY) / 2;

                transformWrapperRef.current?.setTransform(newPositionX, newPositionY, newScale);
            }
        }
    };

    function calculateBoundsForNewScale(newScale: number, wrapperComponent: HTMLDivElement, contentComponent: HTMLDivElement) {
        const wrapperWidth = wrapperComponent.offsetWidth;
        const wrapperHeight = wrapperComponent.offsetHeight;

        const contentWidth = contentComponent.offsetWidth;
        const contentHeight = contentComponent.offsetHeight;

        const newContentWidth = contentWidth * newScale;
        const newContentHeight = contentHeight * newScale;
        const newDiffWidth = wrapperWidth - newContentWidth;
        const newDiffHeight = wrapperHeight - newContentHeight;

        const scaleWidthFactor = wrapperWidth > newContentWidth ? newDiffWidth : 0;
        const scaleHeightFactor = wrapperHeight > newContentHeight ? newDiffHeight : 0;

        const minPositionX = wrapperWidth - newContentWidth - scaleWidthFactor;
        const maxPositionX = scaleWidthFactor;
        const minPositionY = wrapperHeight - newContentHeight - scaleHeightFactor;
        const maxPositionY = scaleHeightFactor;

        return {minPositionX, maxPositionX, minPositionY, maxPositionY};
    }

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
        function handleClickOutside(event: { clientX: number; clientY: number }) {
            if (containerRef.current && imageRef.current) {
                const linkRect = containerRef.current.getBoundingClientRect();
                const imageRect = imageRef.current.getBoundingClientRect();

                const insideLink = event.clientX >= linkRect.left &&
                                  event.clientX <= linkRect.right &&
                                  event.clientY >= linkRect.top &&
                                  event.clientY <= linkRect.bottom;

                const insideImage = event.clientX >= imageRect.left &&
                                    event.clientX <= imageRect.right &&
                                    event.clientY >= imageRect.top &&
                                    event.clientY <= imageRect.bottom;

                if (insideLink && !insideImage) {
                    if (document.fullscreenElement) {
                        document.exitFullscreen();
                    }
                    handleCloseModal();
                }
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [handleCloseModal]);

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

    const handleTransformed = React.useCallback(
        (e) => setScale(e.state.scale),
        [],
    );

    if (!canDownloadFiles) {
        return <img src={previewUrl}/>;
    }

    return (
        <TransformWrapper
            onTransformed={handleTransformed}
            ref={transformWrapperRef}
            centerOnInit={true}
        >
            {({zoomIn, zoomOut}) => (
                <div className='image_preview_wrapper'>
                    <div className='image_preview_zoom_actions__actions'>
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
                            id='zoomSelectTooltip'
                            title={formatMessage({id: 'file_preview_modal_image_zoom_actions.zoom_select', defaultMessage: 'Zoom'})}
                            placement='top'
                        >
                            <select
                                className='image_preview_zoom_actions__select-item'
                                value={scale}
                                onChange={(e) => selectZoomLevel(parseFloat(e.target.value))}
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
                    <div
                        className='image_preview__content'
                        ref={containerRef}
                    >
                        <a
                            className='image_preview'
                            href='#'
                        >
                            <TransformComponent
                                wrapperClass='image_preview__transform-wrapper'
                            >
                                <img
                                    className='image_preview__image'
                                    loading='lazy'
                                    data-testid='imagePreview'
                                    alt={'preview url image'}
                                    src={previewUrl}
                                    ref={imageRef}
                                />
                            </TransformComponent>
                        </a>
                    </div>
                </div>
            )}
        </TransformWrapper>
    );
}
