// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {RenderPermissionsState} from '@mattermost/types/render_permissions';

import {RenderPermissionTypes, UserTypes} from 'mattermost-redux/action_types';

import reducer from './render_permissions';

describe('reducers.entities.renderPermissions', () => {
    const received = (resourceId: string, actions: Record<string, {allowed: boolean; evaluated: boolean}>, generation: number) => ({
        type: RenderPermissionTypes.RECEIVED_RENDER_DECISIONS,
        data: {resourceType: 'channel', resourceId, actions, generation},
    });

    test('RECEIVED_RENDER_DECISIONS stores decisions by resource/action', () => {
        const state = reducer(undefined, received('chan1', {upload_file_attachment: {allowed: false, evaluated: true}}, 1));
        expect(state.byResource.channel.chan1.upload_file_attachment).toEqual({
            allowed: false,
            evaluated: true,
            generation: 1,
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
        state = reducer(state, received('chan2', {upload_file_attachment: {allowed: true, evaluated: true}}, 2));

        state = reducer(state, {type: RenderPermissionTypes.INVALIDATE_RENDER_DECISIONS_FOR_CHANNEL, data: {channelId: 'chan1', generation: 2}});
        expect(state.byResource.channel.chan1).toBeUndefined();
        expect(state.byResource.channel.chan2).toBeDefined();
    });

    test('CLEAR_RENDER_DECISIONS and LOGOUT_SUCCESS reset to initial', () => {
        const seeded: RenderPermissionsState = {
            byResource: {channel: {chan1: {upload_file_attachment: {allowed: true, evaluated: true, generation: 1}}}},
            invalidatedAt: 0,
            invalidatedAtByResource: {},
        };

        expect(reducer(seeded, {type: RenderPermissionTypes.CLEAR_RENDER_DECISIONS, data: {generation: 1}}).byResource).toEqual({});
        expect(reducer(seeded, {type: UserTypes.LOGOUT_SUCCESS, data: {}}).byResource).toEqual({});
    });

    describe('a completion that lands after an invalidation is discarded', () => {
        test('after a clear', () => {
            let state = reducer(undefined, {type: RenderPermissionTypes.CLEAR_RENDER_DECISIONS, data: {generation: 5}});

            // The in-flight fetch was dispatched before the clear, so it carries an older generation.
            state = reducer(state, received('chan1', {upload_file_attachment: {allowed: true, evaluated: true}}, 5));
            expect(state.byResource).toEqual({});

            // A fetch started after the clear repopulates it.
            state = reducer(state, received('chan1', {upload_file_attachment: {allowed: true, evaluated: true}}, 6));
            expect(state.byResource.channel.chan1.upload_file_attachment.allowed).toBe(true);
        });

        test('after a channel invalidation', () => {
            let state = reducer(undefined, {type: RenderPermissionTypes.INVALIDATE_RENDER_DECISIONS_FOR_CHANNEL, data: {channelId: 'chan1', generation: 5}});

            state = reducer(state, received('chan1', {upload_file_attachment: {allowed: true, evaluated: true}}, 5));
            expect(state.byResource).toEqual({});

            state = reducer(state, received('chan1', {upload_file_attachment: {allowed: false, evaluated: true}}, 6));
            expect(state.byResource.channel.chan1.upload_file_attachment.allowed).toBe(false);
        });

        test('but a channel invalidation does not discard another channel in flight', () => {
            let state = reducer(undefined, {type: RenderPermissionTypes.INVALIDATE_RENDER_DECISIONS_FOR_CHANNEL, data: {channelId: 'chan1', generation: 5}});

            // chan2's fetch was issued before the invalidation of chan1 but is unaffected by it.
            state = reducer(state, received('chan2', {upload_file_attachment: {allowed: true, evaluated: true}}, 5));
            expect(state.byResource.channel.chan2.upload_file_attachment.allowed).toBe(true);
            expect(state.byResource.channel.chan1).toBeUndefined();
        });

        test('tolerating state rehydrated from before the invalidation stamps existed', () => {
            const rehydrated = {byResource: {}} as RenderPermissionsState;

            const received1 = reducer(rehydrated, received('chan1', {upload_file_attachment: {allowed: true, evaluated: true}}, 1));
            expect(received1.byResource.channel.chan1.upload_file_attachment.allowed).toBe(true);

            const invalidated = reducer(rehydrated, {type: RenderPermissionTypes.INVALIDATE_RENDER_DECISIONS_FOR_CHANNEL, data: {channelId: 'chan1', generation: 1}});
            expect(invalidated.invalidatedAtByResource.channel.chan1).toBe(1);
        });
    });
});
