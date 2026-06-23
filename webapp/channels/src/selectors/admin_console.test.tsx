// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import AdminDefinition from 'components/admin_console/admin_definition';

import type {GlobalState} from 'types/store';

import {getAdminDefinition} from './admin_console';

type TestReducerState = {
    something?: string;
    otherThing?: string;
};

describe('Selectors.AdminConsole', () => {
    describe('get admin definitions', () => {
        it('should return the default admin definition if there is not plugins', () => {
            const state = {plugins: {adminConsoleReducers: {}}} as GlobalState;
            expect(getAdminDefinition(state)).toEqual(AdminDefinition);
        });

        it('should allow to remove everything with a plugin', () => {
            const result = getAdminDefinition({
                plugins: {
                    adminConsoleReducers: {clean: () => ({})},
                },
            } as unknown as GlobalState);
            expect(result).toEqual({});
        });

        it('should allow to add a value to the existing definition', () => {
            const result = getAdminDefinition({
                plugins: {
                    adminConsoleReducers: {
                        'add-something': (data: TestReducerState) => {
                            return {
                                ...data,
                                something: 'test',
                            };
                        },
                    },
                },
            } as unknown as GlobalState);
            expect(result.something).toEqual('test');
        });

        it('should allow to use multiple plugins', () => {
            type TestReducerState = {
                something?: string;
                otherThing?: string;
            };
            const result = getAdminDefinition({
                plugins: {
                    adminConsoleReducers: {
                        'add-something': (data: TestReducerState) => {
                            return {
                                ...data,
                                something: 'test',
                            };
                        },
                        'add-other-thing': (data: TestReducerState) => {
                            return {
                                ...data,
                                otherThing: 'other-thing',
                            };
                        },
                    },
                },
            } as unknown as GlobalState);
            expect(result.something).toEqual('test');
            expect(result.otherThing).toEqual('other-thing');
        });
    });
});
