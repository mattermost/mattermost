// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {publishedComponents} from './published_components';

describe('publishedComponents', () => {
    test('publishes core\'s WithTooltip', () => {
        expect(publishedComponents.WithTooltip).toBe(WithTooltip);
    });

    test('WithTooltip shows its title on hover', async () => {
        const {WithTooltip: PublishedWithTooltip} = publishedComponents;
        renderWithContext(
            <PublishedWithTooltip title='Tooltip title'>
                <button>{'Trigger'}</button>
            </PublishedWithTooltip>,
        );

        await userEvent.hover(screen.getByRole('button', {name: 'Trigger'}));

        expect(await screen.findByText('Tooltip title')).toBeInTheDocument();
    });
});
