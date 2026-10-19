// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyValue} from '@mattermost/types/properties';

import {ContentFlaggingTypes} from 'mattermost-redux/action_types';

import contentFlaggingReducer from './content_flagging';

function makeValue(overrides: Partial<PropertyValue<unknown>> = {}): PropertyValue<unknown> {
    return {
        id: 'value-1',
        target_id: 'post-1',
        target_type: 'post',
        group_id: 'content_flagging',
        field_id: 'field-1',
        value: 'test',
        create_at: 1000,
        update_at: 1000,
        delete_at: 0,
        created_by: 'user-1',
        updated_by: 'user-1',
        ...overrides,
    };
}

function valuesByFieldId(values: Array<PropertyValue<unknown>>) {
    return Object.fromEntries(values.map((value) => [value.field_id, value]));
}

describe('Reducers.ContentFlagging', () => {
    test('CONTENT_FLAGGING_REPORT_VALUE_UPDATED stores values for posts without cached values', () => {
        const value = makeValue({field_id: 'review_status', value: 'removed'});

        const state = contentFlaggingReducer(undefined, {
            type: ContentFlaggingTypes.CONTENT_FLAGGING_REPORT_VALUE_UPDATED,
            data: {
                target_id: 'post-1',
                property_values: JSON.stringify([value]),
            },
        });

        expect(state.postValues['post-1']).toEqual([value]);
    });

    test('CONTENT_FLAGGING_REPORT_VALUE_UPDATED merges updated values with cached values', () => {
        const existingValue = makeValue({field_id: 'review_status', value: 'pending'});
        const retainedValue = makeValue({id: 'value-2', field_id: 'reason', value: 'data_spillage'});
        const updatedValue = makeValue({field_id: 'review_status', value: 'removed'});

        const stateWithValues = contentFlaggingReducer(undefined, {
            type: ContentFlaggingTypes.RECEIVED_POST_CONTENT_FLAGGING_VALUES,
            data: {
                postId: 'post-1',
                values: [existingValue, retainedValue],
            },
        });

        const state = contentFlaggingReducer(stateWithValues, {
            type: ContentFlaggingTypes.CONTENT_FLAGGING_REPORT_VALUE_UPDATED,
            data: {
                target_id: 'post-1',
                property_values: JSON.stringify([updatedValue]),
            },
        });

        expect(state.postValues['post-1']).toHaveLength(2);
        expect(valuesByFieldId(state.postValues['post-1'])).toEqual({
            review_status: updatedValue,
            reason: retainedValue,
        });
    });

    test('CONTENT_FLAGGING_REPORT_VALUE_UPDATED merges multiple values and preserves other posts', () => {
        const existingValue = makeValue({field_id: 'review_status', value: 'pending'});
        const retainedValue = makeValue({id: 'value-2', field_id: 'reason', value: 'data_spillage'});
        const otherPostValue = makeValue({id: 'value-3', target_id: 'post-2', field_id: 'review_status', value: 'pending'});
        const updatedValue = makeValue({field_id: 'review_status', value: 'removed'});
        const newValue = makeValue({id: 'value-4', field_id: 'removal_type', value: 'permanent'});

        const stateWithPostOne = contentFlaggingReducer(undefined, {
            type: ContentFlaggingTypes.RECEIVED_POST_CONTENT_FLAGGING_VALUES,
            data: {
                postId: 'post-1',
                values: [existingValue, retainedValue],
            },
        });
        const stateWithValues = contentFlaggingReducer(stateWithPostOne, {
            type: ContentFlaggingTypes.RECEIVED_POST_CONTENT_FLAGGING_VALUES,
            data: {
                postId: 'post-2',
                values: [otherPostValue],
            },
        });

        const state = contentFlaggingReducer(stateWithValues, {
            type: ContentFlaggingTypes.CONTENT_FLAGGING_REPORT_VALUE_UPDATED,
            data: {
                target_id: 'post-1',
                property_values: JSON.stringify([updatedValue, newValue]),
            },
        });

        expect(state.postValues['post-1']).toHaveLength(3);
        expect(valuesByFieldId(state.postValues['post-1'])).toEqual({
            review_status: updatedValue,
            reason: retainedValue,
            removal_type: newValue,
        });
        expect(state.postValues['post-2']).toEqual([otherPostValue]);
    });

    test('CONTENT_FLAGGING_REPORT_VALUE_UPDATED ignores malformed property values', () => {
        const stateWithValues = contentFlaggingReducer(undefined, {
            type: ContentFlaggingTypes.RECEIVED_POST_CONTENT_FLAGGING_VALUES,
            data: {
                postId: 'post-1',
                values: [makeValue({field_id: 'review_status', value: 'pending'})],
            },
        });

        expect(() => contentFlaggingReducer(stateWithValues, {
            type: ContentFlaggingTypes.CONTENT_FLAGGING_REPORT_VALUE_UPDATED,
            data: {
                target_id: 'post-1',
                property_values: '{',
            },
        })).not.toThrow();

        const state = contentFlaggingReducer(stateWithValues, {
            type: ContentFlaggingTypes.CONTENT_FLAGGING_REPORT_VALUE_UPDATED,
            data: {
                target_id: 'post-1',
                property_values: '{',
            },
        });

        expect(state).toBe(stateWithValues);
    });

    test('CONTENT_FLAGGING_REPORT_VALUE_UPDATED ignores valid non-array property values', () => {
        const stateWithValues = contentFlaggingReducer(undefined, {
            type: ContentFlaggingTypes.RECEIVED_POST_CONTENT_FLAGGING_VALUES,
            data: {
                postId: 'post-1',
                values: [makeValue({field_id: 'review_status', value: 'pending'})],
            },
        });

        const state = contentFlaggingReducer(stateWithValues, {
            type: ContentFlaggingTypes.CONTENT_FLAGGING_REPORT_VALUE_UPDATED,
            data: {
                target_id: 'post-1',
                property_values: '{}',
            },
        });

        expect(state).toBe(stateWithValues);
    });

    test('CONTENT_FLAGGING_REPORT_VALUE_UPDATED tolerates non-array cached values', () => {
        const updatedValue = makeValue({field_id: 'review_status', value: 'removed'});
        const invalidState = {
            settings: {},
            fields: {},
            postValues: {
                'post-1': {
                    invalid: true,
                },
            },
            flaggedPosts: {},
            channels: {},
            teams: {},
        };

        const state = contentFlaggingReducer(invalidState as unknown as Parameters<typeof contentFlaggingReducer>[0], {
            type: ContentFlaggingTypes.CONTENT_FLAGGING_REPORT_VALUE_UPDATED,
            data: {
                target_id: 'post-1',
                property_values: JSON.stringify([updatedValue]),
            },
        });

        expect(state.postValues['post-1']).toEqual([updatedValue]);
    });

    describe('FLAGGED_POST_REMOVED', () => {
        test('clears the flagged post and its property values for the given post id', () => {
            const value = makeValue({field_id: 'review_status', value: 'pending'});
            const otherValue = makeValue({id: 'value-2', target_id: 'post-2', field_id: 'review_status', value: 'pending'});

            const flaggedPost = {id: 'post-1'} as any;
            const otherFlaggedPost = {id: 'post-2'} as any;

            const stateWithValues = contentFlaggingReducer(undefined, {
                type: ContentFlaggingTypes.RECEIVED_POST_CONTENT_FLAGGING_VALUES,
                data: {
                    postId: 'post-1',
                    values: [value],
                },
            });
            const stateWithOtherValues = contentFlaggingReducer(stateWithValues, {
                type: ContentFlaggingTypes.RECEIVED_POST_CONTENT_FLAGGING_VALUES,
                data: {
                    postId: 'post-2',
                    values: [otherValue],
                },
            });
            const stateWithFlaggedPost = contentFlaggingReducer(stateWithOtherValues, {
                type: ContentFlaggingTypes.RECEIVED_FLAGGED_POST,
                data: flaggedPost,
            });
            const stateWithBothFlaggedPosts = contentFlaggingReducer(stateWithFlaggedPost, {
                type: ContentFlaggingTypes.RECEIVED_FLAGGED_POST,
                data: otherFlaggedPost,
            });

            const state = contentFlaggingReducer(stateWithBothFlaggedPosts, {
                type: ContentFlaggingTypes.FLAGGED_POST_REMOVED,
                data: {postId: 'post-1'},
            });

            expect(state.postValues['post-1']).toBeUndefined();
            expect(state.flaggedPosts['post-1']).toBeUndefined();
            expect(state.postValues['post-2']).toEqual([otherValue]);
            expect(state.flaggedPosts['post-2']).toEqual(otherFlaggedPost);
        });

        test('returns the same state reference when the post id is not present', () => {
            const value = makeValue({field_id: 'review_status', value: 'pending'});

            const stateWithValues = contentFlaggingReducer(undefined, {
                type: ContentFlaggingTypes.RECEIVED_POST_CONTENT_FLAGGING_VALUES,
                data: {
                    postId: 'post-1',
                    values: [value],
                },
            });

            const state = contentFlaggingReducer(stateWithValues, {
                type: ContentFlaggingTypes.FLAGGED_POST_REMOVED,
                data: {postId: 'unknown-post'},
            });

            expect(state.postValues).toBe(stateWithValues.postValues);
            expect(state.flaggedPosts).toBe(stateWithValues.flaggedPosts);
        });

        test('is a no-op when postId is missing from the action data', () => {
            const value = makeValue({field_id: 'review_status', value: 'pending'});
            const flaggedPost = {id: 'post-1'} as any;

            const stateWithValues = contentFlaggingReducer(undefined, {
                type: ContentFlaggingTypes.RECEIVED_POST_CONTENT_FLAGGING_VALUES,
                data: {
                    postId: 'post-1',
                    values: [value],
                },
            });
            const stateWithFlaggedPost = contentFlaggingReducer(stateWithValues, {
                type: ContentFlaggingTypes.RECEIVED_FLAGGED_POST,
                data: flaggedPost,
            });

            const state = contentFlaggingReducer(stateWithFlaggedPost, {
                type: ContentFlaggingTypes.FLAGGED_POST_REMOVED,
                data: {},
            });

            expect(state.postValues['post-1']).toEqual([value]);
            expect(state.flaggedPosts['post-1']).toEqual(flaggedPost);
        });
    });
});
