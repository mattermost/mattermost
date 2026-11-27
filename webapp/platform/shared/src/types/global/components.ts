// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentType, ReactElement, ReactNode} from 'react';

import type {Post} from '@mattermost/types/posts';

// Plugin-facing contract for window.WebappUtils.components. The web app asserts
// each shape stays assignable to the real component at build time in
// published_components.ts.

export type PublishedWithTooltipProps = {
    title: ReactNode;
    hint?: ReactNode;
    id?: string;

    // Vertical (above or below the trigger) by default.
    isVertical?: boolean;
    className?: string;
    disabled?: boolean;

    // Cloned with a ref for positioning: a native element, or a component that
    // forwards its ref and remaining props to the DOM element it renders.
    children: ReactElement<any>;
};

/**
 * @experimental May change or be removed without the usual deprecation period.
 */
export type PublishedPostReactionsProps = {
    post: Post; // the post does not have to be in the posts store

    // Shows the add-reaction chip on its own when the post has no reactions.
    showAddButtonWhenEmpty?: boolean;
};

export type PublishedComponentProps = {
    WithTooltip: PublishedWithTooltipProps;

    /**
     * @experimental May change or be removed without the usual deprecation period.
     */
    PostReactions: PublishedPostReactionsProps;
};

export type PublishedComponents = {
    [K in keyof PublishedComponentProps]: ComponentType<PublishedComponentProps[K]>;
};
