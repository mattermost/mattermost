// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

/**
 * The runtime as generated code sees it: the binding, driver and scope types, and the few functions it calls. Declared
 * only; the generator's tests compile generated code against it.
 */

export * from './runtime';

export const RUNTIME_API = 3;

/** Compiles only for the runtime API version this runtime implements. */
export type RuntimeApiCheck<V extends typeof RUNTIME_API> = V;

/** Plugin test packages add their page objects here by declaration merging. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Plugins {}

export declare function pluginSurfaces(page: Page): Plugins;
export declare function registerPluginSurface(name: string, factory: (page: Page) => unknown): void;

/** A route with its params filled in: `/:team/channels/:channel`. */
export declare function buildPath(route: string, params: Record<string, string | undefined>): string;

export type Message<P> = {readonly id: string; readonly defaultMessage: string; readonly __params?: P};
export declare function msg<P = Record<string, never>>(id: string, defaultMessage: string): Message<P>;
