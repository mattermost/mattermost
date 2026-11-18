// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Page objects for a small surface, in the shape the generator writes them, for the runtime's type tests:
 *
 *  - one family with two mounts: `ConfirmModal` at `recaps.recap.delete_modal` (its checkbox is never rendered there)
 *    and at `admin.plugin.remove_modal`; both mounts are in a portal;
 *  - one keyed child family: `RecapsRecap`, the items of `recaps.recap:{key}`;
 *  - a set-keyed part, a tab, and a native file input;
 *  - a keyed child whose key each mount supplies: `DataGrid` rows, by a set at one mount and by an id at the other;
 *    each row has a text part and a group;
 *  - two pages: one with a ready element, one without.
 *
 * Rules the generator follows, all visible below:
 *  1. One class per family, generic over its binding `B`; the class name is the family name.
 *  2. One `<Family>Binding` constraint per family: every part and `$container` a `PartBinding`, every child the child
 *     family's constraint.
 *  3. One binding type and one constant per mount, `<ScopePath>Mount` and `<scopePath>Mount`, both written out in
 *     full. A part the report does not mention at a mount is `{}`; one it marks `false` is `false`. A child's entry
 *     is the child mount's constant. A binding holds nothing else: no events, no requests, no opens.
 *  4. Every getter and method has an explicit return type. Nothing is inferred.
 *  5. Member names: `<name><RoleWord>` for a part (`confirmButton`), `<name>` for a child or a role-less part,
 *     `<name>(key)` and `<name>List` for a keyed one. Binding property names are the testid words, unchanged.
 *  6. No per-element wrapper methods (`clickX`, `setX`, `fillX`): the driver's verb is the one spelling.
 *  7. `Api` is `defineApi({...})` of `apiOp<Body>()({op, method, path})` entries.
 *  8. A page class extends `SurfacePage<Params, Ready>`, keeps its static `route` and `path`, and adds `pathFor` and
 *     `ready`.
 *  9. Output is not formatted by prettier; this file's layout is only for reading.
 *
 * In the repository the pieces go to `lib/src/ui/generated/` (git-ignored): `api.ts`, `sets.ts`, `pages.ts`, one file
 * per top-level scope, `shared.ts` for families mounted under several, `app.ts`.
 */

import type {Locator, Page} from '@playwright/test';

import {
    type ButtonDriver,
    type CheckboxDriver,
    type FileInputDriver,
    type Keyed,
    type KeyOf,
    type KeyedList,
    type MenuitemDriver,
    type Part,
    type PartBinding,
    type TabDriver,
    type TextDriver,
    Scope,
    SurfacePage,
    apiOp,
    defineApi,
    keyOf,
} from '../src/aria';

// stand-ins for `@mattermost/types/*` and the runtime's `buildPath`, which generated code imports
type Recap = {id: string; title: string};
type StatusOK = {status: 'OK'};
type PluginStatus = {plugin_id: string; state: number};
type Team = {id: string; name: string};
declare function buildPath(route: string, values: Record<string, string | undefined>): string;

// ---------------------------------------------------------------------------------------------------------------------
// api.ts
// ---------------------------------------------------------------------------------------------------------------------

/** Every operation the client can send. A spec names one in `settle(driver, {wait: Api.X})`. */
export const Api = defineApi({
    DeleteRecap: apiOp<StatusOK>()({op: 'DeleteRecap', method: 'DELETE', path: '/api/v4/recaps/{recap_id}'}),
    GetPluginStatuses: apiOp<PluginStatus[]>()({
        op: 'GetPluginStatuses',
        method: 'GET',
        path: '/api/v4/plugins/statuses',
    }),
    GetRecap: apiOp<Recap>()({op: 'GetRecap', method: 'GET', path: '/api/v4/recaps/{recap_id}'}),
    GetRecapOfTheDay: apiOp<Recap>()({op: 'GetRecapOfTheDay', method: 'GET', path: '/api/v4/recaps/today'}),
    ImportRecaps: apiOp<Recap>()({op: 'ImportRecaps', method: 'POST', path: '/api/v4/recaps/import'}),
    MarkRecapRead: apiOp<Recap>()({op: 'MarkRecapRead', method: 'POST', path: '/api/v4/recaps/{recap_id}/read'}),
    RegenerateRecap: apiOp<Recap>()({
        op: 'RegenerateRecap',
        method: 'POST',
        path: '/api/v4/recaps/{recap_id}/regenerate',
    }),
    RemovePlugin: apiOp<StatusOK>()({op: 'RemovePlugin', method: 'DELETE', path: '/api/v4/plugins/{plugin_id}'}),
});

