// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {mmBlocksFieldDomId} from './field_dom_id';

describe('mmBlocksFieldDomId', () => {
    it('scopes field names by post id', () => {
        expect(mmBlocksFieldDomId('post-a', 'title')).toBe('mm-blocks-post-a-title');
        expect(mmBlocksFieldDomId('post-b', 'title')).toBe('mm-blocks-post-b-title');
    });
});
