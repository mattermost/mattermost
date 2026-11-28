// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The operations catalog and request matching, without a browser.

import assert from 'node:assert/strict';

import {expect, test} from '@playwright/test';

import {
    SEEN_LIMIT,
    apiOp,
    canonicalPattern,
    defineApi,
    describeQuery,
    describeSeen,
    isCandidate,
    isRequestFor,
    matchesQuery,
    operationOf,
} from '../src/aria/api';

const api = defineApi({
    GetMe: apiOp<unknown>()({op: 'GetMe', method: 'GET', path: '/api/v4/users/me'}),
    GetUser: apiOp<unknown>()({op: 'GetUser', method: 'GET', path: '/api/v4/users/{user_id}'}),
    GetUserImage: apiOp<unknown>()({op: 'GetUserImage', method: 'GET', path: '/api/v4/users/{user_id}/image'}),
    PatchUser: apiOp<unknown>()({op: 'PatchUser', method: 'PUT', path: '/api/v4/users/{user_id}/patch'}),
    GetChannelMember: apiOp<unknown>()({
        op: 'GetChannelMember',
        method: 'GET',
        path: '/api/v4/channels/{channel_id}/members/{user_id}',
    }),
    GetMyChannelMember: apiOp<unknown>()({
        op: 'GetMyChannelMember',
        method: 'GET',
        path: '/api/v4/channels/{channel_id}/members/me',
    }),
});
const catalog = Object.values(api);

test('patterns are unique by method and canonical path, placeholder names aside', () => {
    expect(canonicalPattern('/api/v4/users/{user_id}/image')).toBe('/api/v4/users/{}/image');
    expect(canonicalPattern('/users/{id}')).toBe(canonicalPattern('/users/{user_id}'));
    expect(() =>
        defineApi({
            A: apiOp()({op: 'A', method: 'GET', path: '/users/{id}'}),
            B: apiOp()({op: 'B', method: 'GET', path: '/users/{user_id}'}),
        }),
    ).toThrow(/A/);
    defineApi({
        A: apiOp()({op: 'A', method: 'GET', path: '/users/{id}'}),
        B: apiOp()({op: 'B', method: 'PUT', path: '/users/{id}'}),
    });
    expect(() => defineApi({A: apiOp()({op: 'A', method: 'GET', path: '/users//{id}'})})).toThrow(/empty segment/);
});

test('a request belongs to the most specific operation', () => {
    expect(operationOf(catalog, 'GET', '/api/v4/users/me')?.op).toBe('GetMe');
    expect(operationOf(catalog, 'GET', '/api/v4/users/abc')?.op).toBe('GetUser');
    expect(operationOf(catalog, 'get', '/api/v4/users/abc/image')?.op).toBe('GetUserImage');
    expect(operationOf(catalog, 'GET', '/api/v4/users/abc/extra/more')).toBeNull();
    expect(operationOf(catalog, 'POST', '/api/v4/users/abc')).toBeNull();
    expect(operationOf(catalog, 'GET', '/api/v4/channels/c1/members/me')?.op).toBe('GetMyChannelMember');
    expect(operationOf(catalog, 'GET', '/api/v4/channels/c1/members/u1')?.op).toBe('GetChannelMember');
    expect(operationOf(catalog, 'GET', '/api/v4/users/a%2Fb')?.op).toBe('GetUser');
    expect(operationOf(catalog, 'GET', '/api/v4//users/abc')).toBeNull();
});

test('a placeholder left open: the request must belong to the operation in the whole catalog', () => {
    expect(isRequestFor(api.GetUser, undefined, 'GET', '/api/v4/users/abc')).toBe(true);
    expect(isRequestFor(api.GetUser, undefined, 'GET', '/api/v4/users/me')).toBe(false);
    expect(isRequestFor(api.GetMe, undefined, 'GET', '/api/v4/users/me')).toBe(true);
    expect(isRequestFor(api.GetChannelMember, {channel_id: 'c1'}, 'GET', '/api/v4/channels/c1/members/u1')).toBe(true);
    expect(isRequestFor(api.GetChannelMember, {channel_id: 'c1'}, 'GET', '/api/v4/channels/c1/members/me')).toBe(false);
    expect(isRequestFor(api.GetChannelMember, {channel_id: 'c2'}, 'GET', '/api/v4/channels/c1/members/u1')).toBe(false);
});

