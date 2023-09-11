// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithIntlAndStore, screen} from 'tests/react_testing_utils';

import GuestTag from './guest_tag';

describe('components/widgets/tag/GuestTag', () => {
    test('should match the snapshot', () => {
        renderWithIntlAndStore(<GuestTag className={'test'}/>);
        screen.getByText('GUEST');
    });

    test('should not render when hideTags is true', () => {
        renderWithIntlAndStore(<GuestTag className={'test'}/>, {entities: {general: {config: {HideGuestTags: 'true'}}}});
        expect(() => screen.getByText('GUEST')).toThrow();
    });
});
