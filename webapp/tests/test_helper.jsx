// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

/* eslint-disable no-console */
/* eslint-disable global-require */
/* eslint-disable func-names */
/* eslint-disable prefer-arrow-callback */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-unreachable */

import Client from '../client/client.jsx';

class TestHelperClass {
    constructor() {
        this.basicc = new Client();
        this.basicc.setUrl('http://localhost:8065');
    }

    basicClient = () => {
        return this.basicc;
    }

    generateId = () => {
        // implementation taken from http://stackoverflow.com/a/2117523
        var id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';

        id = id.replace(/[xy]/g, function replaceRandom(c) {
            var r = Math.floor(Math.random() * 16);

            var v;
            if (c === 'x') {
                v = r;
            } else {
                v = r & 0x3 | 0x8;
            }

            return v.toString(16);
        });

        return 'uid' + id;
    }

    fakeEmail = () => {
        return 'success' + this.generateId() + '@simulator.amazonses.com';
    }

}

var TestHelper = new TestHelperClass();
export default TestHelper;
