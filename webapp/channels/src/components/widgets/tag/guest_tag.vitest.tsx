// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

import GuestTag from './guest_tag';

describe('components/widgets/tag/GuestTag', () => {
    test('should match the snapshot', () => {
        renderWithContext(
            <GuestTag className={'test'}/>,
            {
                entities: {
                    general: {
                        config: {},
                    },
                },
            },
        );
        screen.getByText('GUEST');
    });

    test('should not render when hideTags is true', () => {
        renderWithContext(
            <GuestTag className={'test'}/>,
            {
                entities: {
                    general: {
                        config: {
                            HideGuestTags: 'true',
                        },
                    },
                },
            },
        );
        expect(screen.queryByText('GUEST')).toBeNull();
    });
});
