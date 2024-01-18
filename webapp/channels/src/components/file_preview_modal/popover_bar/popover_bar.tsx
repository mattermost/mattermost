// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import debounce from 'lodash/debounce';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

import {Constants, ZoomSettings} from 'utils/constants';

export interface Props {
    scale?: number;
    showZoomControls?: boolean;
    handleZoomIn?: () => void;
    handleZoomOut?: () => void;
    handleZoomReset?: () => void;
}

export default class PopoverBar extends React.PureComponent<Props> {
    render() {
        const zoomControls: React.ReactNode[] = [];
        let wrappedZoomControls: React.ReactNode = null;
        if (this.props.showZoomControls) {
            let zoomResetButton;
            let zoomOutButton;
            let zoomInButton;

            if (this.props.scale && this.props.scale > ZoomSettings.MIN_SCALE) {
                zoomOutButton = (
                    <span className='modal-zoom-btn'>
                        <a onClick={this.props.handleZoomOut && debounce(this.props.handleZoomOut, 300, {maxWait: 300})}>
                            <i className='icon icon-minus'/>
                        </a>
                    </span>
                );
            } else {
                zoomOutButton = (
                    <span className='btn-inactive'>
                        <i className='icon icon-minus'/>
                    </span>
                );
            }
            zoomControls.push(
                <OverlayTrigger
                    delayShow={Constants.OVERLAY_TIME_DELAY}
                    key='zoomOut'
                    placement='top'
                    overlay={
                        <Tooltip id='zoom-out-icon-tooltip'>
                            <FormattedMessage
                                id='view_image.zoom_out'
                                defaultMessage='Zoom Out'
                            />
                        </Tooltip>
                    }
                >
                    {zoomOutButton}
                </OverlayTrigger>,
            );

            if (this.props.scale && this.props.scale > ZoomSettings.DEFAULT_SCALE) {
                zoomResetButton = (
                    <span className='modal-zoom-btn'>
                        <a onClick={this.props.handleZoomReset}>
                            <i className='icon icon-magnify-minus'/>
                        </a>
                    </span>
                );
            } else if (this.props.scale && this.props.scale < ZoomSettings.DEFAULT_SCALE) {
                zoomResetButton = (
                    <span className='modal-zoom-btn'>
                        <a onClick={this.props.handleZoomReset}>
                            <i className='icon icon-magnify-plus'/>
                        </a>
                    </span>
                );
            } else {
                zoomResetButton = (
                    <span className='btn-inactive'>
                        <i className='icon icon-magnify-minus'/>
                    </span>
                );
            }
            zoomControls.push(
                <OverlayTrigger
                    delayShow={Constants.OVERLAY_TIME_DELAY}
                    key='zoomReset'
                    placement='top'
                    overlay={
                        <Tooltip id='zoom-reset-icon-tooltip'>
                            <FormattedMessage
                                id='view_image.zoom_reset'
                                defaultMessage='Reset Zoom'
                            />
                        </Tooltip>
                    }
                >
                    {zoomResetButton}
                </OverlayTrigger>,
            );

            if (this.props.scale && this.props.scale < ZoomSettings.MAX_SCALE) {
                zoomInButton = (
                    <span className='modal-zoom-btn'>
                        <a onClick={this.props.handleZoomIn && debounce(this.props.handleZoomIn, 300, {maxWait: 300})}>
                            <i className='icon icon-plus'/>
                        </a>
                    </span>

                );
            } else {
                zoomInButton = (
                    <span className='btn-inactive'>
                        <i className='icon icon-plus'/>
                    </span>
                );
            }
            zoomControls.push(
                <OverlayTrigger
                    delayShow={Constants.OVERLAY_TIME_DELAY}
                    key='zoomIn'
                    placement='top'
                    overlay={
                        <Tooltip id='zoom-in-icon-tooltip'>
                            <FormattedMessage
                                id='view_image.zoom_in'
                                defaultMessage='Zoom In'
                            />
                        </Tooltip>
                    }
                >
                    {zoomInButton}
                </OverlayTrigger>,
            );

            wrappedZoomControls = (
                <div className='modal-column'>
                    {zoomControls}
                </div>
            );
        }

        return (
            <div
                data-testid='fileCountFooter'
                className='modal-button-bar file-preview-modal__zoom-bar'
            >
                {wrappedZoomControls}
            </div>
        );
    }
}
