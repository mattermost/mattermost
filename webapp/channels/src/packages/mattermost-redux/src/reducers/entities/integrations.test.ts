// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {IntegrationTypes, UserTypes} from 'mattermost-redux/action_types';

import reducer from './integrations';

describe('reducers/entities/integrations — dialogs map', () => {
    const sampleDialog = {trigger_id: 'trigger-abc', url: 'http://example.com', dialog: {title: 'Test'}};
    const sampleDialog2 = {trigger_id: 'trigger-xyz', url: 'http://other.com', dialog: {title: 'Other'}};

    describe('RECEIVED_DIALOG', () => {
        it('adds the dialog to the map keyed by trigger_id', () => {
            const state = reducer(undefined, {type: IntegrationTypes.RECEIVED_DIALOG, data: sampleDialog});

            expect(state.dialogs).toEqual({
                'trigger-abc': sampleDialog,
            });
        });

        it('adds a second dialog without removing the first', () => {
            const after1 = reducer(undefined, {type: IntegrationTypes.RECEIVED_DIALOG, data: sampleDialog});
            const after2 = reducer(after1, {type: IntegrationTypes.RECEIVED_DIALOG, data: sampleDialog2});

            expect(after2.dialogs).toEqual({
                'trigger-abc': sampleDialog,
                'trigger-xyz': sampleDialog2,
            });
        });

        it('overwrites an existing entry when the same trigger_id is dispatched again', () => {
            const updated = {...sampleDialog, url: 'http://updated.com'};
            const after1 = reducer(undefined, {type: IntegrationTypes.RECEIVED_DIALOG, data: sampleDialog});
            const after2 = reducer(after1, {type: IntegrationTypes.RECEIVED_DIALOG, data: updated});

            expect(after2.dialogs['trigger-abc'].url).toBe('http://updated.com');
            expect(Object.keys(after2.dialogs)).toHaveLength(1);
        });

        it('does not modify state when dialog has no trigger_id', () => {
            const before = reducer(undefined, {type: '@@INIT'} as any);
            const after = reducer(before, {
                type: IntegrationTypes.RECEIVED_DIALOG,
                data: {url: 'http://example.com', dialog: {}},
            });

            expect(after.dialogs).toEqual({});
            expect(after.dialogs).toBe(before.dialogs);
        });
    });

    describe('REMOVE_DIALOG', () => {
        it('removes the entry for the given trigger_id', () => {
            const withDialog = reducer(undefined, {type: IntegrationTypes.RECEIVED_DIALOG, data: sampleDialog});
            const after = reducer(withDialog, {type: IntegrationTypes.REMOVE_DIALOG, data: 'trigger-abc'});

            expect(after.dialogs).toEqual({});
        });

        it('removes only the targeted entry when multiple dialogs are present', () => {
            const with2 = [sampleDialog, sampleDialog2].reduce(
                (s, d) => reducer(s, {type: IntegrationTypes.RECEIVED_DIALOG, data: d}),
                reducer(undefined, {type: '@@INIT'} as any),
            );

            const after = reducer(with2, {type: IntegrationTypes.REMOVE_DIALOG, data: 'trigger-abc'});

            expect(after.dialogs).toEqual({'trigger-xyz': sampleDialog2});
        });

        it('returns the same state reference when the trigger_id is not in the map', () => {
            const state = reducer(undefined, {type: '@@INIT'} as any);
            const after = reducer(state, {type: IntegrationTypes.REMOVE_DIALOG, data: 'nonexistent'});

            expect(after.dialogs).toBe(state.dialogs);
        });
    });

    describe('LOGOUT_SUCCESS', () => {
        it('clears all dialogs on logout', () => {
            const with2 = [sampleDialog, sampleDialog2].reduce(
                (s, d) => reducer(s, {type: IntegrationTypes.RECEIVED_DIALOG, data: d}),
                reducer(undefined, {type: '@@INIT'} as any),
            );
            expect(Object.keys(with2.dialogs)).toHaveLength(2);

            const after = reducer(with2, {type: UserTypes.LOGOUT_SUCCESS} as any);

            expect(after.dialogs).toEqual({});
        });
    });
});
