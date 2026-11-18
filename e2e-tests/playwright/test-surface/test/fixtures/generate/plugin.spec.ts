// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// A plugin package registers its scope's class on the host's `app.plugins`.

import {GENERATOR_API, Api, type PluginsCalls, type PluginsCallsMount} from './generated';
import {pluginSurfaces, settle, type Plugins} from './runtime';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
declare function assert<T extends true>(): T;

export async function spec(page: Parameters<typeof pluginSurfaces>[0]): Promise<void> {
    assert<Equal<Plugins['pluginsCalls'], PluginsCalls<PluginsCallsMount>>>();
    const calls = pluginSurfaces(page).pluginsCalls;
    await settle(calls.startButton, {wait: Api.StartCall}).click();
    assert<Equal<typeof GENERATOR_API, 3>>();
}
