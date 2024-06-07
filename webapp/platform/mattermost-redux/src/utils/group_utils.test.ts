// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    filterGroupsMatchingTerm,
} from './group_utils';

describe('group utils', () => {
    describe('filterGroupsMatchingTerm', () => {
        const groupA = {
            id: 'groupid1',
            name: 'board.group',
            description: 'group1 description',
            display_name: 'board.group',
            source: 'ldap',
            remote_id: 'group1',
            create_at: 1,
            update_at: 2,
            delete_at: 0,
            has_syncables: true,
            member_count: 3,
            scheme_admin: false,
            allow_reference: true,
        };
        const groupB = {
            id: 'groupid2',
            name: 'developers-group',
            description: 'group2 description',
            display_name: 'developers-group',
            source: 'ldap',
            remote_id: 'group2',
            create_at: 1,
            update_at: 2,
            delete_at: 0,
            has_syncables: true,
            member_count: 3,
            scheme_admin: false,
            allow_reference: true,
        };
        const groupC = {
            id: 'groupid3',
            name: 'softwareengineers',
            description: 'group3 description',
            display_name: 'software engineers',
            source: 'ldap',
            remote_id: 'group3',
            create_at: 1,
            update_at: 2,
            delete_at: 0,
            has_syncables: true,
            member_count: 3,
            scheme_admin: false,
            allow_reference: true,
        };
        const groups = [groupA, groupB, groupC];

        it('should match all for empty filter', () => {
            expect(filterGroupsMatchingTerm(groups, '')).toEqual([groupA, groupB, groupC]);
        });

        it('should filter out results which do not match', () => {
            expect(filterGroupsMatchingTerm(groups, 'testBad')).toEqual([]);
        });

        it('should match by name', () => {
            expect(filterGroupsMatchingTerm(groups, 'softwareengineers')).toEqual([groupC]);
        });

        it('should match by split part of the name', () => {
            expect(filterGroupsMatchingTerm(groups, 'group')).toEqual([groupA, groupB]);
            expect(filterGroupsMatchingTerm(groups, 'board')).toEqual([groupA]);
        });

        it('should match by split part of the display name', () => {
            expect(filterGroupsMatchingTerm(groups, 'engineers')).toEqual([groupC]);
        });

        it('should match by display_name fully', () => {
            expect(filterGroupsMatchingTerm(groups, 'software engineers')).toEqual([groupC]);
        });

        it('should match by display_name case-insensitive', () => {
            expect(filterGroupsMatchingTerm(groups, 'software ENGINEERS')).toEqual([groupC]);
        });

        it('should ignore leading @ for name', () => {
            expect(filterGroupsMatchingTerm(groups, '@developers')).toEqual([groupB]);
        });

        it('should ignore leading @ for display_name', () => {
            expect(filterGroupsMatchingTerm(groups, '@software')).toEqual([groupC]);
        });
    });
});
