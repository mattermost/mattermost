// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {DraggableProvidedDragHandleProps} from 'react-beautiful-dnd';

import {wrapEmojis} from 'utils/emoji_utils';

type StaticProps = {
    children?: React.ReactNode;
    displayName: string;
}

export const SidebarCategoryHeaderStatic = React.forwardRef((props: StaticProps, ref?: React.Ref<HTMLDivElement>) => {
    return (
        <div className='SidebarChannelGroupHeader SidebarChannelGroupHeader--static'>
            <div
                ref={ref}
                className='SidebarChannelGroupHeader_groupButton'
            >
                <div className='SidebarChannelGroupHeader_text'>
                    {wrapEmojis(props.displayName)}
                </div>
                {props.children}
            </div>
        </div>
    );
});
SidebarCategoryHeaderStatic.displayName = 'SidebarCategoryHeaderStatic';

type Props = StaticProps & {
    dragHandleProps?: DraggableProvidedDragHandleProps;
    isCollapsed: boolean;
    isCollapsible: boolean;
    isDragging?: boolean;
    isDraggingOver?: boolean;
    muted: boolean;
    onClick: (event: React.MouseEvent<HTMLElement>) => void;
}

export const SidebarCategoryHeader = React.forwardRef(({
    children,
    displayName,
    dragHandleProps,
    isCollapsed,
    isCollapsible = true,
    isDragging = false,
    muted,
    onClick,
}: Props, ref?: React.Ref<HTMLButtonElement>) => {
    // (Accessibility) Ensures interactive controls are not nested as they are not always announced
    // by screen readers or can cause focus problems for assistive technologies.
    if (dragHandleProps && dragHandleProps.role) {
        Reflect.deleteProperty(dragHandleProps, 'role');
    }

    return (
        <div
            className={classNames('SidebarChannelGroupHeader', {
                muted,
                dragging: isDragging,
            })}
        >
            <button
                ref={ref}
                className={classNames('SidebarChannelGroupHeader_groupButton')}
                aria-label={displayName}
                onClick={onClick}
                aria-expanded={!isCollapsed}
            >
                <i
                    className={classNames('icon icon-chevron-down', {
                        'icon-rotate-minus-90': isCollapsed,
                        'hide-arrow': !isCollapsible,
                    })}
                />
                <div
                    className='SidebarChannelGroupHeader_text'
                    {...dragHandleProps}
                    tabIndex={-1}
                >
                    {wrapEmojis(displayName)}
                </div>
            </button>
            {children}
        </div>
    );
});
SidebarCategoryHeader.displayName = 'SidebarCategoryHeader';
