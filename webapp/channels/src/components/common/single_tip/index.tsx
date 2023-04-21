// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import Tippy from '@tippyjs/react';
import {Placement} from 'tippy.js';
import {createGlobalStyle} from 'styled-components';

import 'tippy.js/dist/tippy.css';
import 'tippy.js/themes/light-border.css';
import 'tippy.js/animations/scale-subtle.css';
import 'tippy.js/animations/perspective-subtle.css';

import classNames from 'classnames';
interface Props {
    placement?: Placement;
    children: React.ReactNode;
    tippyBlueStyle?: boolean;
    contentRef: any;
    offset?: [number, number];
    width?: string | number;
    zIndex?: number;
    className?: string;
    show: boolean;
    handleDismiss?: (e: React.MouseEvent) => void;
    hideBackdrop?: boolean;
}
import {TourTipBackdrop} from '@mattermost/components';

// onPunchOut={handlePunchOut}
// interactivePunchOut={interactivePunchOut}
export default function SingleTip(props: Props) {
    const rootPortal = document.getElementById('root-portal') || document.body;
    const content = (
        <div>
            <div>
                <span onClick={props.handleDismiss}>{'x'}</span>
            </div>
            <div>
                {props.children}
            </div>
        </div>
    );
    return (
        <>
            <GlobalStyle/>
            <TourTipBackdrop
                show={props.show}
                onDismiss={props.handleDismiss}
                overlayPunchOut={null}
                appendTo={rootPortal!}
                transparent={props.hideBackdrop}
            />
            <Tippy
                showOnCreate={props.show}
                content={content}
                animation='scale-subtle'
                trigger='click'
                duration={[250, 150]}
                maxWidth={props.width}
                aria={{content: 'labelledby'}}
                allowHTML={true}
                zIndex={props.zIndex}
                reference={props.contentRef}
                interactive={true}
                appendTo={rootPortal!}
                offset={props.offset}
                className={classNames(
                    'tour-tip__box',
                    props.className,
                    {'tippy-blue-style': props.tippyBlueStyle},
                )}
                placement={props.placement}
            />
        </>
    );
}

const GlobalStyle = createGlobalStyle`
        .tippy-box {
            padding: 18px 24px 24px;
            border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
            background: var(--center-channel-bg);
            border-radius: 4px;
            color: var(--center-channel-color-rgb);
            filter: drop-shadow(0 12px 32px rgba(0, 0, 0, 0.12));

            .tippy-content {
                padding: 0;
            }

            .tippy-arrow {
                width: 12px;
                height: 12px;
                border-color: rgba(var(--center-channel-color-rgb), 0.16);
                color: var(--center-channel-bg);
            }

            .tippy-arrow::before {
                width: 12px;
                height: 12px;
                border-color: rgba(var(--center-channel-color-rgb), 0.16);
                background: var(--center-channel-bg);
                color: var(--center-channel-bg);
                transform-origin: center;
            }

            // fix for https://mattermost.atlassian.net/browse/MM-41711. This covers the current placements we use for the channels and other tools tour
            &[data-placement^=right] > .tippy-arrow {
                transform: translate3d(0, 14px, 0) !important;
            }

            &[data-placement^=top] > .tippy-arrow {
                transform: translate3d(14px, 0, 0) !important;
            }

            &[data-placement^=bottom] > .tippy-arrow {
                transform: translate3d(14px, 0, 0) !important;
            }

            &[data-placement=bottom-end] > .tippy-arrow {
                transform: translate3d(317px, 0, 0) !important;
            }
        }

// adding important as temporary fix, will be removing tippy very soon (WIP)
.tippy-box[data-placement^=right] > .tippy-arrow::before {
    top: -1px !important;
    border-width: 1px 0 0 1px !important;
    transform: rotate(-45deg) !important;
}

.tippy-box[data-placement^=left] > .tippy-arrow::before {
    top: -1px !important;
    border-width: 1px 1px 0 0 !important;
    transform: rotate(45deg) !important;
}

.tippy-box[data-placement^=bottom] > .tippy-arrow::before {
    left: 1px !important;
    border-width: 1px 0 0 1px !important;
    transform: rotate(45deg) !important;
}

.tippy-box[data-placement^=top] > .tippy-arrow::before {
    left: 1px !important;
    border-width: 0 0 1px 1px !important;
    transform: rotate(-45deg) !important;
}

// this style is defined outside of the block scope because is intended to affect the tippy element
.tippy-blue-style {
    background: var(--button-bg) !important;
    color: var(--sidebar-text) !important;

    .tippy-arrow {
        border-color: var(--button-bg) !important;
        color: var(--button-bg) !important;

        &::before {
            border-width: 0 !important;
            border-color: var(--button-bg) !important;
            border-left-color: initial;
            background-color: var(--button-bg) !important;
            transform-origin: unset !important;
        }
    }

    .tour-tip__header {
        font-weight: 600;
    }

    .icon-close {
        color: var(--sidebar-text) !important;
    }

    // style buttons while in the blue style
    .tour-tip {
        &__btn {
            background: var(--button-color);
            color: var(--button-bg);

            &:hover,
            &:active,
            &:focus {
                background: var(--button-color);
                color: var(--button-bg);
            }
        }

        &__dot-ring {
            .tour-tip__dot {
                background: var(--offline-indicator);
            }
        }

        &__dot-ring-active {
            .active {
                background: var(--button-color);
            }
        }
    }
}`;
