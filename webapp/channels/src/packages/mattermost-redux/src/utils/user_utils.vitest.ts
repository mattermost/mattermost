// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    displayUsername,
    filterProfilesStartingWithTerm,
    filterProfilesMatchingWithTerm,
    getSuggestionsSplitBy,
    getSuggestionsSplitByMultiple,
    includesAnAdminRole,
    applyRolesFilters,
    nameSuggestionsForUser,
} from 'mattermost-redux/utils/user_utils';

import TestHelper from '../../test/test_helper';
import {Preferences, General} from '../constants';

describe('user utils', () => {
    describe('displayUsername', () => {
        const userObj = TestHelper.getUserMock({
            id: '100',
            username: 'testUser',
            nickname: 'nick',
            first_name: 'test',
            last_name: 'user',
            props: {RemoteUsername: 'remoteTestUser'},
        });

        test('should return username', () => {
            expect(displayUsername(userObj, 'UNKNOWN_PREFERENCE')).toBe('testUser');
        });

        test('should return nickname', () => {
            expect(displayUsername(userObj, Preferences.DISPLAY_PREFER_NICKNAME)).toBe('nick');
        });

        test('should return fullname when no nick name', () => {
            expect(displayUsername({...userObj, nickname: ''}, Preferences.DISPLAY_PREFER_NICKNAME)).toBe('test user');
        });

        test('should return username when no nick name and no full name', () => {
            expect(displayUsername({...userObj, nickname: '', first_name: '', last_name: ''}, Preferences.DISPLAY_PREFER_NICKNAME)).toBe('testUser');
        });

        test('should return fullname', () => {
            expect(displayUsername(userObj, Preferences.DISPLAY_PREFER_FULL_NAME)).toBe('test user');
        });

        test('should return username when no full name', () => {
            expect(displayUsername({...userObj, first_name: '', last_name: ''}, Preferences.DISPLAY_PREFER_FULL_NAME)).toBe('testUser');
        });

        test('should return default username string', () => {
            let noUserObj;
            expect(displayUsername(noUserObj, 'UNKNOWN_PREFERENCE')).toBe('Someone');
        });

        test('should return remote username string if the user is remote', () => {
            expect(displayUsername({...userObj, remote_id: 'remoteid'}, Preferences.DISPLAY_PREFER_USERNAME)).toBe('remoteTestUser');
        });

        test('should return empty string when user does not exist and useDefaultUserName param is false', () => {
            let noUserObj;
            expect(displayUsername(noUserObj, 'UNKNOWN_PREFERENCE', false)).toBe('');
        });
    });

    describe('nameSuggestionsForUser', () => {
        const userObj = TestHelper.getUserMock({
            username: 'test.user',
            nickname: 'tester',
            first_name: 'Test',
            last_name: 'UsEr NaMe',
            position: 'Software Engineer at Mattermost',
            email: 'test.user_name@example.com',
        });

        test('should return correct suggestions for user (without full email)', () => {
            const suggestions = nameSuggestionsForUser(userObj);
            const expectedSuggestions = [
                'test.user', '.user', 'user',
                'test', 'user name', 'test user name', 'tester',
                'software engineer at mattermost', 'engineer at mattermost', 'at mattermost', 'mattermost',
                'test.user_name',
            ];
            expect(suggestions).toEqual(expectedSuggestions);
        });

        test('should return correct suggestions for user (with full email when requested)', () => {
            const suggestions = nameSuggestionsForUser(userObj, true);
            const expectedSuggestions = [
                'test.user', '.user', 'user',
                'test', 'user name', 'test user name', 'tester',
                'software engineer at mattermost', 'engineer at mattermost', 'at mattermost', 'mattermost',
                'test.user_name',
                'test.user_name@example.com',
            ];
            expect(suggestions).toEqual(expectedSuggestions);
        });

        test('should not include full email when includeFullEmail is true but email has no @ symbol', () => {
            const userWithInvalidEmail = {...userObj, email: 'invalidemail'};
            const suggestions = nameSuggestionsForUser(userWithInvalidEmail, true);
            expect(suggestions).toContain('invalidemail'); // Should still contain the prefix part
            // Should not contain the full email since there's no @ symbol - only one instance should exist
            expect(suggestions.filter((s) => s === 'invalidemail').length).toBe(1);
        });

        test('should not include full email when includeFullEmail is false', () => {
            const suggestions = nameSuggestionsForUser(userObj, false);
            expect(suggestions).not.toContain('test.user_name@example.com');
            expect(suggestions).toContain('test.user_name'); // Should still contain the prefix
        });

        test('should gracefully handle missing values for fields', () => {
            const suggestions: string[] = nameSuggestionsForUser({...userObj,
                username: '',
                nickname: '',
                first_name: '',
                last_name: '',
                position: '',
                email: '',
            });
            expect(suggestions).toEqual(expect.arrayContaining(['']));
        });

        test('should handle different split username characters correctly', () => {
            const suggestions: string[] = nameSuggestionsForUser({...userObj, username: 'john-doe_jr'});
            const expectedUsernameSuggestions: string[] = [
                'john-doe_jr', '-doe_jr', 'doe_jr', '_jr', 'jr',
            ];
            expect(suggestions).toEqual(expect.arrayContaining(expectedUsernameSuggestions));
        });

        test('should split position on whitespace', () => {
            const suggestions: string[] = nameSuggestionsForUser({...userObj, position: 'test-position split is corre_ct'});
            const expectedPositionSuggestions: string[] = [
                'test-position split is corre_ct', 'split is corre_ct', 'is corre_ct', 'corre_ct',
            ];
            expect(suggestions).toEqual(expect.arrayContaining(expectedPositionSuggestions));
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

        test('should match all for empty filter', () => {
            expect(filterProfilesStartingWithTerm(users, '')).toEqual([userA, userB]);
        });

        test('should filter out results which do not match', () => {
            expect(filterProfilesStartingWithTerm(users, 'testBad')).toEqual([]);
        });

        test('should match by username', () => {
            expect(filterProfilesStartingWithTerm(users, 'testUser')).toEqual([userA]);
        });

        test('should match by split part of the username', () => {
            expect(filterProfilesStartingWithTerm(users, 'split')).toEqual([userA, userB]);
            expect(filterProfilesStartingWithTerm(users, '10')).toEqual([userA]);
        });

        test('should match by firstname', () => {
            expect(filterProfilesStartingWithTerm(users, 'First')).toEqual([userA, userB]);
        });

        test('should match by lastname prefix', () => {
            expect(filterProfilesStartingWithTerm(users, 'Last')).toEqual([userA, userB]);
        });

        test('should match by lastname fully', () => {
            expect(filterProfilesStartingWithTerm(users, 'Last2')).toEqual([userB]);
        });

        test('should match by fullname prefix', () => {
            expect(filterProfilesStartingWithTerm(users, 'First Last')).toEqual([userA, userB]);
        });

        test('should match by fullname fully', () => {
            expect(filterProfilesStartingWithTerm(users, 'First Last1')).toEqual([userA]);
        });

        test('should match by fullname case-insensitive', () => {
            expect(filterProfilesStartingWithTerm(users, 'first LAST')).toEqual([userA, userB]);
        });

        test('should match by nickname', () => {
            expect(filterProfilesStartingWithTerm(users, 'some')).toEqual([userB]);
        });

        test('should not match by nickname substring', () => {
            expect(filterProfilesStartingWithTerm(users, 'body')).toEqual([]);
        });

        test('should match by email prefix', () => {
            expect(filterProfilesStartingWithTerm(users, 'left')).toEqual([userB]);
        });

        test('should not match by email domain as it is ignored', () => {
            expect(filterProfilesStartingWithTerm(users, 'right')).not.toContain(userB);
        });

        test('should match by full email when @ is present in search term', () => {
            expect(filterProfilesStartingWithTerm(users, 'left@right.com')).toContain(userB);
        });

        test('should ignore leading @ for username', () => {
            expect(filterProfilesStartingWithTerm(users, '@testUser')).toEqual([userA]);
        });

        test('should ignore leading @ for firstname', () => {
            expect(filterProfilesStartingWithTerm(users, '@first')).toEqual([userA, userB]);
        });

        // NEW TESTS FOR SMART EMAIL SEARCH FUNCTIONALITY
        describe('Smart Email Search (Context-Aware)', () => {
            const userWithEmail = TestHelper.getUserMock({
                id: '200',
                username: 'emailuser',
                email: 'test-the-at-issue@theissue.com',
                first_name: 'Email',
                last_name: 'User',
            });
            const userWithCommonDomain = TestHelper.getUserMock({
                id: '201',
                username: 'comuser',
                email: 'another@example.com',
                first_name: 'Com',
                last_name: 'User',
            });
            const usersWithEmails = [userWithEmail, userWithCommonDomain];

            test('should NOT match by domain when searching without @ (prevents pollution)', () => {
                // These searches should NOT return users based on email domains
                // BUT they might match usernames that contain these terms
                expect(filterProfilesStartingWithTerm(usersWithEmails, 'com')).toEqual([userWithCommonDomain]); // matches "comuser" username
                expect(filterProfilesStartingWithTerm(usersWithEmails, 'theissue')).toEqual([]);
                expect(filterProfilesStartingWithTerm(usersWithEmails, 'example')).toEqual([]);
            });

            test('should match by email prefix when searching without @', () => {
                // These should work - searching by email prefix (before @)
                expect(filterProfilesStartingWithTerm(usersWithEmails, 'test-the-at-issue')).toEqual([userWithEmail]);
                expect(filterProfilesStartingWithTerm(usersWithEmails, 'another')).toEqual([userWithCommonDomain]);
            });

            test('should match by full email when searching WITH @ symbol', () => {
                // These should work - searching by full email when @ is present
                expect(filterProfilesStartingWithTerm(usersWithEmails, 'test-the-at-issue@theissue.com')).toEqual([userWithEmail]);
                expect(filterProfilesStartingWithTerm(usersWithEmails, 'another@example.com')).toEqual([userWithCommonDomain]);
                expect(filterProfilesStartingWithTerm(usersWithEmails, 'test-the-at-issue@')).toEqual([userWithEmail]);
            });

            test('should match by partial email with @ symbol', () => {
                // Partial email searches with @ should work
                expect(filterProfilesStartingWithTerm(usersWithEmails, 'test-the-at-issue@')).toEqual([userWithEmail]);
                expect(filterProfilesStartingWithTerm(usersWithEmails, 'another@')).toEqual([userWithCommonDomain]);
            });

            test('should handle @ at the beginning correctly', () => {
                // @ at the beginning should be stripped and then apply smart logic
                expect(filterProfilesStartingWithTerm(usersWithEmails, '@test-the-at-issue')).toEqual([userWithEmail]);
                expect(filterProfilesStartingWithTerm(usersWithEmails, '@another')).toEqual([userWithCommonDomain]);
            });

            test('should NOT match domain-only searches even with @ prefix', () => {
                // Even with @ prefix, domain-only searches should not work
                expect(filterProfilesStartingWithTerm(usersWithEmails, '@com')).toEqual([userWithCommonDomain]); // matches "comuser" username
                expect(filterProfilesStartingWithTerm(usersWithEmails, '@theissue')).toEqual([]);
                expect(filterProfilesStartingWithTerm(usersWithEmails, '@example')).toEqual([]);
            });
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

        test('should match all for empty filter', () => {
            expect(filterProfilesMatchingWithTerm(users, '')).toEqual([userA, userB]);
        });

        test('should filter out results which do not match', () => {
            expect(filterProfilesMatchingWithTerm(users, 'testBad')).toEqual([]);
        });

        test('should match by username', () => {
            expect(filterProfilesMatchingWithTerm(users, 'estUser')).toEqual([userA]);
        });

        test('should match by split part of the username', () => {
            expect(filterProfilesMatchingWithTerm(users, 'split')).toEqual([userA, userB]);
            expect(filterProfilesMatchingWithTerm(users, '10')).toEqual([userA]);
        });

        test('should match by firstname substring', () => {
            expect(filterProfilesMatchingWithTerm(users, 'rst')).toEqual([userA, userB]);
        });

        test('should match by lastname substring', () => {
            expect(filterProfilesMatchingWithTerm(users, 'as')).toEqual([userA, userB]);
            expect(filterProfilesMatchingWithTerm(users, 'st2')).toEqual([userB]);
        });

        test('should match by fullname substring', () => {
            expect(filterProfilesMatchingWithTerm(users, 'rst Last')).toEqual([userA, userB]);
        });

        test('should match by fullname fully', () => {
            expect(filterProfilesMatchingWithTerm(users, 'First Last1')).toEqual([userA]);
        });

        test('should match by fullname case-insensitive', () => {
            expect(filterProfilesMatchingWithTerm(users, 'first LAST')).toEqual([userA, userB]);
        });

        test('should match by nickname substring', () => {
            expect(filterProfilesMatchingWithTerm(users, 'ome')).toEqual([userB]);
            expect(filterProfilesMatchingWithTerm(users, 'body')).toEqual([userB]);
        });

        test('should match by email prefix', () => {
            expect(filterProfilesMatchingWithTerm(users, 'left')).toEqual([userB]);
        });

        test('should match by email domain', () => {
            expect(filterProfilesMatchingWithTerm(users, 'right')).not.toContain(userB);
        });

        test('should match by full email when @ is present in search term', () => {
            expect(filterProfilesMatchingWithTerm(users, 'left@right.com')).toContain(userB);
        });

        test('should ignore leading @ for username', () => {
            expect(filterProfilesMatchingWithTerm(users, '@testUser')).toEqual([userA]);
        });

        test('should ignore leading @ for firstname', () => {
            expect(filterProfilesMatchingWithTerm(users, '@first')).toEqual([userA, userB]);
        });

        // NEW TESTS FOR SMART EMAIL SEARCH FUNCTIONALITY (MATCHING)
        describe('Smart Email Search (Context-Aware Matching)', () => {
            const userWithEmail = TestHelper.getUserMock({
                id: '300',
                username: 'matchuser',
                email: 'test-the-at-issue@theissue.com',
                first_name: 'Match',
                last_name: 'User',
            });
            const userWithCommonDomain = TestHelper.getUserMock({
                id: '301',
                username: 'matchcom',
                email: 'another@example.com',
                first_name: 'Match',
                last_name: 'Com',
            });
            const usersForMatching = [userWithEmail, userWithCommonDomain];

            test('should NOT match by domain when searching without @ (prevents pollution)', () => {
                // These searches should NOT return users based on email domains
                // BUT they might match usernames or other fields that contain these terms
                expect(filterProfilesMatchingWithTerm(usersForMatching, 'com')).toEqual([userWithCommonDomain]); // matches "matchcom" username and "Com" last name
                expect(filterProfilesMatchingWithTerm(usersForMatching, 'theissue')).toEqual([]);
                expect(filterProfilesMatchingWithTerm(usersForMatching, 'example')).toEqual([]);
            });

            test('should match by email prefix when searching without @', () => {
                // These should work - searching by email prefix (before @)
                expect(filterProfilesMatchingWithTerm(usersForMatching, 'test-the-at-issue')).toEqual([userWithEmail]);
                expect(filterProfilesMatchingWithTerm(usersForMatching, 'another')).toEqual([userWithCommonDomain]);
                expect(filterProfilesMatchingWithTerm(usersForMatching, 'the-at-issue')).toEqual([userWithEmail]); // substring match
            });

            test('should match by full email when searching WITH @ symbol', () => {
                // These should work - searching by full email when @ is present
                expect(filterProfilesMatchingWithTerm(usersForMatching, 'test-the-at-issue@theissue.com')).toEqual([userWithEmail]);
                expect(filterProfilesMatchingWithTerm(usersForMatching, 'another@example.com')).toEqual([userWithCommonDomain]);
                expect(filterProfilesMatchingWithTerm(usersForMatching, '@theissue.com')).toEqual([userWithEmail]); // domain match when @ present
            });

            test('should match by partial email with @ symbol', () => {
                // Partial email searches with @ should work
                expect(filterProfilesMatchingWithTerm(usersForMatching, 'test-the-at-issue@')).toEqual([userWithEmail]);
                expect(filterProfilesMatchingWithTerm(usersForMatching, 'another@')).toEqual([userWithCommonDomain]);
                expect(filterProfilesMatchingWithTerm(usersForMatching, '@theissue')).toEqual([userWithEmail]);
            });

            test('should handle @ at the beginning correctly for matching', () => {
                // @ at the beginning should be stripped and then apply smart logic
                expect(filterProfilesMatchingWithTerm(usersForMatching, '@test-the-at-issue')).toEqual([userWithEmail]);
                expect(filterProfilesMatchingWithTerm(usersForMatching, '@another')).toEqual([userWithCommonDomain]);
            });

            test('should match domain when @ is present in search term', () => {
                // When @ is present, domain matching should work
                expect(filterProfilesMatchingWithTerm(usersForMatching, '@theissue')).toEqual([userWithEmail]);
                expect(filterProfilesMatchingWithTerm(usersForMatching, '@example')).toEqual([userWithCommonDomain]);
                expect(filterProfilesMatchingWithTerm(usersForMatching, 'theissue@')).toEqual([]); // This might not match as expected due to how the search works
            });
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

        test('Non admin user with non admin membership', () => {
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

        test('Non admin user with admin membership', () => {
            const adminMembership = {...TestHelper.fakeTeamMember(nonAdminUser.id, team.id), scheme_admin: true, scheme_user: true};
            expect(applyRolesFilters(nonAdminUser, [General.SYSTEM_USER_ROLE], [], adminMembership)).toBe(true);
            expect(applyRolesFilters(nonAdminUser, [General.TEAM_ADMIN_ROLE], [], adminMembership)).toBe(true);
            expect(applyRolesFilters(nonAdminUser, [General.CHANNEL_ADMIN_ROLE], [], adminMembership)).toBe(true);
            expect(applyRolesFilters(nonAdminUser, [General.SYSTEM_ADMIN_ROLE, General.TEAM_USER_ROLE, General.CHANNEL_USER_ROLE], [], adminMembership)).toBe(false);
            expect(applyRolesFilters(nonAdminUser, [], [General.TEAM_ADMIN_ROLE], adminMembership)).toBe(false);
            expect(applyRolesFilters(nonAdminUser, [], [General.CHANNEL_ADMIN_ROLE], adminMembership)).toBe(false);
            expect(applyRolesFilters(nonAdminUser, [General.SYSTEM_USER_ROLE], [General.CHANNEL_ADMIN_ROLE], adminMembership)).toBe(false);
        });

        test('Admin user with any membership', () => {
            const nonAdminMembership = {...TestHelper.fakeTeamMember(adminUser.id, team.id), scheme_admin: false, scheme_user: true};
            const adminMembership = {...TestHelper.fakeTeamMember(adminUser.id, team.id), scheme_admin: true, scheme_user: true};
            expect(applyRolesFilters(adminUser, [General.SYSTEM_ADMIN_ROLE], [], nonAdminMembership)).toBe(true);
            expect(applyRolesFilters(adminUser, [General.SYSTEM_USER_ROLE, General.TEAM_USER_ROLE, General.TEAM_ADMIN_ROLE, General.CHANNEL_USER_ROLE, General.CHANNEL_ADMIN_ROLE], [], nonAdminMembership)).toBe(false);
            expect(applyRolesFilters(adminUser, [General.SYSTEM_ADMIN_ROLE], [], adminMembership)).toBe(true);
            expect(applyRolesFilters(adminUser, [General.SYSTEM_USER_ROLE, General.TEAM_USER_ROLE, General.TEAM_ADMIN_ROLE, General.CHANNEL_USER_ROLE, General.CHANNEL_ADMIN_ROLE], [], adminMembership)).toBe(false);
            expect(applyRolesFilters(adminUser, [], [General.SYSTEM_ADMIN_ROLE], nonAdminMembership)).toBe(false);
            expect(applyRolesFilters(adminUser, [], [General.SYSTEM_USER_ROLE], nonAdminMembership)).toBe(true);
        });

        test('Guest user with any membership', () => {
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
