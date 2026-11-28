// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {type ButtonDriver, apiOp, defineApi, settle, waitForApi} from '../src/aria';

const Api = defineApi({
    GetUsers: apiOp<Array<{id: string}>>()({op: 'GetUsers', method: 'GET', path: '/api/v4/users'}),
});

declare const add: ButtonDriver;
declare const page: Page;

export async function rules(): Promise<void> {
    // a string: that value exactly once; null: the key absent
    await settle(add, {wait: Api.GetUsers, query: {in_team: 't1', not_in_channel: null}}).click();
    await waitForApi(page, Api.GetUsers, {query: {not_in_channel: 'c1'}});

    // @ts-expect-error a value is a string or null, never a number
    await settle(add, {wait: Api.GetUsers, query: {page: 0}}).click();

    // @ts-expect-error nor a list: a repeated key never matches
    await waitForApi(page, Api.GetUsers, {query: {in_team: ['t1', 't2']}});
}
