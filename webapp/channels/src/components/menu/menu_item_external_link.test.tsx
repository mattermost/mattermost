// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import {WithTestMenuContext} from './menu_context_test';
import {MenuItemExternalLink} from './menu_item_external_link';

describe('MenuItemExternalLink', () => {
    it('renders as an anchor so the URL can be copied or opened in a new tab', () => {
        renderWithContext(
            <WithTestMenuContext>
                <MenuItemExternalLink
                    href='https://docs.mattermost.com/guides/administration.html'
                    location='test'
                    labels={<span>{"Administrator's Guide"}</span>}
                />
            </WithTestMenuContext>,
        );

        const item = screen.getByRole('menuitem', {name: "Administrator's Guide"});

        expect(item.tagName).toBe('A');
        expect(item).toHaveAttribute('href', expect.stringContaining('https://docs.mattermost.com/guides/administration.html'));
        expect(item).toHaveAttribute('target', '_blank');
        expect(item).toHaveAttribute('rel', 'noopener noreferrer');
    });
});
