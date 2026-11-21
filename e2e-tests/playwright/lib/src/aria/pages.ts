// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator, Page} from '@playwright/test';

/**
 * The URL path for a route as the router writes it (`/:team/:path(channels|messages)/:identifier/:postid?`):
 * params are URL-encoded; a missing optional param drops its segment; a missing required one throws.
 */
export function buildPath(route: string, values: Record<string, string | undefined>): string {
    const out = route.replace(/\/:(\w+)(?:\([^)]*\))?(\?)?/g, (_, name: string, optional?: string) => {
        const v = values[name];
        if (v === undefined || v === '') {
            if (!optional) {
                throw new Error(`${route}: param "${name}" is required`);
            }
            return '';
        }
        // `@` and `:` are allowed in a path segment (DMs are `/messages/@username`)
        return '/' + encodeURIComponent(v).replace(/%40/g, '@').replace(/%3A/gi, ':');
    });
    return out || '/';
}

/**
 * Base of every generated page class. `Ready` is `true` when the report lists at least one ready testid for the page.
 * The generated class keeps its static `route` and static `path(params)`; `pathFor` is the same function on the
 * instance, which is what `clickTo` and `pressTo` read.
 */
export abstract class SurfacePage<Params = void, Ready extends boolean = boolean> {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    /** The URL path for these params. */
    abstract pathFor(params: Params): string;

    /** The elements of which one shows the page is up. Empty when the report gives none. */
    abstract get ready(): Ready extends true ? readonly [Locator, ...Locator[]] : readonly Locator[];

    /** Navigates here and, when the page has ready elements, waits until one of them is visible. */
    async goto(params: Params): Promise<this> {
        await this.page.goto(this.pathFor(params));
        const [first, ...rest] = this.ready;
        if (first) {
            // the first visible match: a hidden one earlier in the DOM (another layout's) is not the page being up
            await rest
                .reduce((any, next) => any.or(next), first)
                .filter({visible: true})
                .first()
                .waitFor({state: 'visible'});
        }
        return this;
    }
}

/** A page `clickTo` and `pressTo` accept: one that has a ready element to wait for. Nothing invents one. */
export type ReadyPage = SurfacePage<any, true>;

export type ParamsOf<P> = P extends SurfacePage<infer Params, boolean> ? Params : never;
