// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {MessageChannel as NodeMessageChannel} from 'node:worker_threads';

// jsdom doesn't provide MessageChannel, which syntax highlighting uses to schedule its work. It's only installed
// for the suite that calls this, after modules are loaded, so React's scheduler doesn't pick it up and hold a port open.
export function installMessageChannel() {
    beforeAll(() => {
        globalThis.MessageChannel = NodeMessageChannel as unknown as typeof MessageChannel;
    });

    afterAll(() => {
        Reflect.deleteProperty(globalThis, 'MessageChannel');
    });
}
