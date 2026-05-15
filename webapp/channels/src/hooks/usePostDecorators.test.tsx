// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {clearLoggedPostDecoratorErrors} from 'selectors/post_decorator';

import {renderHookWithContext} from 'tests/react_testing_utils';

import type {PostDecoratorRegistration} from 'types/store/plugins';

import {usePostDecorators} from './usePostDecorators';

function makePost(partial: Partial<Post> = {}): Post {
    return {
        id: 'post-1',
        channel_id: 'channel-1',
        create_at: 0,
        delete_at: 0,
        edit_at: 0,
        hashtags: '',
        is_pinned: false,
        message: 'test message',
        metadata: {embeds: [], emojis: [], files: [], images: {}, reactions: []},
        original_id: '',
        pending_post_id: '',
        props: {},
        reply_count: 0,
        type: '',
        update_at: 0,
        user_id: 'user-1',
        ...partial,
    } as Post;
}

function makeRegistration(partial: Partial<PostDecoratorRegistration> = {}): PostDecoratorRegistration {
    return {
        id: 'reg-1',
        pluginId: 'test-plugin',
        slot: 'post_header_badge',
        matcher: () => true,
        component: () => null,
        ...partial,
    } as PostDecoratorRegistration;
}

describe('hooks/usePostDecorators', () => {
    beforeEach(() => {
        clearLoggedPostDecoratorErrors();
    });

    it('returns empty array when post is null', () => {
        const {result} = renderHookWithContext(
            () => usePostDecorators(null, 'post_header_badge'),
            {plugins: {components: {PostDecorator: []}}} as any,
        );
        expect(result.current).toEqual([]);
    });

    it('returns empty array when post is undefined', () => {
        const {result} = renderHookWithContext(
            () => usePostDecorators(undefined, 'post_header_badge'),
            {plugins: {components: {PostDecorator: []}}} as any,
        );
        expect(result.current).toEqual([]);
    });

    it('returns empty array when no decorators are registered', () => {
        const post = makePost();
        const {result} = renderHookWithContext(
            () => usePostDecorators(post, 'post_header_badge'),
            {plugins: {components: {PostDecorator: []}}} as any,
        );
        expect(result.current).toEqual([]);
    });

    it('returns selector output for a matching registration', () => {
        const post = makePost();
        const reg = makeRegistration({slot: 'post_header_badge'});
        const {result} = renderHookWithContext(
            () => usePostDecorators(post, 'post_header_badge'),
            {plugins: {components: {PostDecorator: [reg]}}} as any,
        );
        expect(result.current).toHaveLength(1);
        expect(result.current[0]).toBe(reg);
    });

    it('returns all matching registrations for additive slot', () => {
        const post = makePost();
        const reg1 = makeRegistration({id: 'r1', slot: 'post_header_badge', pluginId: 'plugin-a'});
        const reg2 = makeRegistration({id: 'r2', slot: 'post_header_badge', pluginId: 'plugin-b'});
        const {result} = renderHookWithContext(
            () => usePostDecorators(post, 'post_header_badge'),
            {plugins: {components: {PostDecorator: [reg1, reg2]}}} as any,
        );
        expect(result.current).toHaveLength(2);
    });

    it('returns same array reference when unrelated state changes (shallowEqual stability)', () => {
        const post = makePost();
        const reg = makeRegistration({slot: 'post_header_badge'});
        const initialState = {plugins: {components: {PostDecorator: [reg]}}} as any;

        const {result, replaceStoreState} = renderHookWithContext(
            () => usePostDecorators(post, 'post_header_badge'),
            initialState,
        );

        const before = result.current;

        // Replace store state with an unrelated change — PostDecorator list is identical
        replaceStoreState({
            plugins: {components: {PostDecorator: [reg]}},
            entities: {general: {config: {}}},
        } as any);

        expect(result.current).toBe(before);
    });
});
