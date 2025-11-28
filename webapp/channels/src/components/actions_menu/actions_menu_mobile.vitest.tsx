// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import ActionsMenu from 'components/actions_menu/actions_menu';
import type {Props} from 'components/actions_menu/actions_menu';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

vi.mock('utils/utils', () => {
    return {
        isMobile: vi.fn(() => true),
        localizeMessage: vi.fn(),
    };
});

vi.mock('utils/post_utils', async (importOriginal) => {
    const original = await importOriginal<typeof import('utils/post_utils')>();
    return {
        ...original,
        isSystemMessage: vi.fn(() => true),
    };
});

describe('components/actions_menu/ActionsMenu on mobile view', () => {
    test('should match snapshot', () => {
        const baseProps: Omit<Props, 'intl'> = {
            post: TestHelper.getPostMock({id: 'post_id_1'}),
            teamId: 'team_id_1',
            handleDropdownOpened: vi.fn(),
            isMenuOpen: true,
            actions: {
                openModal: vi.fn(),
                openAppsModal: vi.fn(),
                handleBindingClick: vi.fn(),
                postEphemeralCallResponseForPost: vi.fn(),
                fetchBindings: vi.fn(),
            },
            appBindings: [],
            pluginMenuItems: [],
            appsEnabled: false,
            isSysAdmin: true,
            canOpenMarketplace: false,
            pluginMenuItemComponents: [],
        };

        const {container} = renderWithContext(
            <ActionsMenu {...baseProps}/>,
        );

        // When isSystemMessage returns true (mocked above), the component returns null
        expect(container.firstChild).toBeNull();
    });
});
