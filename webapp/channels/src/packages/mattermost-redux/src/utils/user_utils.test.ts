// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Preferences, General} from '../constants';
import {
    displayUsername,
    filterProfilesStartingWithTerm,
    filterProfilesMatchingWithTerm,
    getSuggestionsSplitBy,
    getSuggestionsSplitByMultiple,
    includesAnAdminRole,
    applyRolesFilters,
} from 'mattermost-redux/utils/user_utils';

import TestHelper from '../../test/test_helper';

describe('user utils', () => {
    describe('displayUsername', () => {
        const userObj = TestHelper.getUserMock({
            id: '100',
            username: 'testUser',
            nickname: 'nick',
            first_name: 'test',
            last_name: 'user',
        });

        it('should return username', () => {
            expect(displayUsername(userObj, 'UNKNOWN_PREFERENCE')).toBe('testUser');
        });

        it('should return nickname', () => {
            expect(displayUsername(userObj, Preferences.DISPLAY_PREFER_NICKNAME)).toBe('nick');
        });

        it('should return fullname when no nick name', () => {
            expect(displayUsername({...userObj, nickname: ''}, Preferences.DISPLAY_PREFER_NICKNAME)).toBe('test user');
        });

        it('should return username when no nick name and no full name', () => {
            expect(displayUsername({...userObj, nickname: '', first_name: '', last_name: ''}, Preferences.DISPLAY_PREFER_NICKNAME)).toBe('testUser');
        });

        it('should return fullname', () => {
            expect(displayUsername(userObj, Preferences.DISPLAY_PREFER_FULL_NAME)).toBe('test user');
        });

        it('should return username when no full name', () => {
            expect(displayUsername({...userObj, first_name: '', last_name: ''}, Preferences.DISPLAY_PREFER_FULL_NAME)).toBe('testUser');
        });

        it('should return default username string', () => {
            let noUserObj;
            expect(displayUsername(noUserObj, 'UNKNOWN_PREFERENCE')).toBe('Someone');
        });

        it('should return empty string when user does not exist and useDefaultUserName param is false', () => {
            let noUserObj;
            expect(displayUsername(noUserObj, 'UNKNOWN_PREFERENCE', false)).toBe('');
        });
    });

    describe('filterProfilesStartingWithTerm', () => {
        const userA = TestHelper.getUserMock({
            id: '100',
            username: 'testUser.split_10-',
            nickname: 'nick',
            first_name: 'First',
            last_name: 'Last1',
        });
        const userB = TestHelper.getUserMock({
            id: '101',
            username: 'extraPerson-split',
            nickname: 'somebody',
            first_name: 'First',
            last_name: 'Last2',
            email: 'left@right.com',
        });
        const users = [userA, userB];

        it('should match all for empty filter', () => {
            expect(filterProfilesStartingWithTerm(users, '')).toEqual([userA, userB]);
        });

        it('should filter out results which do not match', () => {
            expect(filterProfilesStartingWithTerm(users, 'testBad')).toEqual([]);
        });

        it('should match by username', () => {
            expect(filterProfilesStartingWithTerm(users, 'testUser')).toEqual([userA]);
        });

        it('should match by split part of the username', () => {
            expect(filterProfilesStartingWithTerm(users, 'split')).toEqual([userA, userB]);
            expect(filterProfilesStartingWithTerm(users, '10')).toEqual([userA]);
        });

        it('should match by firstname', () => {
            expect(filterProfilesStartingWithTerm(users, 'First')).toEqual([userA, userB]);
        });

        it('should match by lastname prefix', () => {
            expect(filterProfilesStartingWithTerm(users, 'Last')).toEqual([userA, userB]);
        });

        it('should match by lastname fully', () => {
            expect(filterProfilesStartingWithTerm(users, 'Last2')).toEqual([userB]);
        });

        it('should match by fullname prefix', () => {
            expect(filterProfilesStartingWithTerm(users, 'First Last')).toEqual([userA, userB]);
        });

        it('should match by fullname fully', () => {
            expect(filterProfilesStartingWithTerm(users, 'First Last1')).toEqual([userA]);
        });

        it('should match by fullname case-insensitive', () => {
            expect(filterProfilesStartingWithTerm(users, 'first LAST')).toEqual([userA, userB]);
        });

        it('should match by nickname', () => {
            expect(filterProfilesStartingWithTerm(users, 'some')).toEqual([userB]);
        });

        it('should not match by nickname substring', () => {
            expect(filterProfilesStartingWithTerm(users, 'body')).toEqual([]);
        });

        it('should match by email prefix', () => {
            expect(filterProfilesStartingWithTerm(users, 'left')).toEqual([userB]);
        });

        it('should match by email domain', () => {
            expect(filterProfilesStartingWithTerm(users, 'right')).toEqual([userB]);
        });

        it('should match by full email', () => {
            expect(filterProfilesStartingWithTerm(users, 'left@right.com')).toEqual([userB]);
        });

        it('should ignore leading @ for username', () => {
            expect(filterProfilesStartingWithTerm(users, '@testUser')).toEqual([userA]);
        });

        it('should ignore leading @ for firstname', () => {
            expect(filterProfilesStartingWithTerm(users, '@first')).toEqual([userA, userB]);
        });
    });

    describe('filterProfilesMatchingWithTerm', () => {
        const userA = TestHelper.getUserMock({
            id: '100',
            username: 'testUser.split_10-',
            nickname: 'nick',
            first_name: 'First',
            last_name: 'Last1',
        });
        const userB = TestHelper.getUserMock({
            id: '101',
            username: 'extraPerson-split',
            nickname: 'somebody',
            first_name: 'First',
            last_name: 'Last2',
            email: 'left@right.com',
        });
        const users = [userA, userB];

        it('should match all for empty filter', () => {
            expect(filterProfilesMatchingWithTerm(users, '')).toEqual([userA, userB]);
        });

        it('should filter out results which do not match', () => {
            expect(filterProfilesMatchingWithTerm(users, 'testBad')).toEqual([]);
        });

        it('should match by username', () => {
            expect(filterProfilesMatchingWithTerm(users, 'estUser')).toEqual([userA]);
        });

        it('should match by split part of the username', () => {
            expect(filterProfilesMatchingWithTerm(users, 'split')).toEqual([userA, userB]);
            expect(filterProfilesMatchingWithTerm(users, '10')).toEqual([userA]);
        });

        it('should match by firstname substring', () => {
            expect(filterProfilesMatchingWithTerm(users, 'rst')).toEqual([userA, userB]);
        });

        it('should match by lastname substring', () => {
            expect(filterProfilesMatchingWithTerm(users, 'as')).toEqual([userA, userB]);
            expect(filterProfilesMatchingWithTerm(users, 'st2')).toEqual([userB]);
        });

        it('should match by fullname substring', () => {
            expect(filterProfilesMatchingWithTerm(users, 'rst Last')).toEqual([userA, userB]);
        });

        it('should match by fullname fully', () => {
            expect(filterProfilesMatchingWithTerm(users, 'First Last1')).toEqual([userA]);
        });

        it('should match by fullname case-insensitive', () => {
            expect(filterProfilesMatchingWithTerm(users, 'first LAST')).toEqual([userA, userB]);
        });

        it('should match by nickname substring', () => {
            expect(filterProfilesMatchingWithTerm(users, 'ome')).toEqual([userB]);
            expect(filterProfilesMatchingWithTerm(users, 'body')).toEqual([userB]);
        });

        it('should match by email prefix', () => {
            expect(filterProfilesMatchingWithTerm(users, 'left')).toEqual([userB]);
        });

        it('should match by email domain', () => {
            expect(filterProfilesMatchingWithTerm(users, 'right')).toEqual([userB]);
        });

        it('should match by full email', () => {
            expect(filterProfilesMatchingWithTerm(users, 'left@right.com')).toEqual([userB]);
        });

        it('should ignore leading @ for username', () => {
            expect(filterProfilesMatchingWithTerm(users, '@testUser')).toEqual([userA]);
        });

        it('should ignore leading @ for firstname', () => {
            expect(filterProfilesMatchingWithTerm(users, '@first')).toEqual([userA, userB]);
        });
    });

    describe('Utils.getSuggestionsSplitBy', () => {
        test('correct suggestions when splitting by a character', () => {
            const term = 'one.two.three';
            const expectedSuggestions = ['one.two.three', '.two.three', 'two.three', '.three', 'three'];

            expect(getSuggestionsSplitBy(term, '.')).toEqual(expectedSuggestions);
        });
    });

    describe('Utils.getSuggestionsSplitByMultiple', () => {
        test('correct suggestions when splitting by multiple characters', () => {
            const term = 'one.two-three';
            const expectedSuggestions = ['one.two-three', '.two-three', 'two-three', '-three', 'three'];

            expect(getSuggestionsSplitByMultiple(term, ['.', '-'])).toEqual(expectedSuggestions);
        });
    });

    describe('Utils.applyRolesFilters', () => {
        const team = TestHelper.fakeTeamWithId();
        const adminUser = {...TestHelper.fakeUserWithId(), roles: `${General.SYSTEM_USER_ROLE} ${General.SYSTEM_ADMIN_ROLE}`};
        const nonAdminUser = {...TestHelper.fakeUserWithId(), roles: `${General.SYSTEM_USER_ROLE}`};
        const guestUser = {...TestHelper.fakeUserWithId(), roles: `${General.SYSTEM_GUEST_ROLE}`};

        it('Non admin user with non admin membership', () => {
            const nonAdminMembership = {...TestHelper.fakeTeamMember(nonAdminUser.id, team.id), scheme_admin: false, scheme_user: true};
            expect(applyRolesFilters(nonAdminUser, [General.SYSTEM_USER_ROLE], [], nonAdminMembership)).toBe(true);
            expect(applyRolesFilters(nonAdminUser, [General.TEAM_USER_ROLE], [], nonAdminMembership)).toBe(true);
            expect(applyRolesFilters(nonAdminUser, [General.CHANNEL_USER_ROLE], [], nonAdminMembership)).toBe(true);
            expect(applyRolesFilters(nonAdminUser, [General.SYSTEM_ADMIN_ROLE, General.TEAM_ADMIN_ROLE, General.CHANNEL_ADMIN_ROLE], [], nonAdminMembership)).toBe(false);
            expect(applyRolesFilters(nonAdminUser, [], [General.SYSTEM_ADMIN_ROLE], nonAdminMembership)).toBe(true);
            expect(applyRolesFilters(nonAdminUser, [], [General.SYSTEM_USER_ROLE], nonAdminMembership)).toBe(false);
            expect(applyRolesFilters(nonAdminUser, [], [General.TEAM_USER_ROLE], nonAdminMembership)).toBe(false);
            expect(applyRolesFilters(nonAdminUser, [], [General.CHANNEL_USER_ROLE], nonAdminMembership)).toBe(false);
            expect(applyRolesFilters(nonAdminUser, [General.TEAM_USER_ROLE], [General.SYSTEM_ADMIN_ROLE], nonAdminMembership)).toBe(true);
            expect(applyRolesFilters(nonAdminUser, [General.TEAM_ADMIN_ROLE], [General.SYSTEM_ADMIN_ROLE], nonAdminMembership)).toBe(false);
            expect(applyRolesFilters(nonAdminUser, [General.TEAM_USER_ROLE], [General.SYSTEM_USER_ROLE], nonAdminMembership)).toBe(false);
        });

        it('Non admin user with admin membership', () => {
            const adminMembership = {...TestHelper.fakeTeamMember(nonAdminUser.id, team.id), scheme_admin: true, scheme_user: true};
            expect(applyRolesFilters(nonAdminUser, [General.SYSTEM_USER_ROLE], [], adminMembership)).toBe(true);
            expect(applyRolesFilters(nonAdminUser, [General.TEAM_ADMIN_ROLE], [], adminMembership)).toBe(true);
            expect(applyRolesFilters(nonAdminUser, [General.CHANNEL_ADMIN_ROLE], [], adminMembership)).toBe(true);
            expect(applyRolesFilters(nonAdminUser, [General.SYSTEM_ADMIN_ROLE, General.TEAM_USER_ROLE, General.CHANNEL_USER_ROLE], [], adminMembership)).toBe(false);
            expect(applyRolesFilters(nonAdminUser, [], [General.TEAM_ADMIN_ROLE], adminMembership)).toBe(false);
            expect(applyRolesFilters(nonAdminUser, [], [General.CHANNEL_ADMIN_ROLE], adminMembership)).toBe(false);
            expect(applyRolesFilters(nonAdminUser, [General.SYSTEM_USER_ROLE], [General.CHANNEL_ADMIN_ROLE], adminMembership)).toBe(false);
        });

        it('Admin user with any membership', () => {
            const nonAdminMembership = {...TestHelper.fakeTeamMember(adminUser.id, team.id), scheme_admin: false, scheme_user: true};
            const adminMembership = {...TestHelper.fakeTeamMember(adminUser.id, team.id), scheme_admin: true, scheme_user: true};
            expect(applyRolesFilters(adminUser, [General.SYSTEM_ADMIN_ROLE], [], nonAdminMembership)).toBe(true);
            expect(applyRolesFilters(adminUser, [General.SYSTEM_USER_ROLE, General.TEAM_USER_ROLE, General.TEAM_ADMIN_ROLE, General.CHANNEL_USER_ROLE, General.CHANNEL_ADMIN_ROLE], [], nonAdminMembership)).toBe(false);
            expect(applyRolesFilters(adminUser, [General.SYSTEM_ADMIN_ROLE], [], adminMembership)).toBe(true);
            expect(applyRolesFilters(adminUser, [General.SYSTEM_USER_ROLE, General.TEAM_USER_ROLE, General.TEAM_ADMIN_ROLE, General.CHANNEL_USER_ROLE, General.CHANNEL_ADMIN_ROLE], [], adminMembership)).toBe(false);
            expect(applyRolesFilters(adminUser, [], [General.SYSTEM_ADMIN_ROLE], nonAdminMembership)).toBe(false);
            expect(applyRolesFilters(adminUser, [], [General.SYSTEM_USER_ROLE], nonAdminMembership)).toBe(true);
        });

        it('Guest user with any membership', () => {
            const nonAdminMembership = {...TestHelper.fakeTeamMember(guestUser.id, team.id), scheme_admin: false, scheme_user: true};
            const adminMembership = {...TestHelper.fakeTeamMember(guestUser.id, team.id), scheme_admin: true, scheme_user: true};
            expect(applyRolesFilters(guestUser, [General.SYSTEM_GUEST_ROLE], [], nonAdminMembership)).toBe(true);
            expect(applyRolesFilters(guestUser, [General.SYSTEM_USER_ROLE, General.TEAM_USER_ROLE, General.TEAM_ADMIN_ROLE, General.CHANNEL_USER_ROLE, General.CHANNEL_ADMIN_ROLE], [], nonAdminMembership)).toBe(false);
            expect(applyRolesFilters(guestUser, [General.SYSTEM_GUEST_ROLE], [], adminMembership)).toBe(true);
            expect(applyRolesFilters(guestUser, [General.SYSTEM_USER_ROLE, General.TEAM_USER_ROLE, General.TEAM_ADMIN_ROLE, General.CHANNEL_USER_ROLE, General.CHANNEL_ADMIN_ROLE], [], adminMembership)).toBe(false);
            expect(applyRolesFilters(guestUser, [], [General.SYSTEM_GUEST_ROLE], adminMembership)).toBe(false);
        });
    });

    describe('includesAnAdminRole', () => {
        test('returns expected result', () => {
            [
                [General.SYSTEM_ADMIN_ROLE, true],
                [General.SYSTEM_USER_MANAGER_ROLE, true],
                [General.SYSTEM_READ_ONLY_ADMIN_ROLE, true],
                [General.SYSTEM_MANAGER_ROLE, true],
                ['non_existent', false],
                ['foo', false],
                ['bar', false],
            ].forEach(([role, expected]) => {
                const mockRoles = `foo ${role} bar`;
                const actual = includesAnAdminRole(mockRoles);
                expect(actual).toBe(expected);
            });
        });
    });
});