// ---------------------------------------------------------------------------------------------------------------------
// sets.ts
// ---------------------------------------------------------------------------------------------------------------------

/** The members, as they are written in testids. A spec passes the literal: `recap.action('mark_read')`. */
export const RecapAction = ['mark_read', 'regenerate'] as const;
export type RecapAction = (typeof RecapAction)[number];

export const RecapFilter = ['all', 'unread'] as const;
export type RecapFilter = (typeof RecapFilter)[number];

// ---------------------------------------------------------------------------------------------------------------------
// shared.ts: ConfirmModal, a family with two mounts
// ---------------------------------------------------------------------------------------------------------------------

export type ConfirmModalBinding = {
    $container: PartBinding;
    cancel: PartBinding;
    checkbox: PartBinding;
    confirm: PartBinding;
};

/** `ConfirmModal`: mounted at `admin.plugin.remove_modal`, `recaps.recap.delete_modal`. */
export class ConfirmModal<in out B extends ConfirmModalBinding> extends Scope<B> {
    /** `<scope>--dialog` (ConfirmModal) */
    get container(): Part<TextDriver, B['$container']> {
        return this.own<'dialog', B['$container']>('dialog', this.bind.$container);
    }

    /** `<scope>.cancel--button` (ConfirmModal) */
    get cancelButton(): Part<ButtonDriver, B['cancel']> {
        return this.part<'button', B['cancel']>('cancel', 'button', this.bind.cancel);
    }

    /** `<scope>.checkbox--checkbox` (ConfirmModal). Rendered only under a condition. */
    get checkboxCheckbox(): Part<CheckboxDriver, B['checkbox']> {
        return this.part<'checkbox', B['checkbox']>('checkbox', 'checkbox', this.bind.checkbox);
    }

    /** `<scope>.confirm--button` (ConfirmModal) */
    get confirmButton(): Part<ButtonDriver, B['confirm']> {
        return this.part<'button', B['confirm']>('confirm', 'button', this.bind.confirm);
    }
}

// ---------------------------------------------------------------------------------------------------------------------
// shared.ts: DataGrid, whose rows are keyed by whatever each mount lists
// ---------------------------------------------------------------------------------------------------------------------

export type DataGridRowBinding = {
    $container: PartBinding;
    actions: PartBinding;
    name: PartBinding;
};

/** `DataGridRow`: the items of `<grid>.row:{key}--row`. */
export class DataGridRow<in out B extends DataGridRowBinding> extends Scope<B> {
    /** `<scope>:{key}--row` (DataGridRow) */
    get container(): Part<TextDriver, B['$container']> {
        return this.own<'row', B['$container']>('row', this.bind.$container);
    }

    /** `<scope>.actions--group` (DataGridRow) */
    get actionsGroup(): Part<TextDriver, B['actions']> {
        return this.part<'group', B['actions']>('actions', 'group', this.bind.actions);
    }

    /** `<scope>.name--text` (DataGridRow) */
    get nameText(): Part<TextDriver, B['name']> {
        return this.part<'text', B['name']>('name', 'text', this.bind.name);
    }
}

export type DataGridBinding = {
    row: Keyed<string | number, DataGridRowBinding>;
};

/** `DataGrid`: mounted at `admin.plugin.grid`, `recaps.grid`. */
export class DataGrid<in out B extends DataGridBinding> extends Scope<B> {
    /** `<scope>.row:{key}--row`: DataGridRow, keyed by what the mount lists. */
    row(key: KeyOf<B['row']>): DataGridRow<B['row']> {
        const item = this.item('row', 'row', key);
        return new DataGridRow(this.page, `${this.scope}.row`, this.bind.row, item, item);
    }

    get rowList(): KeyedList<KeyOf<B['row']>, DataGridRow<B['row']>> {
        return this.list('row', 'row', (key: KeyOf<B['row']>) => this.row(key), {index: this.bind.row.index});
    }
}

export type DataGridRowMount = {
    $container: {};
    actions: {};
    name: {};
};
export const dataGridRowMount: DataGridRowMount = {
    $container: {},
    actions: {},
    name: {},
};

// ---------------------------------------------------------------------------------------------------------------------
// recaps.ts
// ---------------------------------------------------------------------------------------------------------------------

