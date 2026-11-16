// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import ProfilePopoverTitle from './profile_popover_title';

describe('components/ProfilePopoverTitle', () => {
    const baseProps = {
        roles: '',
        userId: 'user_id',
        returnFocus: jest.fn(),
    };

    test('should render ImportedInactiveTag when isImportedInactive is true', () => {
        renderWithContext(
            <ProfilePopoverTitle
                {...baseProps}
                isImportedInactive={true}
            />,
        );

        expect(screen.getByText('IMPORTED - INACTIVE')).toBeInTheDocument();
    });

    test('should not render ImportedInactiveTag when isImportedInactive is false', () => {
        renderWithContext(
            <ProfilePopoverTitle
                {...baseProps}
                isImportedInactive={false}
            />,
        );

        expect(screen.queryByText('IMPORTED - INACTIVE')).not.toBeInTheDocument();
    });

    test('should not render ImportedInactiveTag when isImportedInactive is omitted', () => {
        renderWithContext(<ProfilePopoverTitle {...baseProps}/>);

        expect(screen.queryByText('IMPORTED - INACTIVE')).not.toBeInTheDocument();
    });
});
