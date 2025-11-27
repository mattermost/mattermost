// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render} from '@testing-library/react';
import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import {MenuItemActionImpl} from './menu_item_action';

describe('components/MenuItemAction', () => {
    test('should match snapshot', () => {
        const {container} = render(
            <MenuItemActionImpl
                onClick={vi.fn()}
                text='Whatever'
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with extra text', () => {
        const {container} = render(
            <MenuItemActionImpl
                onClick={vi.fn()}
                text='Whatever'
                extraText='Extra Text'
            />,
        );

        expect(container).toMatchSnapshot();
    });
});