/** `recaps.recap.delete_modal`: a mount of ConfirmModal. */
export type RecapsRecapDeleteModalMount = {
    $container: {};
    cancel: {};
    checkbox: false;
    confirm: {};
};
export const recapsRecapDeleteModalMount: RecapsRecapDeleteModalMount = {
    $container: {},
    cancel: {},
    checkbox: false,
    confirm: {},
};

export type RecapsRecapBinding = {
    $container: PartBinding;
    action: PartBinding;
    delete: PartBinding;
    delete_modal: ConfirmModalBinding;
    title: PartBinding;
};

/** `recaps.recap`: a mount of RecapsRecap. */
export type RecapsRecapMount = {
    $container: {};
    action: {};
    delete: {};
    delete_modal: RecapsRecapDeleteModalMount;
    title: {};
};
export const recapsRecapMount: RecapsRecapMount = {
    $container: {},
    action: {},
    delete: {},
    delete_modal: recapsRecapDeleteModalMount,
    title: {},
};

/** `RecapsRecap`: the items of `recaps.recap:{key}`. */
export class RecapsRecap<in out B extends RecapsRecapBinding> extends Scope<B> {
    /** `<scope>.action:{key}--menuitem` (RecapMenu) */
    action(key: RecapAction): Part<MenuitemDriver, B['action']> {
        return this.keyed<'menuitem', B['action'], RecapAction>('action', 'menuitem', key, this.bind.action, {
            source: 'RecapMenu',
        });
    }

    get actionList(): Part<KeyedList<RecapAction, Part<MenuitemDriver, B['action']>>, B['action']> {
        return this.partList<RecapAction, Part<MenuitemDriver, B['action']>, B['action']>(
            'action',
            'menuitem',
            this.bind.action,
            (key: RecapAction) => this.action(key),
        );
    }

    /** `<scope>.delete--button` (RecapItem) */
    get deleteButton(): Part<ButtonDriver, B['delete']> {
        return this.part<'button', B['delete']>('delete', 'button', this.bind.delete, {source: 'RecapItem'});
    }

    /** `<scope>.delete_modal`: ConfirmModal, in a portal. */
    get deleteModal(): ConfirmModal<B['delete_modal']> {
        return new ConfirmModal(this.page, `${this.scope}.delete_modal`, this.bind.delete_modal);
    }

    /** `<scope>.title--text` (RecapItem) */
    get titleText(): Part<TextDriver, B['title']> {
        return this.part<'text', B['title']>('title', 'text', this.bind.title, {source: 'RecapItem'});
    }
}

/** `recaps.grid`: a mount of DataGrid, its rows keyed by the set `RecapAction`. */
export type RecapsGridMount = {
    row: Keyed<RecapAction, DataGridRowMount>;
};
export const recapsGridMount: RecapsGridMount = {
    row: dataGridRowMount,
};

export type RecapsBinding = {
    create: PartBinding;
    filter: PartBinding;
    grid: DataGridBinding;
    import_file: PartBinding;
    recap: RecapsRecapBinding;
};

/** `recaps`: a mount of Recaps. */
export type RecapsMount = {
    create: {};
    filter: {};
    grid: RecapsGridMount;
    import_file: {};
    recap: RecapsRecapMount;
};
export const recapsMount: RecapsMount = {
    create: {},
    filter: {},
    grid: recapsGridMount,
    import_file: {},
    recap: recapsRecapMount,
};

/** `Recaps` */
export class Recaps<in out B extends RecapsBinding> extends Scope<B> {
    /** `<scope>.create--button` (Recaps) */
    get createButton(): Part<ButtonDriver, B['create']> {
        return this.part<'button', B['create']>('create', 'button', this.bind.create);
    }

    /** `<scope>.filter:{key}--tab` (Recaps) */
    filter(key: RecapFilter): Part<TabDriver, B['filter']> {
        return this.keyed<'tab', B['filter'], RecapFilter>('filter', 'tab', key, this.bind.filter);
    }

    /** `<scope>.grid`: DataGrid. */
    get grid(): DataGrid<B['grid']> {
        return new DataGrid(this.page, `${this.scope}.grid`, this.bind.grid, this.root);
    }

    /** `<scope>.import_file` (Recaps): a native file input. */
    get importFile(): Part<FileInputDriver, B['import_file']> {
        return this.fileInput<B['import_file']>('import_file', this.bind.import_file);
    }

