// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Bindings: what each mount says about a family's parts. A generated class describes a FAMILY (what parts exist), a
 * generated constant describes a MOUNT (which parts are rendered there and what fills their keys). Nothing in a binding
 * says what an action does: a spec states that where it acts, with `settle(driver, {wait})` and `clickTo`.
 */

import type {Role} from './grammar';

/**
 * What a mount says about a part: `false` when the part is never rendered there; otherwise an object that is empty
 * except, at type level, for the key's type when the family leaves the key to the mount (`Keyed<SettingsTab>`).
 */
export type PartBinding = false | {readonly __key?: unknown; readonly index?: true};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- a keyed part with nothing else to say is `{}`, as in generated bindings
export type Keyed<K extends string | number, P extends object = {}> = P & {readonly __key?: K} & KeyIsIndex<K>;

/**
 * A mount that keys by position says so in the binding's value, since the family's class is shared by mounts that key
 * otherwise: generated code passes it on (`{index: this.bind.row.index}`), and the list's keys come back as numbers.
 */
type KeyIsIndex<K> = [K] extends [number]
    ? {readonly index: true}
    : [number] extends [K]
      ? {readonly index?: true}
      : {readonly index?: undefined};

/**
 * The key a mount gives a keyed part or a keyed child whose family leaves the key to the mount. It is the key itself
 * (an id string, a set member, an index): passing the entity instead is offered only where the family fixes the key,
 * since only then is the field known.
 */
export type KeyOf<P> = P extends {readonly __key?: infer K extends string | number} ? K : never;

/** What a part's getter returns at a mount where the part is never rendered: nothing can be called on it. */
export type NotRendered = {readonly notRendered: true};

/** `D` where the part is rendered, `NotRendered` where its binding is `false`. Never `never`: misuse must not compile. */
export type Part<D, P extends PartBinding> = P extends false ? NotRendered : D;

export type Meta = {
    readonly testId: string;
    readonly role: Role | null;

    /**
     * The component that renders the element: the report's `source` for the part, else the family's. Failures print
     * `  element: <testId> (<source>)`.
     */
    readonly source: string;
};
