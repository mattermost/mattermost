// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {DraggableProvidedDragHandleProps} from 'react-beautiful-dnd';

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

export const SidebarCategoryHeader = React.forwardRef((props: Props, ref?: React.Ref<HTMLButtonElement>) => {
    const {dragHandleProps} = props;

    // (Accessibility) Ensures interactive controls are not nested as they are not always announced
    // by screen readers or can cause focus problems for assistive technologies.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    delete dragHandleProps?.role;

    return (
        <div
            className={classNames('SidebarChannelGroupHeader', {
                muted: props.muted,
                dragging: props.isDragging,
            })}
        >
            <button
                ref={ref}
                className={classNames('SidebarChannelGroupHeader_groupButton')}
                aria-label={props.displayName}
                onClick={props.onClick}
            >
                <i
                    className={classNames('icon icon-chevron-down', {
                        'icon-rotate-minus-90': props.isCollapsed,
                        'hide-arrow': !props.isCollapsible,
                    })}
                />
                <div
                    className='SidebarChannelGroupHeader_text'
                    {...dragHandleProps}
                >
                    {wrapEmojis(props.displayName)}
                </div>
            </button>
            {props.children}
        </div>
    );
});
SidebarCategoryHeader.defaultProps = {
    isCollapsible: true,
    isDragging: false,
    isDraggingOver: false,
};
SidebarCategoryHeader.displayName = 'SidebarCategoryHeader';
