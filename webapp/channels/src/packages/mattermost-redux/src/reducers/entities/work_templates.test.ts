// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {WorkTemplatesType} from 'mattermost-redux/action_types';
import reducer from 'mattermost-redux/reducers/entities/work_templates';

type ReducerState = ReturnType<typeof reducer>;

describe('Reducers.worktemplates', () => {
    it('categories', () => {
        const state = {
            categories: [],
        };
        const action = {
            type: WorkTemplatesType.RECEIVED_WORK_TEMPLATE_CATEGORIES,
            data: [{
                id: 'product_team',
                name: 'Product Team',
            }],
        };
        const expectedState = {
            categories: [
                {
                    id: 'product_team',
                    name: 'Product Team',
                },
            ],
        };

        const newState = reducer(state as unknown as ReducerState, action);
        expect(newState.categories).toEqual(expectedState.categories);
    });

    it('work templates in a category', () => {
        const state = {
            templatesInCategory: {},
        };

        const action = {
            type: WorkTemplatesType.RECEIVED_WORK_TEMPLATES,
            data: [{
                id: 'product_teams/feature_release:v1',
                category: 'product_teams',
                useCase: 'Feature Release',
                illustration: 'https://via.placeholder.com/204x123.png',
                visibility: 'public',
                description: {
                    channel: {
                        message: 'channel message',
                        illustration: '',
                    },
                },
                content: [{
                    channel: {
                        id: 'feature-release',
                        name: 'Feature Release',
                        purpose: '',
                        playbook: 'product-release-playbook',
                        illustration: 'https://via.placeholder.com/509x352.png?text=Channel&#43;feature&#43;release',
                    },
                }],
            }],
        };

        const expectedState = {
            templatesInCategory: {
                product_teams: [
                    {
                        id: 'product_teams/feature_release:v1',
                        category: 'product_teams',
                        useCase: 'Feature Release',
                        illustration: 'https://via.placeholder.com/204x123.png',
                        visibility: 'public',
                        description: {
                            channel: {
                                message: 'channel message',
                                illustration: '',
                            },
                        },
                        content: [{
                            channel: {
                                id: 'feature-release',
                                name: 'Feature Release',
                                purpose: '',
                                playbook: 'product-release-playbook',
                                illustration: 'https://via.placeholder.com/509x352.png?text=Channel&#43;feature&#43;release',
                            },
                        }],
                    },
                ],
            },
        };

        const newState = reducer(state as ReducerState, action);
        expect(newState.templatesInCategory).toEqual(expectedState.templatesInCategory);
    });
});
