// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

declare const REMOTE_CONTAINERS: Record<string, string>;

declare module 'boards' {
    // eslint-disable-next-line import/no-duplicates
    import {ProductPlugin} from 'plugins/products';

    export default class Plugin extends ProductPlugin {
        initialize(registry: PluginRegistry, store: Store): void;
        uninitialize(): void;
    }
}

declare module 'boards/manifest' {
    // eslint-disable-next-line import/no-duplicates
    import type {PluginManifest} from '@mattermost/types/plugins';
    const module: PluginManifest;
    export default module;
}

declare module 'playbooks' {
    // eslint-disable-next-line import/no-duplicates
    import {ProductPlugin} from 'plugins/products';

    export default class Plugin extends ProductPlugin {
        initialize(registry: PluginRegistry, store: Store): void;
        uninitialize(): void;
    }
}

declare module 'playbooks/manifest' {
    // eslint-disable-next-line import/no-duplicates
    import type {PluginManifest} from '@mattermost/types/plugins';
    const module: PluginManifest;
    export default module;
}
