// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Page objects for the test pages, in the shape the generator writes them: one class per family, generic over its
// binding, one binding constant per mount, and page classes on SurfacePage.

import type {Locator, Page} from '@playwright/test';

import type {Keyed, KeyOf, Part, PartBinding} from '../src/aria/bindings';
import type {
    ButtonDriver,
    CheckboxDriver,
    ContainerDriver,
    FileInputDriver,
    MenuitemDriver,
    TabDriver,
    TextboxDriver,
    TextDriver,
} from '../src/aria/drivers';
import {SurfacePage, buildPath} from '../src/aria/pages';
import type {KeyedList} from '../src/aria/scope';
import {Scope} from '../src/aria/scope';

export type DialogBinding = {$container: PartBinding; confirm: PartBinding; remember: PartBinding};

/** `<scope>--dialog`: a confirm dialog, rendered in a portal. */
export class Dialog<B extends DialogBinding> extends Scope<B> {
    get container(): Part<ContainerDriver, B['$container']> {
        return this.own<null, B['$container']>(null, this.bind.$container);
    }

    get confirmButton(): Part<ButtonDriver, B['confirm']> {
        return this.part<'button', B['confirm']>('confirm', 'button', this.bind.confirm, {portal: true});
    }

    get rememberCheckbox(): Part<CheckboxDriver, B['remember']> {
        return this.part<'checkbox', B['remember']>('remember', 'checkbox', this.bind.remember);
    }
}

export type ComposerDeleteDialogMount = {$container: {}; confirm: {}; remember: false};
export const composerDeleteDialogMount: ComposerDeleteDialogMount = {$container: {}, confirm: {}, remember: false};

export type ItemBinding = {$container: PartBinding; title: PartBinding; options: PartBinding};
export class Item<B extends ItemBinding> extends Scope<B> {
    get container(): Part<ContainerDriver, B['$container']> {
        return this.own<null, B['$container']>(null, this.bind.$container);
    }

    get titleText(): Part<TextDriver, B['title']> {
        return this.part<'text', B['title']>('title', 'text', this.bind.title);
    }

    get optionsGroup(): Part<TextDriver, B['options']> {
        return this.part<'group', B['options']>('options', 'group', this.bind.options);
    }
}
export const itemMount = {$container: {}, title: {}, options: {}} as const;

export type ComposerMount = {
    save: {};
    send: {};
    delete: {};
    attach: {};
    message: {};
    action: {};
    tab: {};
    hidden: false;
    delete_dialog: ComposerDeleteDialogMount;
    row: Keyed<string, typeof itemMount>;
};

export const composerMount: ComposerMount = {
    save: {},
    send: {},
    delete: {},
    attach: {},
    message: {},
    action: {},
    tab: {},
    hidden: false,
    delete_dialog: composerDeleteDialogMount,
    row: itemMount,
};

export type ComposerBinding = {
    save: PartBinding;
    send: PartBinding;
    delete: PartBinding;
    attach: PartBinding;
    message: PartBinding;
    action: PartBinding;
    tab: PartBinding;
    hidden: PartBinding;
    delete_dialog: DialogBinding;
    row: Keyed<string | number, ItemBinding>;
};

export type ComposerAction = 'post' | 'a:b--c';

export class Composer<B extends ComposerBinding> extends Scope<B> {
    get saveButton(): Part<ButtonDriver, B['save']> {
        return this.part<'button', B['save']>('save', 'button', this.bind.save);
    }

    get sendButton(): Part<ButtonDriver, B['send']> {
        return this.part<'button', B['send']>('send', 'button', this.bind.send);
    }

    get deleteButton(): Part<ButtonDriver, B['delete']> {
        return this.part<'button', B['delete']>('delete', 'button', this.bind.delete);
    }

    /** `<scope>.attach`, a native file input. */
    get attach(): Part<FileInputDriver, B['attach']> {
        return this.fileInput<B['attach']>('attach', this.bind.attach);
    }

    get messageTextbox(): Part<TextboxDriver, B['message']> {
        return this.part<'textbox', B['message']>('message', 'textbox', this.bind.message);
    }

    get tabTab(): Part<TabDriver, B['tab']> {
        return this.part<'tab', B['tab']>('tab', 'tab', this.bind.tab);
    }

    action<K extends ComposerAction>(key: K): Part<MenuitemDriver, B['action']> {
        return this.keyed<'menuitem', B['action'], K>('action', 'menuitem', key, this.bind.action);
    }

    get hiddenButton(): Part<ButtonDriver, B['hidden']> {
        return this.part<'button', B['hidden']>('hidden', 'button', this.bind.hidden);
    }

    /** `<scope>.delete_dialog`: Dialog, in a portal. */
    get deleteDialog(): Dialog<B['delete_dialog']> {
        return new Dialog(this.page, `${this.scope}.delete_dialog`, this.bind.delete_dialog);
    }

    row(key: KeyOf<B['row']>): Item<B['row']> {
        const element = this.item('row', null, key);
        return new Item(this.page, `${this.scope}.row`, this.bind.row, element, element);
    }

    /** Positions, not ids: `composer.slot:<index>`. */
    get slotList(): KeyedList<number, Item<B['row']>> {
        return this.list('slot', null, (index: number) => this.row(String(index) as KeyOf<B['row']>), {index: true});
    }

    /** A part another component renders: failures name that component. */
    get labelText(): Part<TextDriver, B['save']> {
        return this.part<'text', B['save']>('label', 'text', this.bind.save, {source: 'SaveLabel'});
    }

    get rowList(): KeyedList<KeyOf<B['row']>, Item<B['row']>> {
        return this.list('row', null, (key: KeyOf<B['row']>) => this.row(key));
    }
}

export const composer = (page: Page): Composer<ComposerMount> => new Composer(page, 'composer', composerMount);

export type ChannelPageParams = {channel: string};

/** `/channels/:channel`, a page with a ready element. */
export class ChannelPage extends SurfacePage<ChannelPageParams, true> {
    static readonly route = '/channels/:channel';

    static path(params: ChannelPageParams): string {
        return buildPath(ChannelPage.route, {channel: params.channel});
    }

    pathFor(params: ChannelPageParams): string {
        return ChannelPage.path(params);
    }

    get ready(): readonly [Locator] {
        return [this.page.getByTestId('channel.view')];
    }
}

/** `/about`, a page the report gives no ready element: not a destination. */
export class AboutPage extends SurfacePage<void, false> {
    pathFor(): string {
        return '/about';
    }

    get ready(): readonly [] {
        return [];
    }
}