test('every placeholder filled: the path must be exactly the filled one', () => {
    expect(isRequestFor(api.GetUser, {user_id: 'abc'}, 'GET', '/api/v4/users/abc')).toBe(true);
    expect(isRequestFor(api.GetUser, {user_id: 'abc'}, 'GET', '/api/v4/users/xyz')).toBe(false);
    expect(isRequestFor(api.GetUser, {user_id: 'me'}, 'GET', '/api/v4/users/me')).toBe(true);
    expect(isRequestFor(api.GetUser, {user_id: 'a/b'}, 'GET', '/api/v4/users/a%2Fb')).toBe(true);
    expect(isRequestFor(api.PatchUser, {user_id: 'abc'}, 'GET', '/api/v4/users/abc/patch')).toBe(false);
    expect(isRequestFor(api.GetUser, {user_id: 'me'}, 'GET', '/api/v4/users//me')).toBe(false);
    expect(isRequestFor(api.GetUser, undefined, 'GET', '/api/v4/users/')).toBe(false);
});

test('malformed encoding matches no filled value and never throws', () => {
    expect(isRequestFor(api.GetUser, {user_id: 'abc'}, 'GET', '/api/v4/users/%E0%A4%A')).toBe(false);
    expect(isRequestFor(api.GetUser, undefined, 'GET', '/api/v4/users/%E0%A4%A')).toBe(true);
});

test('an operation not built by defineApi cannot be matched with a placeholder open', () => {
    expect(() =>
        isRequestFor(apiOp()({op: 'Loose', method: 'GET', path: '/x/{id}'}), undefined, 'GET', '/x/1'),
    ).toThrow(/defineApi/);
});

