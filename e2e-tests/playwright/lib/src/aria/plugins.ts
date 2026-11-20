// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

/**
 * The plugin surfaces a spec can reach (`app.plugins.<name>`). Empty here: a plugin's generated test package adds its
 * own by declaration merging into this interface (`declare module` on the runtime the package was generated
 * against), so a spec that imports the package sees it.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Plugins {}

type Factory = (page: Page) => unknown;

const factories = new Map<string, Factory>();
const cache = new WeakMap<Page, Map<string, unknown>>();

/** Called by a plugin's generated test package: `registerPluginSurface('comMattermostCalls', (page) => new ComMattermostCalls(page))`. */
export function registerPluginSurface(name: string, factory: Factory) {
    factories.set(name, factory);
}

// read by tools and runtimes that probe any object (await, JSON, util.inspect, expect): never a plugin surface. A
// surface's name is a camelCase identifier; anything else (`_apiName`, `$$typeof`, symbols) reads as undefined.
const PROBED = new Set([
    'then',
    'toJSON',
    'constructor',
    'asymmetricMatch',
    'nodeType',
    'inspect',
    'toString',
    'valueOf',
]);
const SURFACE_NAME = /^[a-z][A-Za-z0-9]*$/;

/**
 * The registered plugin surfaces for a page (`app.plugins`): each one is created on first access and kept for the
 * page. Reading one that no imported package registered throws, naming the package to import (its type exists as
 * soon as any file in the program imports the package, so the compiler can't catch a spec that forgot to).
 */
export function pluginSurfaces(page: Page): Plugins {
    let surfaces = cache.get(page);
    if (!surfaces) {
        surfaces = new Map();
        cache.set(page, surfaces);
    }
    const created = surfaces;
    // typed as the merged interface: what a surface is depends on the packages a spec imports, not on this object
    return new Proxy({} as Record<string, unknown>, {
        get(_, name) {
            if (typeof name !== 'string' || PROBED.has(name) || !SURFACE_NAME.test(name)) {
                return undefined;
            }
            if (created.has(name)) {
                return created.get(name);
            }
            const factory = factories.get(name);
            if (!factory) {
                throw new Error(
                    `app.plugins.${name} is not registered: import its test package in this spec.` +
                        ` Registered: ${[...factories.keys()].join(', ') || 'none'}.`,
                );
            }
            const surface = factory(page);
            created.set(name, surface);
            return surface;
        },
        has(_, name) {
            return typeof name === 'string' && factories.has(name);
        },
        ownKeys() {
            return [...factories.keys()];
        },
        getOwnPropertyDescriptor(_, name) {
            return typeof name === 'string' && factories.has(name) ? {enumerable: true, configurable: true} : undefined;
        },
    }) as unknown as Plugins;
}
