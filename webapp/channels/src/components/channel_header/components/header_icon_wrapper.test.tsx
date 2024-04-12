// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import HeaderIconWrapper from 'components/channel_header/components/header_icon_wrapper';
import MentionsIcon from 'components/widgets/icons/mentions_icon';

import {renderWithContext, screen} from 'tests/react_testing_utils';

describe('components/channel_header/components/HeaderIconWrapper', () => {
    const mentionsIcon = (
        <MentionsIcon
            className='icon icon__mentions'
            aria-hidden='true'
        />
    );

    const baseProps = {
        iconComponent: mentionsIcon,
        buttonClass: 'button_class',
        buttonId: 'button_id',
        onClick: jest.fn(),
        tooltip: 'Recent mentions',
    };

    test('should be accessible', () => {
        renderWithContext(
            <HeaderIconWrapper
                {...baseProps}
            />,
        );

        expect(screen.getByLabelText('Recent mentions')).toBeVisible();
    });
});
