// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import AnnouncementBar from 'components/announcement_bar/default_announcement_bar';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';

describe('components/announcement_bar/default_announcement_bar', () => {
    const originalOffsetWidth = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        'offsetWidth',
    ) as PropertyDescriptor;

    beforeAll(() => {
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
            configurable: true,
            value: 20,
        });
    });

    afterAll(() => {
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
    });

    test('should not show tooltip by default', () => {
        const wrapper = renderWithContext(<AnnouncementBar message={<span>{'Lorem Ipsum'}</span>}/>);

        wrapper.getByText('Lorem Ipsum');

        expect(wrapper.queryByRole('tooltip')).toBeNull();
    });

    test('should show tooltip on hover', async () => {
        const wrapper = renderWithContext(<AnnouncementBar message={<span>{'Lorem Ipsum'}</span>}/>);

        userEvent.hover(wrapper.getByText('Lorem Ipsum'));

        expect(screen.findByRole('tooltip')).not.toBeNull();
    });
});
