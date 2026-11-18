// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// What a spec can and cannot write against the page objects generated from app.surface.json. Every
// `@ts-expect-error` is a rule: the generator's tests fail if one of them starts to compile.

import type {Page} from '@playwright/test';
import type {Channel} from '@mattermost/types/channels';
import type {StatusOK} from '@mattermost/types/client4';
import type {Recap} from '@mattermost/types/recaps';

import {Api, App, ChannelPage, type AdminPluginsPage, type ConfirmModal, type RecapsPage, type RecapsRecapDeleteModalMount} from './generated';
import {expect, settle, waitForApi, type FileInputDriver, type NotRendered} from './runtime';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
declare function assert<T extends true>(): T;

export async function spec(page: Page, recapId: string, channel: Channel): Promise<void> {
    const app = new App(page);
    const recap = app.recaps.recap(recapId);
    app.recaps.recap({id: recapId});

    // a click returns nothing: where it leads is the spec's to say, and clickTo checks it and returns it
    assert<Equal<Awaited<ReturnType<typeof recap.deleteButton.click>>, void>>();
    const modal = await recap.deleteButton.clickTo(recap.deleteModal);
    assert<Equal<typeof modal, ConfirmModal<RecapsRecapDeleteModalMount>>>();

    // every wait names its request
    const deleted = await settle(modal.confirmButton, {wait: Api.DeleteRecap, params: {recap_id: recapId}}).click();
    assert<Equal<typeof deleted, StatusOK>>();

    // @ts-expect-error there is no default wait
    await settle(modal.confirmButton).click();

    // @ts-expect-error settle does not offer clickTo: a request and a destination are the Promise.all form
    await settle(recap.deleteButton, {wait: Api.DeleteRecap}).clickTo(recap.deleteModal);
    const [body, reached] = await Promise.all([waitForApi(page, Api.GetRecap), recap.deleteButton.clickTo(recap.deleteModal)]);
    assert<Equal<typeof body, Recap>>();
    assert<Equal<typeof reached, typeof modal>>();

    // a part the mount never renders
    assert<Equal<typeof modal.checkboxCheckbox, NotRendered>>();

    // @ts-expect-error nothing can be called on it
    await modal.checkboxCheckbox.check();

    // @ts-expect-error nor asserted on
    await expect(modal.checkboxCheckbox).toBeHidden();

    // the same family at its other mount renders it
    const remove = app.adminPlugin.removeModal;
    await remove.checkboxCheckbox.check();

    // two mounts of one family are different types: a value that may be either keeps both, and what one of them never
    // renders cannot be acted on through it
    const either = recapId ? modal : remove;
    assert<Equal<typeof either, typeof modal | typeof remove>>();

    // @ts-expect-error the checkbox is not rendered at the delete modal's mount
    await either.checkboxCheckbox.check();

    // @ts-expect-error one mount is not the other
    const asRemove: typeof remove = modal;

    // a set-keyed part
    await settle(recap.action('mark_read'), {wait: Api.MarkRecapRead}).click();
    await settle(recap.action('regenerate'), {wait: Api.GetRecap, status: 404}).click();

    // @ts-expect-error not a member of the set
    recap.action('archive');

    // a native file input has its own driver
    assert<Equal<typeof app.recaps.importFile, FileInputDriver>>();
    await app.recaps.importFile.chooseFiles(['a.png']);

    // @ts-expect-error a file input is not clicked
    await app.recaps.importFile.click();

    // a key the mount supplies
    await expect(app.recaps.grid.row('regenerate').nameText).toHaveText('Regenerate');
    await expect(app.adminPlugin.grid.row('com.mattermost.calls').nameText).toBeVisible();

    // @ts-expect-error this grid's rows are the set's members
    app.recaps.grid.row('com.mattermost.calls');

    // keys a mount gives as positions are numbers there, and only there
    await expect(app.audit.grid.row(0).nameText).toBeVisible();
    await expect(app.audit.grid.rowList).toHaveKeys([0, 1]);
    await app.audit.tabs.tab(1).select();
    await app.audit.filters.tab('mark_read').select();

    // @ts-expect-error this grid's rows are positions
    app.audit.grid.row('regenerate');

    // @ts-expect-error these tabs are the set's members
    app.audit.filters.tab(0);

    await expect(app.recaps.recapList).toHaveKeys([recapId]);
    await expect(recap.actionList).toHaveKeyCount(2);

    // a form: fill() and read()
    const settings = app.channelSettings;
    await settings.fill({name: 'town', private: true});
    const values = await settings.read();
    assert<Equal<typeof values.private, boolean | undefined>>();
    assert<Equal<typeof values.name, string>>();

    // @ts-expect-error not a field
    await settings.fill({header: 'x'});
    await settle(settings.saveButton, {wait: Api.PatchChannel}).click();

    // a repeated item's text parts, and a scope rendered inside it
    const post = app.postList.post({id: 'p1'});
    const row = await post.read();
    assert<Equal<typeof row, {author: string | null; time: string | null}>>();
    await post.markdown.link(0).click();

    // pages: typed params, reached from App, and arrived at by clickTo when they have a ready element
    await app.channelPage.goto({team: 'ad-1', channel});
    await app.channelPage.goto({team: {name: 'ad-1'}, channel: 'town-square', path: 'messages'});

    // @ts-expect-error not one of the route's values
    await app.channelPage.goto({team: 'ad-1', channel, path: 'threads'});

    // @ts-expect-error the team is required
    await app.channelPage.goto({channel});
    const opened = await app.recapsPage.goto({team: 'ad-1'});
    await expect(opened.recaps.createButton).toBeVisible();
    expect(ChannelPage.path({team: 'ad-1', channel: 'town-square'})).toBe('/ad-1/channels/town-square');
    const arrived = await settings.moreMenu.leaveMenuItem.clickTo(app.recapsPage, {team: 'ad-1'});
    assert<Equal<typeof arrived, RecapsPage>>();

    // @ts-expect-error the page's params are checked
    await settings.moreMenu.leaveMenuItem.clickTo(app.recapsPage, {channel});

    // @ts-expect-error a page without a ready element is not a destination
    await settings.moreMenu.leaveMenuItem.clickTo(app.adminPluginsPage);

    // @ts-expect-error a family with no element of its own (it only prefixes testids) never arrives
    await settings.moreMenu.leaveMenuItem.clickTo(app.adminPlugin);
    await settings.moreMenu.leaveMenuItem.clickTo(app.adminPlugin.removeModal);
    await app.adminPluginsPage.goto();
    assert<Equal<typeof app.adminPluginsPage, AdminPluginsPage>>();

    // pressTo has clickTo's contract, on every driver
    await settings.nameTextbox.pressTo('Enter', settings.moreMenu.leaveMenuItem);
}
