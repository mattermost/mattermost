// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Ambient module declaration for @tiptap/react v3.7.2 subpath imports
// This allows TypeScript with moduleResolution: "node" to recognize the '@tiptap/react/menus' import
// The runtime bundler/Node will still resolve this correctly via package.json "exports"

declare module '@tiptap/react/menus' {
    import type {Placement, Middleware} from '@floating-ui/dom';
    import type {Editor} from '@tiptap/core';
    import type React from 'react';

    export interface BubbleMenuProps {
        editor: Editor | null;
        children?: React.ReactNode;
        shouldShow?: ((props: {
            editor: Editor;
            view: unknown;
            state: unknown;
            oldState: unknown;
            from: number;
            to: number;
        }) => boolean) | null;
        options?: {
            placement?: Placement;
            offset?: number | {
                mainAxis?: number;
                crossAxis?: number;
                alignmentAxis?: number | null;
            };
            middleware?: Middleware[];
        };
        className?: string;
        pluginKey?: string | unknown;
        updateDelay?: number;
    }

    export const BubbleMenu: React.FC<BubbleMenuProps>;

    export interface FloatingMenuProps {
        editor: Editor | null;
        children?: React.ReactNode;
        shouldShow?: ((props: {
            editor: Editor;
            view: unknown;
            state: unknown;
            oldState: unknown;
        }) => boolean) | null;
        options?: {
            placement?: Placement;
            offset?: number | {
                mainAxis?: number;
                crossAxis?: number;
                alignmentAxis?: number | null;
            };
            middleware?: Middleware[];
        };
        className?: string;
        pluginKey?: string | unknown;
    }

    export const FloatingMenu: React.FC<FloatingMenuProps>;
}
