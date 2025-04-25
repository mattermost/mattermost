// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

export type AttachmentTextOverflowType = 'ellipsis';

const MAX_POST_HEIGHT = 600;
const MARGIN_CHANGE_FOR_COMPACT_POST = 22;

type Props = {
    children?: React.ReactNode;
    checkOverflow?: number;
    isAttachmentText?: boolean;
    text?: string;
    compactDisplay: boolean;
    overflowType?: AttachmentTextOverflowType;
    maxHeight?: number;
}

type State = {
    isCollapsed: boolean;
    isOverflow: boolean;
}

export default class ShowMore extends React.PureComponent<Props, State> {
    private maxHeight: number;
    private textContainer: React.RefObject<HTMLDivElement>;
    private overflowRef?: number;
    private resizeObserver: ResizeObserver | null = null;

    constructor(props: Props) {
        super(props);
        this.maxHeight = this.props.maxHeight || MAX_POST_HEIGHT;
        this.textContainer = React.createRef();
        this.state = {
            isCollapsed: true,
            isOverflow: false,
        };
    }

    componentDidMount() {
        this.setupResizeObserver();

        // Initial check for overflow
        this.checkTextOverflow();
    }

    componentDidUpdate(prevProps: Props) {
        // Only manually check for overflow when text content changes or when explicitly requested
        // ResizeObserver will handle size changes caused by other factors
        if (
            this.props.text !== prevProps.text ||
            this.props.checkOverflow !== prevProps.checkOverflow
        ) {
            this.checkTextOverflow();
        }
    }

    componentWillUnmount() {
        if (this.overflowRef) {
            window.cancelAnimationFrame(this.overflowRef);
        }
        this.cleanupResizeObserver();
    }

    setupResizeObserver = () => {
        if (!this.textContainer.current || !window.ResizeObserver) {
            // ResizeObserver is not supported in this browser or the container is not available yet
            return;
        }

        // Clean up any existing observer before creating a new one
        // This prevents multiple observers in case setupResizeObserver is called more than once
        this.cleanupResizeObserver();

        // Create a new ResizeObserver to watch for size changes in the text container
        this.resizeObserver = new ResizeObserver(() => {
            // When the size of the text container changes, check if we need to show/hide the "Show More" button
            this.checkTextOverflow();
        });

        // Start observing the text container
        this.resizeObserver.observe(this.textContainer.current);
    };

    cleanupResizeObserver = () => {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
    };

    toggleCollapse = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();
        e.stopPropagation();
        this.setState((prevState) => {
            return {
                isCollapsed: !prevState.isCollapsed,
            };
        });
    };

    checkTextOverflow = () => {
        if (this.overflowRef) {
            window.cancelAnimationFrame(this.overflowRef);
        }
        this.overflowRef = window.requestAnimationFrame(() => {
            let isOverflow = false;

            if (this.textContainer.current && this.textContainer.current.scrollHeight > this.maxHeight) {
                isOverflow = true;
            }

            if (isOverflow !== this.state.isOverflow) {
                this.setState({
                    isOverflow,
                });
            }
        });
    };

    render() {
        const {
            isCollapsed,
            isOverflow,
        } = this.state;

        const {
            children,
            isAttachmentText,
            compactDisplay,
            overflowType,
        } = this.props;

        let className = 'post-message';
        let collapsedMaxHeightStyle: number | undefined;
        if (isCollapsed) {
            collapsedMaxHeightStyle = this.maxHeight;
            className += ' post-message--collapsed';
        } else {
            className += ' post-message--expanded';
        }

        const collapseShowMoreClass = isAttachmentText ? 'post-attachment-collapse__show-more' : 'post-collapse__show-more';

        let attachmentTextOverflow = null;
        if (isOverflow) {
            if (!isAttachmentText && isCollapsed && compactDisplay) {
                if (collapsedMaxHeightStyle) {
                    collapsedMaxHeightStyle -= MARGIN_CHANGE_FOR_COMPACT_POST;
                }
            }

            let showIcon = 'fa fa-angle-up';
            let showText = (
                <FormattedMessage
                    id='post_info.message.show_less'
                    defaultMessage='Show less'
                />
            );
            if (isCollapsed) {
                showIcon = 'fa fa-angle-down';
                showText = (
                    <FormattedMessage
                        id='post_info.message.show_more'
                        defaultMessage='Show more'
                    />
                );
            }
            switch (overflowType) {
            case 'ellipsis':
                attachmentTextOverflow = (
                    <button
                        id='showMoreButton'
                        className='post-preview-collapse__show-more-button color--link'
                        onClick={this.toggleCollapse}
                    >
                        {showText}
                    </button>
                );
                className += ' post-message-preview--overflow';
                break;

            default:
                attachmentTextOverflow = (
                    <div className='post-collapse'>
                        <div className={collapseShowMoreClass}>
                            <div className='post-collapse__show-more-line'/>
                            <button
                                id='showMoreButton'
                                className='post-collapse__show-more-button'
                                onClick={this.toggleCollapse}
                            >
                                <span className={showIcon}/>
                                {showText}
                            </button>
                            <div className='post-collapse__show-more-line'/>
                        </div>
                    </div>
                );
                className += ' post-message--overflow';
                break;
            }
        }

        return (
            <div className={className}>
                <div
                    style={{maxHeight: collapsedMaxHeightStyle}}
                    className='post-message__text-container'
                    ref={this.textContainer}
                >
                    {children}
                </div>
                {attachmentTextOverflow}
            </div>
        );
    }
}