test('the query filter: the reference cases', () => {
    assert.equal(matchesQuery('?in_team=t1&page=0', {in_team: 't1'}), true, 'value equal; an unlisted key is ignored');
    assert.equal(matchesQuery('in_team=t1', {in_team: 't1'}), true, 'with or without the question mark');
    assert.equal(matchesQuery('?in_team=t2', {in_team: 't1'}), false, 'value different');
    assert.equal(matchesQuery('?page=0', {in_team: 't1'}), false, 'key missing');
    assert.equal(matchesQuery('', {in_team: 't1'}), false);
    assert.equal(
        matchesQuery('?in_team=t1&in_team=t1', {in_team: 't1'}),
        false,
        'a repeated key never equals a string, even with equal values',
    );
    assert.equal(matchesQuery('?in_team=t1&in_team=t2', {in_team: 't1'}), false, 'nor with different values');
    assert.equal(matchesQuery('?in_team=t1', {in_team: 't1', not_in_channel: null}), true, 'null: the key is absent');
    assert.equal(
        matchesQuery('?in_team=t1&not_in_channel=c1', {in_team: 't1', not_in_channel: null}),
        false,
        'null: the key is present',
    );
    assert.equal(
        matchesQuery('?in_team=t1&not_in_channel=', {not_in_channel: null}),
        false,
        'an empty value is present, not absent',
    );
    assert.equal(matchesQuery('?q=', {q: ''}), true, 'an empty value equals the empty string');
    assert.equal(matchesQuery('?q=a+b', {q: 'a b'}), true, 'a plus is a space');
    assert.equal(matchesQuery('?q=a%20b', {q: 'a b'}), true);
    assert.equal(matchesQuery('?q=a%2Bb', {q: 'a+b'}), true, 'decoded once');
    assert.equal(matchesQuery('?q=%2520', {q: '%20'}), true, 'and only once');
    assert.equal(
        matchesQuery('?q=%E0%A4%A', {q: 'x'}),
        false,
        'a malformed sequence is read as URLSearchParams reads it; it does not throw',
    );
    assert.equal(matchesQuery('?q=%E0%A4%A', {q: new URLSearchParams('q=%E0%A4%A').get('q')!}), true);
    assert.equal(matchesQuery('?anything=1', {}), true, 'an empty filter filters nothing');
    assert.equal(matchesQuery('?anything=1', undefined), true);

    // the filter applies after the path rule
    const users = defineApi({
        GetMe: apiOp<unknown>()({op: 'GetMe', method: 'GET', path: '/api/v4/users/me'}),
        GetUser: apiOp<unknown>()({op: 'GetUser', method: 'GET', path: '/api/v4/users/{user_id}'}),
        GetUsers: apiOp<unknown>()({op: 'GetUsers', method: 'GET', path: '/api/v4/users'}),
    });
    const inTeamOnly = {query: {in_team: 't1', not_in_channel: null}};
    assert.equal(isCandidate(users.GetUsers, inTeamOnly, 'GET', '/api/v4/users', '?in_team=t1&page=0'), true);
    assert.equal(
        isCandidate(users.GetUsers, inTeamOnly, 'GET', '/api/v4/users', '?in_team=t1&not_in_channel=c1'),
        false,
    );
    assert.equal(
        isCandidate(users.GetUsers, inTeamOnly, 'GET', '/api/v4/users/me', '?in_team=t1'),
        false,
        'the path rule first: /users/me is not GetUsers',
    );
    assert.equal(
        isCandidate(users.GetUser, {query: {in_team: 't1'}}, 'GET', '/api/v4/users/me', '?in_team=t1'),
        false,
        'most specific still wins with a filter',
    );
    assert.equal(
        isCandidate(
            users.GetUser,
            {params: {user_id: 'u1'}, query: {full: 'true'}},
            'GET',
            '/api/v4/users/u1',
            '?full=true',
        ),
        true,
    );
    assert.equal(
        isCandidate(
            users.GetUser,
            {params: {user_id: 'u1'}, query: {full: 'true'}},
            'GET',
            '/api/v4/users/u2',
            '?full=true',
        ),
        false,
    );
    assert.equal(isCandidate(users.GetUsers, {}, 'GET', '/api/v4/users', '?whatever=1'), true, 'no filter: any query');

    // a rejected variant is not a candidate, whatever it answers: decided at registration, from method and URL alone
    type Seen = {method: string; path: string; search: string; status: number | 'never answers'};
    const wanted: Seen = {method: 'GET', path: '/api/v4/users', search: '?in_team=t1', status: 200};
    const settleOn = (requests: Seen[]) =>
        requests.filter((r) => isCandidate(users.GetUsers, inTeamOnly, r.method, r.path, r.search));
    assert.deepEqual(
        settleOn([
            {method: 'GET', path: '/api/v4/users', search: '?in_team=t1&not_in_channel=c1', status: 500},
            wanted,
        ]),
        [wanted],
        'an unwanted variant answering 500 does not fail the wait',
    );
    assert.deepEqual(
        settleOn([
            {method: 'GET', path: '/api/v4/users', search: '?in_team=t1&not_in_channel=c1', status: 'never answers'},
            wanted,
        ]),
        [wanted],
        'nor does one whose body never arrives hold it',
    );
    assert.deepEqual(settleOn([wanted, wanted]), [wanted, wanted], 'count sees only candidates');

    // what a timeout prints
    assert.equal(describeQuery({not_in_channel: null, in_team: 't1'}), 'in_team=t1, not_in_channel absent');
    assert.equal(describeQuery(undefined), '');
    assert.deepEqual(
        describeSeen(Object.values(users), [
            {method: 'GET', path: '/api/v4/users', search: '?in_team=t1&not_in_channel=c1'},
            {method: 'get', path: '/api/v4/users/me', search: ''},
            {method: 'POST', path: '/api/v4/unknown', search: 'a=1'},
        ]),
        ['GetUsers?in_team=t1&not_in_channel=c1', 'GetMe', 'POST /api/v4/unknown?a=1'],
    );
    const many = Array.from({length: SEEN_LIMIT + 3}, (_, i) => ({
        method: 'GET',
        path: '/api/v4/users',
        search: `?page=${i}`,
    }));
    const listed = describeSeen(Object.values(users), many);
    assert.equal(listed.length, SEEN_LIMIT + 1);
    assert.equal(listed.at(-1), '… and 3 more');
});
