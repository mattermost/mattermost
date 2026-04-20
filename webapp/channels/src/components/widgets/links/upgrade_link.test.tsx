// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import UpgradeLink from './upgrade_link';

describe('components/widgets/links/UpgradeLink', () => {
    test('should match the snapshot on show', () => {
        const {container} = renderWithContext(<UpgradeLink/>);

        expect(container).toMatchSnapshot();
    });

    test('should open window when button clicked', async () => {
        const mockWindowOpen = jest.fn();
        global.window.open = mockWindowOpen;

        renderWithContext(<UpgradeLink/>, {
            entities: {
                general: {},
                cloud: {
                    customer: {},
                },
                users: {
                    profiles: {},
                },
            },
        });

        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();

        await userEvent.click(button);

        expect(mockWindowOpen).toHaveBeenCalled();
    });
});
