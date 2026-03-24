// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import WithTooltip from 'components/with_tooltip';

import './image_controls_bar.scss';

type Props = {
    canZoomIn: boolean;
    canZoomOut: boolean;
    isFlipHorizontal: boolean;
    isFlipVertical: boolean;
    handleZoomIn: () => void;
    handleZoomOut: () => void;
    handleRotateClockwise: () => void;
    handleRotateCounterClockwise: () => void;
    handleFlipHorizontal: () => void;
    handleFlipVertical: () => void;
}

export default function ImageControlsBar({
    canZoomIn,
    canZoomOut,
    isFlipHorizontal,
    isFlipVertical,
    handleZoomIn,
    handleZoomOut,
    handleRotateClockwise,
    handleRotateCounterClockwise,
    handleFlipHorizontal,
    handleFlipVertical,
}: Props) {
    return (
        <div className='modal-button-bar file-preview-modal__image-controls-bar'>
            <div className='file-preview-modal-image-controls'>
                <WithTooltip
                    title={
                        <FormattedMessage
                            id='view_image.zoom_out'
                            defaultMessage='Zoom Out'
                        />
                    }
                >
                    <button
                        type='button'
                        className='file-preview-modal-main-actions__action-item'
                        onClick={handleZoomOut}
                        aria-label='Zoom out'
                        disabled={!canZoomOut}
                    >
                        <i className='icon icon-minus'/>
                    </button>
                </WithTooltip>
                <WithTooltip
                    title={
                        <FormattedMessage
                            id='view_image.zoom_in'
                            defaultMessage='Zoom In'
                        />
                    }
                >
                    <button
                        type='button'
                        className='file-preview-modal-main-actions__action-item'
                        onClick={handleZoomIn}
                        aria-label='Zoom in'
                        disabled={!canZoomIn}
                    >
                        <i className='icon icon-plus'/>
                    </button>
                </WithTooltip>
                <WithTooltip
                    title={
                        <FormattedMessage
                            id='view_image.rotate_counter_clockwise'
                            defaultMessage='Rotate Counter Clockwise'
                        />
                    }
                >
                    <button
                        type='button'
                        className='file-preview-modal-main-actions__action-item'
                        onClick={handleRotateCounterClockwise}
                        aria-label='Rotate counter clockwise'
                    >
                        <i className='icon icon-refresh file-preview-modal-image-controls__rotate-ccw'/>
                    </button>
                </WithTooltip>
                <WithTooltip
                    title={
                        <FormattedMessage
                            id='view_image.rotate_clockwise'
                            defaultMessage='Rotate Clockwise'
                        />
                    }
                >
                    <button
                        type='button'
                        className='file-preview-modal-main-actions__action-item'
                        onClick={handleRotateClockwise}
                        aria-label='Rotate clockwise'
                    >
                        <i className='icon icon-refresh'/>
                    </button>
                </WithTooltip>
                <WithTooltip
                    title={
                        <FormattedMessage
                            id='view_image.flip_horizontal'
                            defaultMessage='Flip Horizontal'
                        />
                    }
                >
                    <button
                        type='button'
                        className={classNames(
                            'file-preview-modal-main-actions__action-item',
                            'file-preview-modal-image-controls__flip-button',
                            {'active': isFlipHorizontal},
                        )}
                        onClick={handleFlipHorizontal}
                        aria-label='Flip horizontal'
                    >
                        <span className='file-preview-modal-image-controls__flip-label'>{'H'}</span>
                    </button>
                </WithTooltip>
                <WithTooltip
                    title={
                        <FormattedMessage
                            id='view_image.flip_vertical'
                            defaultMessage='Flip Vertical'
                        />
                    }
                >
                    <button
                        type='button'
                        className={classNames(
                            'file-preview-modal-main-actions__action-item',
                            'file-preview-modal-image-controls__flip-button',
                            {'active': isFlipVertical},
                        )}
                        onClick={handleFlipVertical}
                        aria-label='Flip vertical'
                    >
                        <span className='file-preview-modal-image-controls__flip-label'>{'V'}</span>
                    </button>
                </WithTooltip>
            </div>
        </div>
    );
}
