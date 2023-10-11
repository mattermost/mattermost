// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getUserOptionsFromFilter, searchUserOptionsFromFilter, isActive} from './filter_users';
import type {FilterOptions} from './filter_users';

describe('filter_users', () => {
    describe('getUserOptionsFromFilter', () => {
        it('should return empty options in case of empty filter', () => {
            const filters: FilterOptions = getUserOptionsFromFilter('');
            expect(filters).toEqual({});
        });

        it('should return empty options in case of undefined', () => {
            const filters: FilterOptions = getUserOptionsFromFilter(undefined);
            expect(filters).toEqual({});
        });

        it('should return role options in case of system_admin', () => {
            const filters: FilterOptions = getUserOptionsFromFilter('system_admin');
            expect(filters).toEqual({role: 'system_admin'});
        });

        it('should return inactive option in case of inactive', () => {
            const filters: FilterOptions = getUserOptionsFromFilter('inactive');
            expect(filters).toEqual({inactive: true});
        });
    });
    describe('searchUserOptionsFromFilter', () => {
        it('should return empty options in case of empty filter', () => {
            const filters: FilterOptions = searchUserOptionsFromFilter('');
            expect(filters).toEqual({});
        });

        it('should return empty options in case of undefined', () => {
            const filters: FilterOptions = searchUserOptionsFromFilter(undefined);
            expect(filters).toEqual({});
        });

        it('should return role options in case of system_admin', () => {
            const filters: FilterOptions = searchUserOptionsFromFilter('system_admin');
            expect(filters).toEqual({role: 'system_admin'});
        });

        it('should return allow_inactive option in case of inactive', () => {
            const filters: FilterOptions = searchUserOptionsFromFilter('inactive');
            expect(filters).toEqual({allow_inactive: true});
        });
    });
    describe('isActive', () => {
        it('should return true for an active user', () => {
            const active = isActive({delete_at: 0});
            expect(active).toEqual(true);
        });
        it('should return false for an inactive user', () => {
            const active = isActive({delete_at: 1});
            expect(active).toEqual(false);
        });
    });
});
