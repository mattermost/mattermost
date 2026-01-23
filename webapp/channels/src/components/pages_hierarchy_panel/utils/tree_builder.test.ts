// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PostType} from '@mattermost/types/posts';

import type {PostDraft} from 'types/store/draft';
import type {PageOrDraft, TreeNode} from 'types/store/pages';

import {buildTree, convertDraftToPagePost, getAncestorIds, getDescendantIds, isDescendant} from './tree_builder';

describe('tree_builder', () => {
    describe('convertDraftToPagePost', () => {
        test('converts a draft with minimal fields', () => {
            const draft: PostDraft = {
                rootId: 'draft-123',
                channelId: 'channel-1',
                message: 'Draft content',
                createAt: 1000,
                updateAt: 2000,
                props: {},
                fileInfos: [],
                uploadsInProgress: [],
                type: '' as PostType,
            };

            const result = convertDraftToPagePost(draft);

            expect(result.id).toBe('draft-123');
            expect(result.channel_id).toBe('channel-1');
            expect(result.message).toBe('Draft content');
            expect(result.create_at).toBe(1000);
            expect(result.update_at).toBe(2000);
            expect(result.props.title).toBe('Untitled');
            expect(result.page_parent_id).toBe('');
        });

        test('preserves title from draft props', () => {
            const draft: PostDraft = {
                rootId: 'draft-123',
                channelId: 'channel-1',
                message: '',
                createAt: 1000,
                updateAt: 2000,
                props: {title: 'My Draft Page'},
                fileInfos: [],
                uploadsInProgress: [],
                type: '' as PostType,
            };

            const result = convertDraftToPagePost(draft);

            expect(result.props.title).toBe('My Draft Page');
        });

        test('uses custom untitled text', () => {
            const draft: PostDraft = {
                rootId: 'draft-123',
                channelId: 'channel-1',
                message: '',
                createAt: 0,
                updateAt: 0,
                props: {},
                fileInfos: [],
                uploadsInProgress: [],
                type: '' as PostType,
            };

            const result = convertDraftToPagePost(draft, 'Custom Untitled');

            expect(result.props.title).toBe('Custom Untitled');
        });

        test('preserves page_parent_id from draft props', () => {
            const draft: PostDraft = {
                rootId: 'draft-123',
                channelId: 'channel-1',
                message: '',
                createAt: 0,
                updateAt: 0,
                props: {page_parent_id: 'parent-page-1'},
                fileInfos: [],
                uploadsInProgress: [],
                type: '' as PostType,
            };

            const result = convertDraftToPagePost(draft);

            expect(result.page_parent_id).toBe('parent-page-1');
        });
    });

    describe('buildTree', () => {
        const createPage = (id: string, title: string, pageParentId: string, createAt: number): PageOrDraft => ({
            id,
            create_at: createAt,
            update_at: createAt,
            delete_at: 0,
            edit_at: 0,
            is_pinned: false,
            user_id: 'user-1',
            channel_id: 'channel-1',
            root_id: '',
            original_id: '',
            message: '',
            type: 'page',
            page_parent_id: pageParentId,
            props: {title},
            hashtags: '',
            filenames: [],
            file_ids: [],
            pending_post_id: '',
            reply_count: 0,
            last_reply_at: 0,
            participants: null,
            metadata: {embeds: [], emojis: [], files: [], images: {}},
        });

        test('builds tree from flat list with root pages', () => {
            const pages = [
                createPage('page-1', 'Page 1', '', 1000),
                createPage('page-2', 'Page 2', '', 2000),
                createPage('page-3', 'Page 3', '', 3000),
            ];

            const tree = buildTree(pages);

            expect(tree).toHaveLength(3);
            expect(tree[0].id).toBe('page-1');
            expect(tree[1].id).toBe('page-2');
            expect(tree[2].id).toBe('page-3');
            expect(tree[0].children).toHaveLength(0);
        });

        test('builds parent-child relationships', () => {
            const pages = [
                createPage('parent', 'Parent Page', '', 1000),
                createPage('child-1', 'Child 1', 'parent', 2000),
                createPage('child-2', 'Child 2', 'parent', 3000),
            ];

            const tree = buildTree(pages);

            expect(tree).toHaveLength(1);
            expect(tree[0].id).toBe('parent');
            expect(tree[0].children).toHaveLength(2);
            expect(tree[0].children[0].id).toBe('child-1');
            expect(tree[0].children[1].id).toBe('child-2');
        });

        test('builds nested hierarchy (grandchildren)', () => {
            const pages = [
                createPage('root', 'Root', '', 1000),
                createPage('child', 'Child', 'root', 2000),
                createPage('grandchild', 'Grandchild', 'child', 3000),
            ];

            const tree = buildTree(pages);

            expect(tree).toHaveLength(1);
            expect(tree[0].id).toBe('root');
            expect(tree[0].children).toHaveLength(1);
            expect(tree[0].children[0].id).toBe('child');
            expect(tree[0].children[0].children).toHaveLength(1);
            expect(tree[0].children[0].children[0].id).toBe('grandchild');
        });

        test('orphan pages become root nodes', () => {
            const pages = [
                createPage('page-1', 'Page 1', '', 1000),
                createPage('orphan', 'Orphan', 'non-existent-parent', 2000),
            ];

            const tree = buildTree(pages);

            expect(tree).toHaveLength(2);
            expect(tree.map((n) => n.id)).toContain('page-1');
            expect(tree.map((n) => n.id)).toContain('orphan');
        });

        test('sorts nodes by create_at (oldest first)', () => {
            const pages = [
                createPage('page-3', 'Page 3', '', 3000),
                createPage('page-1', 'Page 1', '', 1000),
                createPage('page-2', 'Page 2', '', 2000),
            ];

            const tree = buildTree(pages);

            expect(tree[0].id).toBe('page-1');
            expect(tree[1].id).toBe('page-2');
            expect(tree[2].id).toBe('page-3');
        });

        test('sorts children by create_at', () => {
            const pages = [
                createPage('parent', 'Parent', '', 1000),
                createPage('child-c', 'Child C', 'parent', 4000),
                createPage('child-a', 'Child A', 'parent', 2000),
                createPage('child-b', 'Child B', 'parent', 3000),
            ];

            const tree = buildTree(pages);

            expect(tree[0].children[0].id).toBe('child-a');
            expect(tree[0].children[1].id).toBe('child-b');
            expect(tree[0].children[2].id).toBe('child-c');
        });

        test('uses ID as tiebreaker when create_at is identical', () => {
            const pages = [
                createPage('bbb', 'Page B', '', 1000),
                createPage('aaa', 'Page A', '', 1000),
                createPage('ccc', 'Page C', '', 1000),
            ];

            const tree = buildTree(pages);

            expect(tree[0].id).toBe('aaa');
            expect(tree[1].id).toBe('bbb');
            expect(tree[2].id).toBe('ccc');
        });

        test('returns empty array for empty input', () => {
            const tree = buildTree([]);
            expect(tree).toHaveLength(0);
        });

        test('preserves page reference in tree node', () => {
            const page = createPage('page-1', 'Test Page', '', 1000);
            const tree = buildTree([page]);

            expect(tree[0].page).toBe(page);
        });

        test('handles complex tree structure', () => {
            const pages = [
                createPage('root-1', 'Root 1', '', 1000),
                createPage('root-2', 'Root 2', '', 2000),
                createPage('child-1-1', 'Child 1-1', 'root-1', 3000),
                createPage('child-1-2', 'Child 1-2', 'root-1', 4000),
                createPage('child-2-1', 'Child 2-1', 'root-2', 5000),
                createPage('grandchild-1-1-1', 'Grandchild', 'child-1-1', 6000),
            ];

            const tree = buildTree(pages);

            expect(tree).toHaveLength(2);
            expect(tree[0].id).toBe('root-1');
            expect(tree[0].children).toHaveLength(2);
            expect(tree[0].children[0].children).toHaveLength(1);
            expect(tree[1].id).toBe('root-2');
            expect(tree[1].children).toHaveLength(1);
        });
    });

    describe('getAncestorIds', () => {
        const createPage = (id: string, pageParentId: string): PageOrDraft => ({
            id,
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            edit_at: 0,
            is_pinned: false,
            user_id: 'user-1',
            channel_id: 'channel-1',
            root_id: '',
            original_id: '',
            message: '',
            type: 'page',
            page_parent_id: pageParentId,
            props: {title: 'Test'},
            hashtags: '',
            filenames: [],
            file_ids: [],
            pending_post_id: '',
            reply_count: 0,
            last_reply_at: 0,
            participants: null,
            metadata: {embeds: [], emojis: [], files: [], images: {}},
        });

        test('returns empty array for root page', () => {
            const pages = [
                createPage('root', ''),
                createPage('child', 'root'),
            ];

            const ancestors = getAncestorIds(pages, 'root');

            expect(ancestors).toHaveLength(0);
        });

        test('returns parent ID for direct child', () => {
            const pages = [
                createPage('root', ''),
                createPage('child', 'root'),
            ];

            const ancestors = getAncestorIds(pages, 'child');

            expect(ancestors).toEqual(['root']);
        });

        test('returns all ancestors in order (root first)', () => {
            const pages = [
                createPage('root', ''),
                createPage('child', 'root'),
                createPage('grandchild', 'child'),
            ];

            const ancestors = getAncestorIds(pages, 'grandchild');

            expect(ancestors).toEqual(['root', 'child']);
        });

        test('handles deep nesting', () => {
            const pages = [
                createPage('level-1', ''),
                createPage('level-2', 'level-1'),
                createPage('level-3', 'level-2'),
                createPage('level-4', 'level-3'),
                createPage('level-5', 'level-4'),
            ];

            const ancestors = getAncestorIds(pages, 'level-5');

            expect(ancestors).toEqual(['level-1', 'level-2', 'level-3', 'level-4']);
        });

        test('returns empty array for non-existent page', () => {
            const pages = [createPage('root', '')];

            const ancestors = getAncestorIds(pages, 'non-existent');

            expect(ancestors).toHaveLength(0);
        });

        test('uses provided pageMap for performance', () => {
            const pages = [
                createPage('root', ''),
                createPage('child', 'root'),
            ];
            const pageMap = new Map(pages.map((p) => [p.id, p]));

            const ancestors = getAncestorIds(pages, 'child', pageMap);

            expect(ancestors).toEqual(['root']);
        });

        test('handles orphan page (parent not in list)', () => {
            const pages = [
                createPage('orphan', 'missing-parent'),
            ];

            const ancestors = getAncestorIds(pages, 'orphan');

            expect(ancestors).toEqual(['missing-parent']);
        });
    });

    describe('getDescendantIds', () => {
        const createPage = (id: string, pageParentId: string): PageOrDraft => ({
            id,
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            edit_at: 0,
            is_pinned: false,
            user_id: 'user-1',
            channel_id: 'channel-1',
            root_id: '',
            original_id: '',
            message: '',
            type: 'page',
            page_parent_id: pageParentId,
            props: {title: 'Test'},
            hashtags: '',
            filenames: [],
            file_ids: [],
            pending_post_id: '',
            reply_count: 0,
            last_reply_at: 0,
            participants: null,
            metadata: {embeds: [], emojis: [], files: [], images: {}},
        });

        test('returns empty array for page with no children', () => {
            const pages = [
                createPage('root', ''),
                createPage('sibling', ''),
            ];

            const descendants = getDescendantIds(pages, 'root');

            expect(descendants).toHaveLength(0);
        });

        test('returns direct children', () => {
            const pages = [
                createPage('root', ''),
                createPage('child-1', 'root'),
                createPage('child-2', 'root'),
            ];

            const descendants = getDescendantIds(pages, 'root');

            expect(descendants).toContain('child-1');
            expect(descendants).toContain('child-2');
            expect(descendants).toHaveLength(2);
        });

        test('returns all descendants recursively', () => {
            const pages = [
                createPage('root', ''),
                createPage('child', 'root'),
                createPage('grandchild', 'child'),
            ];

            const descendants = getDescendantIds(pages, 'root');

            expect(descendants).toContain('child');
            expect(descendants).toContain('grandchild');
            expect(descendants).toHaveLength(2);
        });

        test('returns descendants in depth-first order', () => {
            const pages = [
                createPage('root', ''),
                createPage('child-1', 'root'),
                createPage('child-2', 'root'),
                createPage('grandchild-1-1', 'child-1'),
            ];

            const descendants = getDescendantIds(pages, 'root');

            // child-1 comes first, then its child, then child-2
            const child1Index = descendants.indexOf('child-1');
            const grandchildIndex = descendants.indexOf('grandchild-1-1');

            expect(grandchildIndex).toBeGreaterThan(child1Index);
        });

        test('returns empty array for non-existent page', () => {
            const pages = [createPage('root', '')];

            const descendants = getDescendantIds(pages, 'non-existent');

            expect(descendants).toHaveLength(0);
        });
    });

    describe('isDescendant', () => {
        const createTreeNode = (id: string, children: TreeNode[] = []): TreeNode => ({
            id,
            title: 'Test',
            page: {} as PageOrDraft,
            children,
            parentId: null,
        });

        test('returns false for null source', () => {
            const target = createTreeNode('target');
            expect(isDescendant(null, target)).toBe(false);
        });

        test('returns false for null target', () => {
            const source = createTreeNode('source');
            expect(isDescendant(source, null)).toBe(false);
        });

        test('returns true when source equals target (self)', () => {
            const node = createTreeNode('node');
            expect(isDescendant(node, node)).toBe(true);
        });

        test('returns true when target is direct child of source', () => {
            const child = createTreeNode('child');
            const parent = createTreeNode('parent', [child]);

            expect(isDescendant(parent, child)).toBe(true);
        });

        test('returns true when target is grandchild of source', () => {
            const grandchild = createTreeNode('grandchild');
            const child = createTreeNode('child', [grandchild]);
            const root = createTreeNode('root', [child]);

            expect(isDescendant(root, grandchild)).toBe(true);
        });

        test('returns false when target is not descendant', () => {
            const child = createTreeNode('child');
            const parent = createTreeNode('parent', [child]);
            const sibling = createTreeNode('sibling');

            expect(isDescendant(parent, sibling)).toBe(false);
        });

        test('returns false when target is ancestor of source', () => {
            const child = createTreeNode('child');
            const parent = createTreeNode('parent', [child]);

            expect(isDescendant(child, parent)).toBe(false);
        });

        test('handles complex tree with multiple branches', () => {
            const leaf1 = createTreeNode('leaf-1');
            const leaf2 = createTreeNode('leaf-2');
            const branch1 = createTreeNode('branch-1', [leaf1]);
            const branch2 = createTreeNode('branch-2', [leaf2]);
            const root = createTreeNode('root', [branch1, branch2]);

            expect(isDescendant(root, leaf1)).toBe(true);
            expect(isDescendant(root, leaf2)).toBe(true);
            expect(isDescendant(branch1, leaf2)).toBe(false);
            expect(isDescendant(branch2, leaf1)).toBe(false);
        });
    });
});
