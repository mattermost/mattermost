// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {mmBlocksFieldDomId, mmBlocksFieldErrorId} from './field_dom_id';

describe('mmBlocksFieldDomId', () => {
    it('scopes field names by post id', () => {
        expect(mmBlocksFieldDomId('post-a', 'title')).toBe('mm-blocks-post-a-title');
        expect(mmBlocksFieldDomId('post-b', 'title')).toBe('mm-blocks-post-b-title');
    });
});

describe('mmBlocksFieldErrorId', () => {
    it('scopes error ids by post id', () => {
        expect(mmBlocksFieldErrorId('post-a', 'title')).toBe('mm-blocks-post-a-title-error');
        expect(mmBlocksFieldErrorId('post-b', 'title')).toBe('mm-blocks-post-b-title-error');
        expect(mmBlocksFieldErrorId('', 'title')).toBe('mm-blocks--title-error');
    });
});
