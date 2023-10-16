// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import hlJS from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import swift from 'highlight.js/lib/languages/swift';

import {highlight} from './syntax_highlighting';

jest.mock('highlight.js/lib/core');

describe('utils/syntax_highlighting.tsx', () => {
    it('should register full name language', async () => {
        expect.assertions(1);

        await highlight('swift', '');

        expect(hlJS.registerLanguage).toHaveBeenCalledWith('swift', swift);
    });

    it('should register alias language', async () => {
        expect.assertions(1);

        await highlight('js', '');

        expect(hlJS.registerLanguage).toHaveBeenCalledWith('javascript', javascript);
    });
});
