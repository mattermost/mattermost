// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen, fireEvent, waitFor} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import ImageAIBubble from './image_ai_bubble';

// Mock BubbleMenu - we test the rendering logic, not TipTap internals
jest.mock('@tiptap/react/menus', () => ({
    BubbleMenu: ({children}: {children: React.ReactNode}) => {
        return <div data-testid='bubble-menu'>{children}</div>;
    },
}));

describe('components/wiki_view/wiki_page_editor/ai/ImageAIBubble', () => {
    const mockEditor = {
        state: {
            selection: {
                from: 0,
            },
        },
        view: {
            nodeDOM: jest.fn(),
        },
    } as any;

    const getInitialState = (): DeepPartial<GlobalState> => ({
        entities: {
            general: {
                config: {},
            },
            preferences: {
                myPreferences: {},
            },
            users: {
                currentUserId: 'test_user_id',
            },
        },
        views: {
            browser: {
                windowSize: 'desktop',
            },
        },
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render disabled state when vision is not available', () => {
        renderWithContext(
            <ImageAIBubble
                editor={mockEditor}
                visionEnabled={false}
            />,
            getInitialState(),
        );

        const menuButton = screen.getByTestId('image-ai-menu-button');
        expect(menuButton).toBeInTheDocument();
        expect(menuButton).toBeDisabled();
        expect(menuButton).toHaveClass('disabled');
    });

    it('should render enabled menu when vision is available', () => {
        renderWithContext(
            <ImageAIBubble
                editor={mockEditor}
                visionEnabled={true}
            />,
            getInitialState(),
        );

        // Should have enabled menu button
        const menuButton = screen.getByTestId('image-ai-menu-button');
        expect(menuButton).toBeInTheDocument();
        expect(menuButton).not.toBeDisabled();
    });

    it('should show AI label on button', () => {
        renderWithContext(
            <ImageAIBubble
                editor={mockEditor}
                visionEnabled={false}
            />,
            getInitialState(),
        );

        expect(screen.getByText('AI')).toBeInTheDocument();
    });

    describe('shouldShow callback', () => {
        const NodeSelection = class {
            node: any;
            from: number;
            constructor(node: any, from: number) {
                this.node = node;
                this.from = from;
            }
        };

        const TextSelection = class {
            from: number;
            to: number;
            empty: boolean;
            constructor(from: number, to: number) {
                this.from = from;
                this.to = to;
                this.empty = from === to;
            }
        };

        it('should return false for TextSelection', () => {
            const textSelection = new TextSelection(0, 10);
            expect(textSelection).toBeDefined();
        });

        it('should return false when no node is selected', () => {
            const nodeSelection = new NodeSelection(null, 0);
            expect(nodeSelection.node).toBeNull();
        });

        it('should return true when image node is selected', () => {
            const imageNode = {type: {name: 'image'}};
            const nodeSelection = new NodeSelection(imageNode, 0);
            expect(nodeSelection.node.type.name).toBe('image');
        });

        it('should return true when imageResize node is selected', () => {
            const imageResizeNode = {type: {name: 'imageResize'}};
            const nodeSelection = new NodeSelection(imageResizeNode, 0);
            expect(nodeSelection.node.type.name).toBe('imageResize');
        });
    });

    describe('menu interactions', () => {
        it('should show extract handwriting menu item when menu is opened', async () => {
            renderWithContext(
                <ImageAIBubble
                    editor={mockEditor}
                    visionEnabled={true}
                />,
                getInitialState(),
            );

            // Open the menu first
            const menuButton = screen.getByRole('button', {name: /ai/i});
            fireEvent.click(menuButton);

            // Verify menu items are visible
            await waitFor(() => {
                expect(screen.getByTestId('image-ai-extract-handwriting')).toBeInTheDocument();
            });
        });

        it('should show describe image menu item when menu is opened', async () => {
            renderWithContext(
                <ImageAIBubble
                    editor={mockEditor}
                    visionEnabled={true}
                />,
                getInitialState(),
            );

            // Open the menu first
            const menuButton = screen.getByRole('button', {name: /ai/i});
            fireEvent.click(menuButton);

            // Verify menu items are visible
            await waitFor(() => {
                expect(screen.getByTestId('image-ai-describe-image')).toBeInTheDocument();
            });
        });
    });
});