    /** `<scope>.recap:{key}`: RecapsRecap, keyed by `Recap.id`. */
    recap(recap: Pick<Recap, 'id'> | string): RecapsRecap<B['recap']> {
        const item = this.item('recap', null, keyOf(recap, 'id'));
        return new RecapsRecap(this.page, `${this.scope}.recap`, this.bind.recap, item, item);
    }

    get recapList(): KeyedList<string, RecapsRecap<B['recap']>> {
        return this.list('recap', null, (key: string) => this.recap(key));
    }
}

// ---------------------------------------------------------------------------------------------------------------------
// admin.ts
// ---------------------------------------------------------------------------------------------------------------------

/** `admin.plugin.remove_modal`: a mount of ConfirmModal. */
export type AdminPluginRemoveModalMount = {
    $container: {};
    cancel: {};
    checkbox: {};
    confirm: {};
};
export const adminPluginRemoveModalMount: AdminPluginRemoveModalMount = {
    $container: {},
    cancel: {},
    checkbox: {},
    confirm: {},
};

/** `admin.plugin.grid`: a mount of DataGrid, its rows keyed by `PluginStatus.plugin_id`. */
export type AdminPluginGridMount = {
    row: Keyed<string, DataGridRowMount>;
};
export const adminPluginGridMount: AdminPluginGridMount = {
    row: dataGridRowMount,
};

export type AdminPluginBinding = {
    grid: DataGridBinding;
    remove_modal: ConfirmModalBinding;
};
export type AdminPluginMount = {
    grid: AdminPluginGridMount;
    remove_modal: AdminPluginRemoveModalMount;
};
export const adminPluginMount: AdminPluginMount = {
    grid: adminPluginGridMount,
    remove_modal: adminPluginRemoveModalMount,
};

/** `AdminPlugin` */
export class AdminPlugin<in out B extends AdminPluginBinding> extends Scope<B> {
    /** `<scope>.grid`: DataGrid. */
    get grid(): DataGrid<B['grid']> {
        return new DataGrid(this.page, `${this.scope}.grid`, this.bind.grid, this.root);
    }

    /** `<scope>.remove_modal`: ConfirmModal, in a portal. */
    get removeModal(): ConfirmModal<B['remove_modal']> {
        return new ConfirmModal(this.page, `${this.scope}.remove_modal`, this.bind.remove_modal);
    }
}

// ---------------------------------------------------------------------------------------------------------------------
// pages.ts
// ---------------------------------------------------------------------------------------------------------------------

export type RecapsPageParams = {
    /** a Team or its name */
    team: Pick<Team, 'name'> | string;
};

/** `/:team/recaps`, rendered by `Recaps`. */
export class RecapsPage extends SurfacePage<RecapsPageParams, true> {
    static readonly route = '/:team/recaps';

    /** The URL path for these params. */
    static path(params: RecapsPageParams): string {
        return buildPath(RecapsPage.route, {team: keyOf(params.team, 'name')});
    }

    pathFor(params: RecapsPageParams): string {
        return RecapsPage.path(params);
    }

    /** `recaps.create--button` shows the page is up. */
    get ready(): readonly [Locator] {
        return [this.page.getByTestId('recaps.create--button')];
    }

    /** `recaps` */
    get recaps(): Recaps<RecapsMount> {
        return new Recaps(this.page, 'recaps', recapsMount);
    }
}

/** `/admin_console/plugins`, rendered by `PluginManagement`. The report gives it no ready element. */
export class AdminPluginsPage extends SurfacePage<void, false> {
    static readonly route = '/admin_console/plugins';

    static path(): string {
        return buildPath(AdminPluginsPage.route, {});
    }

    pathFor(): string {
        return AdminPluginsPage.path();
    }

    get ready(): readonly [] {
        return [];
    }

    /** `admin.plugin` */
    get adminPlugin(): AdminPlugin<AdminPluginMount> {
        return new AdminPlugin(this.page, 'admin.plugin', adminPluginMount);
    }
}

// ---------------------------------------------------------------------------------------------------------------------
// app.ts
// ---------------------------------------------------------------------------------------------------------------------

export class App {
    constructor(readonly page: Page) {}

    get adminPlugin(): AdminPlugin<AdminPluginMount> {
        return new AdminPlugin(this.page, 'admin.plugin', adminPluginMount);
    }

    get adminPluginsPage(): AdminPluginsPage {
        return new AdminPluginsPage(this.page);
    }

    get recaps(): Recaps<RecapsMount> {
        return new Recaps(this.page, 'recaps', recapsMount);
    }

    get recapsPage(): RecapsPage {
        return new RecapsPage(this.page);
    }
}
