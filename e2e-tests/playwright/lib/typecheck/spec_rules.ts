// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * What a spec can and cannot write against generated page objects (`generated_fixture.ts`). Every `@ts-expect-error`
 * is a rule: `tsc -p typecheck` fails if one of them starts to compile.
 */

import type {Page} from '@playwright/test';

import {
    type ButtonDriver,
    type ContainerDriver,
    type DriverFor,
    type Keyed,
    type NotRendered,
    type TabDriver,
    type TextDriver,
    expect,
    settle,
    waitForApi,
} from '../src/aria';

import {
    Api,
    App,
    ConfirmModal,
    type ConfirmModalBinding,
    type DataGridBinding,
    type DataGridRowMount,
    type RecapsPage,
    type RecapsRecapDeleteModalMount,
} from './generated_fixture';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
declare function assert<T extends true>(): T;
declare const unbound: ButtonDriver;
declare const anyTab: TabDriver;
declare const anyContainer: ContainerDriver;

// Helpers that accept different mounts preserve the binding parameter.
declare function useModal<B extends ConfirmModalBinding>(modal: ConfirmModal<B>): void;
declare function useLooseModal(modal: ConfirmModal<ConfirmModalBinding>): void;

// a mount that keys a shared family's rows by position says so in its binding, and still fits the family's constraint
const byPosition: Keyed<number, DataGridRowMount> = {$container: {}, actions: {}, name: {}, index: true};
export const fitsTheFamily: DataGridBinding = {row: byPosition};

// @ts-expect-error a set-keyed mount cannot claim positions
export const notPositions: Keyed<'a' | 'b', DataGridRowMount> = {$container: {}, actions: {}, name: {}, index: true};

