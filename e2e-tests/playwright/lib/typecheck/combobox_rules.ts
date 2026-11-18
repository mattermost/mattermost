// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {type ComboboxDriver, type FileInputDriver, apiOp, defineApi, settle} from '../src/aria';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
declare function assert<T extends true>(): T;

const Api = defineApi({
    SearchTeams: apiOp<Array<{id: string}>>()({op: 'SearchTeams', method: 'POST', path: '/api/v4/teams/search'}),
    UploadFile: apiOp<{id: string}>()({op: 'UploadFile', method: 'POST', path: '/api/v4/files'}),
});

declare const select: ComboboxDriver;
declare const attach: FileInputDriver;

export async function rules(): Promise<void> {
    // a combobox fills, clears and types like a textbox, and each can be settled
    const filled = await settle(select, {wait: Api.SearchTeams}).fill('Opera');
    assert<Equal<typeof filled, Array<{id: string}>>>();
    await settle(select, {wait: Api.SearchTeams}).type('Opera');
    await settle(select, {wait: Api.SearchTeams}).clear();
    assert<Equal<Awaited<ReturnType<typeof select.fill>>, void>>();

    // @ts-expect-error a combobox doesn't click, so it has no clickTo
    await select.clickTo(select);

    // a file input's one action, settled per file
    const uploaded = await settle(attach, {wait: Api.UploadFile, count: 2}).chooseFiles(['a.txt', 'b.txt']);
    assert<Equal<typeof uploaded, Array<{id: string}>>>();

    // @ts-expect-error a file input is not clicked
    await attach.click();
}
