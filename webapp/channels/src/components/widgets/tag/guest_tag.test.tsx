// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import GuestTag from './guest_tag';

describe('components/widgets/tag/GuestTag', () => {
    test('should match the snapshot', () => {
        renderWithContext(<GuestTag className={'test'}/>);
        screen.getByText('GUEST');
    });

    test('should not render when hideTags is true', () => {
        renderWithContext(<GuestTag className={'test'}/>, {entities: {general: {config: {HideGuestTags: 'true'}}}});
        expect(() => screen.getByText('GUEST')).toThrow();
    });
});