export async function spec(page: Page, recapId: string, team: {name: string}): Promise<void> {
    const app = new App(page);
    const recap = app.recaps.recap(recapId);

    // --- a plain action returns nothing: nothing predicts what it opens ------------------------------------------------
    const nothing = await recap.deleteButton.click();
    assert<Equal<typeof nothing, void>>();

    // --- the spec says where a click leads, and gets that object back, typed as it passed it ----------------------------
    const modal = await recap.deleteButton.clickTo(recap.deleteModal);
    assert<Equal<typeof modal, ConfirmModal<RecapsRecapDeleteModalMount>>>();

    // an element is a destination too
    const confirm = await recap.deleteButton.clickTo(recap.deleteModal.confirmButton);
    assert<Equal<typeof confirm, ButtonDriver>>();

    // a page, with its parameters
    const recapsPage = await modal.cancelButton.clickTo(app.recapsPage, {team});
    assert<Equal<typeof recapsPage, RecapsPage>>();

    // @ts-expect-error a page needs its parameters
    await modal.cancelButton.clickTo(app.recapsPage);

    // @ts-expect-error and the right ones
    await modal.cancelButton.clickTo(app.recapsPage, {channel: 'x'});

    // @ts-expect-error a page with no ready element cannot be a destination: there is nothing to wait for
    await modal.cancelButton.clickTo(app.adminPluginsPage, undefined);

    // @ts-expect-error a scope with no element of its own (a testid prefix only) never arrives: target one of its members
    await modal.cancelButton.clickTo(app.adminPlugin);

    // @ts-expect-error nor does pressTo accept one
    await modal.cancelButton.pressTo('Enter', app.adminPlugin);

    // its members are destinations
    await modal.cancelButton.clickTo(app.adminPlugin.removeModal);

    // a scope whose own element is not rendered at this mount never arrives either
    const unrooted = new ConfirmModal(page, 'x', {$container: false, cancel: {}, checkbox: {}, confirm: {}});

    // @ts-expect-error a mount whose own element is not rendered cannot be a destination
    await modal.cancelButton.clickTo(unrooted);

    const rooted = new ConfirmModal(page, 'rooted', {$container: {}, cancel: {}, checkbox: {}, confirm: {}});
    await modal.cancelButton.clickTo(rooted);
    const either = recapId ? rooted : unrooted;
    assert<Equal<typeof either, typeof rooted | typeof unrooted>>();

    // @ts-expect-error a destination that may have no root is refused
    await modal.cancelButton.clickTo(either);

    // @ts-expect-error for a key press too
    await modal.cancelButton.pressTo('Enter', either);

    // @ts-expect-error a part that one mount never renders cannot be acted on through a union
    await (recapId ? modal : app.adminPlugin.removeModal).checkboxCheckbox.check();

    // @ts-expect-error one mount is not another even where its absent root is false
    const asRooted: typeof rooted = unrooted;

    useModal(rooted);
    useModal(unrooted);

    // @ts-expect-error the family's constraint is not a supertype of a mount with absent members
    useLooseModal(modal);

    // @ts-expect-error a part this mount never renders is not a destination
    await recap.deleteButton.clickTo(modal.checkboxCheckbox);

    // pressTo: one key or chord, then the same contract
    const opened = await recap.deleteButton.pressTo('Enter', recap.deleteModal);
    assert<Equal<typeof opened, ConfirmModal<RecapsRecapDeleteModalMount>>>();
    await anyTab.pressTo('Enter', app.recapsPage, {team});

    // @ts-expect-error pressTo takes one key and a destination, not a sequence
    await recap.deleteButton.pressTo('ArrowDown', 'Enter', recap.deleteModal);

    // a key sequence is one press call
    await recap.deleteButton.press('ArrowDown', 'ArrowDown', 'Enter');

    // @ts-expect-error a tab has select(), not click(), so it has no clickTo: one spelling per action
    await app.recaps.filter('unread').clickTo(app.recaps.grid);
    await app.recaps.filter('unread').select();
    await expect(app.recaps.grid).toBeVisible();

    // --- text, groups and containers are clicked through their drivers too, with Playwright's click options ----------
    assert<Equal<DriverFor<'group'>, TextDriver>>();
    const row = app.recaps.grid.row('regenerate');
    await row.actionsGroup.click();
    await row.nameText.click({button: 'right'});
    await row.container.click({modifiers: ['Alt']});
    await anyContainer.click({position: {x: 1, y: 1}});
    await unbound.click({modifiers: ['ControlOrMeta']});
    const fromRow = await row.container.clickTo(recap.deleteModal);
    assert<Equal<typeof fromRow, ConfirmModal<RecapsRecapDeleteModalMount>>>();
    await row.actionsGroup.clickTo(app.recapsPage, {team});
    await anyContainer.clickTo(recap.deleteModal, {timeout: 5000});

    // @ts-expect-error a trial click doesn't click: it is no action
    await row.nameText.click({trial: true});

    // @ts-expect-error a forced click skips the checks that the element can take it
    await row.container.click({force: true});

    // --- every wait names its request ---------------------------------------------------------------------------------
    const deleted = await settle(modal.confirmButton, {wait: Api.DeleteRecap}).click();
    assert<Equal<typeof deleted, {status: 'OK'}>>();

    // bound to one entity
    await settle(modal.confirmButton, {wait: Api.DeleteRecap, params: {recap_id: recapId}}).click();

    // @ts-expect-error there is no default wait
    await settle(modal.confirmButton).click();

    // @ts-expect-error nor an options object without `wait`
    await settle(modal.confirmButton, {count: 2}).click();

    // @ts-expect-error a placeholder the operation does not have
    await settle(modal.confirmButton, {wait: Api.DeleteRecap, params: {channel_id: recapId}}).click();

    // @ts-expect-error an operation without placeholders takes no params
    await settle(modal.confirmButton, {wait: Api.GetPluginStatuses, params: {typo: 'x'}}).click();

    // two requests of one operation, told apart by query: a value, and a key that must be absent
    await settle(modal.confirmButton, {wait: Api.GetPluginStatuses, query: {filter: 'active', page: null}}).click();
    await waitForApi(page, Api.GetPluginStatuses, {query: {filter: 'active'}});

    // @ts-expect-error a query value is a string, or null for "absent"
    await settle(modal.confirmButton, {wait: Api.GetPluginStatuses, query: {page: 2}}).click();

    // @ts-expect-error `unlisted` is gone: there is no list to be outside of
    await settle(modal.confirmButton, {wait: Api.RemovePlugin, unlisted: true}).click();

    // any operation of the catalog can be named on any driver, and every verb of the driver is offered
    await settle(modal.cancelButton, {wait: Api.RemovePlugin}).hover();
    await settle(unbound, {wait: Api.GetRecapOfTheDay}).press('Enter');

    // @ts-expect-error a settled action waits for a request; where it leads is a separate statement
    await settle(modal.confirmButton, {wait: Api.DeleteRecap}).clickTo(app.recaps);

    // count
    const many = await settle(recap.action('mark_read'), {wait: Api.MarkRecapRead, count: 2}).click();
    assert<Equal<typeof many, Array<{id: string; title: string}>>>();

    // several waits on one action: waiters first, then exactly one action
    const [regenerated, read] = await Promise.all([
        waitForApi(page, Api.RegenerateRecap),
        settle(recap.action('mark_read'), {wait: Api.MarkRecapRead}).click(),
    ]);
    assert<Equal<typeof regenerated, {id: string; title: string}>>();
    assert<Equal<typeof read, {id: string; title: string}>>();

    // a request and a destination
    const [gone, back] = await Promise.all([
        waitForApi(page, Api.DeleteRecap, {params: {recap_id: recapId}}),
        modal.confirmButton.clickTo(app.recapsPage, {team}),
    ]);
    assert<Equal<typeof gone, {status: 'OK'}>>();
    assert<Equal<typeof back, RecapsPage>>();

    // waitForApi keeps its predicate
    await waitForApi(page, Api.GetRecap, {predicate: (body) => body.title === 'Weekly'});

    // --- a part the mount never renders ---------------------------------------------------------------------------
    assert<Equal<typeof modal.checkboxCheckbox, NotRendered>>();

    // @ts-expect-error nothing can be called on it
    await modal.checkboxCheckbox.check();

    // @ts-expect-error and it cannot be settled
    settle(modal.checkboxCheckbox, {wait: Api.DeleteRecap});

    // @ts-expect-error nor asserted on: it has no locator matchers
    await expect(modal.checkboxCheckbox).toBeHidden();

    // the same family at the other mount does render it
    const remove = app.adminPlugin.removeModal;
    await remove.checkboxCheckbox.check();

    // --- keys ---------------------------------------------------------------------------------------------------------
    // @ts-expect-error not a member of the set
    recap.action('archive');
    await expect(app.recaps.grid.row('regenerate').nameText).toHaveText('Regenerate');
    await expect(app.adminPlugin.grid.row('com.mattermost.calls').nameText).toBeVisible();

    // @ts-expect-error this grid's rows are the set's members
    app.recaps.grid.row('com.mattermost.calls');

    // --- a file input is its own element ----------------------------------------------------------------------------
    const imported = await settle(app.recaps.importFile, {wait: Api.ImportRecaps}).chooseFiles('recaps.json');
    assert<Equal<typeof imported, {id: string; title: string}>>();

    // @ts-expect-error a button does not choose files: nothing follows it to an input
    await app.recaps.createButton.chooseFiles('recaps.json');

    // --- expect takes drivers, scopes, keyed lists and the page -------------------------------------------------------
    await expect(modal.confirmButton).toBeEnabled();
    await expect(modal.confirmButton).not.toBePressed();
    await expect(modal).toBeVisible();
    await expect(app.recaps.recapList).toHaveKeys([recapId]);
    await expect(page).toHavePath(recapsPage.pathFor({team}));
    await expect.soft(recap.titleText).toHaveText('Weekly');
    expect(await recap.titleText.text()).toBe('Weekly');
}
