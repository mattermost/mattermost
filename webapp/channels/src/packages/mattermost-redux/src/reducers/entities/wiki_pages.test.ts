// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserTypes, WikiTypes} from 'mattermost-redux/action_types';

import wikiPagesReducer from './wiki_pages';

describe('wiki_pages reducer', () => {
    const initialState = null;

    describe('Page Status', () => {
        describe('RECEIVED_PAGE_STATUS_FIELD', () => {
            test('should store status field definition', () => {
                const statusField = {
                    id: 'status_field_id',
                    name: 'status',
                    type: 'select',
                    attrs: {
                        options: [
                            {id: 'rough_draft', name: 'rough_draft', color: 'light_grey'},
                            {id: 'in_progress', name: 'in_progress', color: 'light_blue'},
                            {id: 'in_review', name: 'in_review', color: 'dark_blue'},
                            {id: 'done', name: 'done', color: 'green'},
                        ],
                    },
                };

                const nextState = wikiPagesReducer(initialState as any, {
                    type: WikiTypes.RECEIVED_PAGE_STATUS_FIELD,
                    data: statusField,
                });

                expect(nextState).toEqual(statusField);
                expect(nextState?.attrs?.options).toHaveLength(4);
            });

            test('should replace existing status field', () => {
                const oldField = {
                    id: 'old_field_id',
                    name: 'status',
                    type: 'select',
                    attrs: {
                        options: [{id: 'draft', name: 'draft', color: 'grey'}],
                    },
                };

                const newField = {
                    id: 'new_field_id',
                    name: 'status',
                    type: 'select',
                    attrs: {
                        options: [
                            {id: 'rough_draft', name: 'rough_draft', color: 'light_grey'},
                            {id: 'done', name: 'done', color: 'green'},
                        ],
                    },
                };

                const nextState = wikiPagesReducer(oldField as any, {
                    type: WikiTypes.RECEIVED_PAGE_STATUS_FIELD,
                    data: newField,
                });

                expect(nextState).toEqual(newField);
                expect(nextState?.id).toBe('new_field_id');
            });
        });

        describe('LOGOUT_SUCCESS', () => {
            test('should reset to null on logout', () => {
                const stateWithField = {id: 'field_id', name: 'status', type: 'select', attrs: {options: []}} as any;

                const nextState = wikiPagesReducer(stateWithField, {
                    type: UserTypes.LOGOUT_SUCCESS,
                });

                expect(nextState).toBeNull();
            });
        });

        describe('State immutability', () => {
            test('RECEIVED_PAGE_STATUS_FIELD should not mutate original state', () => {
                const originalField = {id: 'original', name: 'status', type: 'select', attrs: {options: []}};
                const frozen = Object.freeze(originalField) as any;

                const statusField = {
                    id: 'field_id',
                    name: 'status',
                    type: 'select',
                    attrs: {options: [{id: 'draft', name: 'draft', color: 'grey'}]},
                };

                const nextState = wikiPagesReducer(frozen, {
                    type: WikiTypes.RECEIVED_PAGE_STATUS_FIELD,
                    data: statusField,
                });

                expect(nextState).not.toBe(frozen);
                expect(originalField.id).toBe('original');
            });
        });
    });
});
