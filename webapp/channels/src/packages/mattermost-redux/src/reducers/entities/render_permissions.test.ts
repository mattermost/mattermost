// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {RenderPermissionsState} from '@mattermost/types/render_permissions';

import {RenderPermissionTypes, UserTypes} from 'mattermost-redux/action_types';

import reducer from './render_permissions';

describe('reducers.entities.renderPermissions', () => {
    const received = (resourceId: string, actions: Record<string, {allowed: boolean; evaluated: boolean}>, generation: number) => ({
        type: RenderPermissionTypes.RECEIVED_RENDER_DECISIONS,
        data: {resourceType: 'channel', resourceId, actions, generation, receivedAt: 1000 + generation},
    });

    test('RECEIVED_RENDER_DECISIONS stores decisions by resource/action', () => {
        const state = reducer(undefined, received('chan1', {upload_file_attachment: {allowed: false, evaluated: true}}, 1));
        expect(state.byResource.channel.chan1.upload_file_attachment).toEqual({
            allowed: false,
            evaluated: true,
            generation: 1,
            receivedAt: 1001,
        });
    });

    test('newer generation overwrites, stale generation is ignored', () => {
        let state = reducer(undefined, received('chan1', {upload_file_attachment: {allowed: false, evaluated: true}}, 5));

        // Newer generation wins.
        state = reducer(state, received('chan1', {upload_file_attachment: {allowed: true, evaluated: true}}, 6));
        expect(state.byResource.channel.chan1.upload_file_attachment.allowed).toBe(true);
        expect(state.byResource.channel.chan1.upload_file_attachment.generation).toBe(6);

        // Stale completion (older generation) must NOT overwrite.
        const before = state;
        state = reducer(state, received('chan1', {upload_file_attachment: {allowed: false, evaluated: true}}, 4));
        expect(state.byResource.channel.chan1.upload_file_attachment.allowed).toBe(true);
        expect(state.byResource.channel.chan1.upload_file_attachment.generation).toBe(6);
        expect(state).toBe(before); // unchanged reference when nothing applied
    });

    test('INVALIDATE_RENDER_DECISIONS_FOR_CHANNEL drops only that channel', () => {
        let state = reducer(undefined, received('chan1', {upload_file_attachment: {allowed: true, evaluated: true}}, 1));
        state = reducer(state, received('chan2', {upload_file_attachment: {allowed: true, evaluated: true}}, 1));

        state = reducer(state, {type: RenderPermissionTypes.INVALIDATE_RENDER_DECISIONS_FOR_CHANNEL, data: {channelId: 'chan1'}});
        expect(state.byResource.channel.chan1).toBeUndefined();
        expect(state.byResource.channel.chan2).toBeDefined();
    });

    test('INVALIDATE_RENDER_DECISIONS_FOR_CURRENT_USER clears all decisions', () => {
        let state = reducer(undefined, received('chan1', {upload_file_attachment: {allowed: true, evaluated: true}}, 1));
        state = reducer(state, {type: RenderPermissionTypes.INVALIDATE_RENDER_DECISIONS_FOR_CURRENT_USER, data: {}});
        expect(state.byResource).toEqual({});
    });

    test('CLEAR_RENDER_DECISIONS and LOGOUT_SUCCESS reset to initial', () => {
        const seeded: RenderPermissionsState = {byResource: {channel: {chan1: {upload_file_attachment: {allowed: true, evaluated: true, generation: 1, receivedAt: 1}}}}, channelsWithStalePosts: {chan1: true}};

        expect(reducer(seeded, {type: RenderPermissionTypes.CLEAR_RENDER_DECISIONS, data: {}}).byResource).toEqual({});
        expect(reducer(seeded, {type: RenderPermissionTypes.CLEAR_RENDER_DECISIONS, data: {}}).channelsWithStalePosts).toEqual({});
        expect(reducer(seeded, {type: UserTypes.LOGOUT_SUCCESS, data: {}}).byResource).toEqual({});
        expect(reducer(seeded, {type: UserTypes.LOGOUT_SUCCESS, data: {}}).channelsWithStalePosts).toEqual({});
    });

    test('MARK_CHANNEL_POSTS_STALE_FOR_REDACTION adds the channel to channelsWithStalePosts', () => {
        const state = reducer(undefined, {type: RenderPermissionTypes.MARK_CHANNEL_POSTS_STALE_FOR_REDACTION, data: {channelId: 'chan1'}});
        expect(state.channelsWithStalePosts).toEqual({chan1: true});

        // idempotent
        const state2 = reducer(state, {type: RenderPermissionTypes.MARK_CHANNEL_POSTS_STALE_FOR_REDACTION, data: {channelId: 'chan1'}});
        expect(state2).toBe(state);
    });

    test('CONSUME_CHANNEL_POSTS_STALE_FOR_REDACTION removes only the specified channel', () => {
        const seeded: RenderPermissionsState = {byResource: {}, channelsWithStalePosts: {chan1: true, chan2: true}};
        const state = reducer(seeded, {type: RenderPermissionTypes.CONSUME_CHANNEL_POSTS_STALE_FOR_REDACTION, data: {channelId: 'chan1'}});
        expect(state.channelsWithStalePosts).toEqual({chan2: true});

        // no-op when not present
        const state2 = reducer(state, {type: RenderPermissionTypes.CONSUME_CHANNEL_POSTS_STALE_FOR_REDACTION, data: {channelId: 'chan1'}});
        expect(state2).toBe(state);
    });

    test('INVALIDATE_RENDER_DECISIONS_FOR_CURRENT_USER preserves channelsWithStalePosts', () => {
        const seeded: RenderPermissionsState = {
            byResource: {channel: {chan1: {upload_file_attachment: {allowed: true, evaluated: true, generation: 1, receivedAt: 1}}}},
            channelsWithStalePosts: {chan1: true},
        };
        const state = reducer(seeded, {type: RenderPermissionTypes.INVALIDATE_RENDER_DECISIONS_FOR_CURRENT_USER, data: {}});
        expect(state.byResource).toEqual({});
        expect(state.channelsWithStalePosts).toEqual({chan1: true});
    });
});
