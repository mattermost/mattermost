// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import PublicPrivateSelector from './public-private-selector';

describe('components/widgets/public-private-selector', () => {
    test('renders Public and Private buttons with no pluginOptions', () => {
        const onChange = jest.fn();
        renderWithContext(
            <PublicPrivateSelector
                selected='O'
                onChange={onChange}
            />,
        );

        expect(screen.getByText('Public')).toBeInTheDocument();
        expect(screen.getByText('Private')).toBeInTheDocument();
        expect(screen.queryAllByRole('button')).toHaveLength(2);
    });

    test('renders three buttons when one pluginOption is provided', () => {
        const onChange = jest.fn();
        renderWithContext(
            <PublicPrivateSelector
                selected='O'
                onChange={onChange}
                pluginOptions={[
                    {
                        id: 'plug',
                        label: 'Plugin Option',
                        description: 'plugin sub',
                        icon: <i data-testid='plugin-icon'/>,
                    },
                ]}
            />,
        );

        expect(screen.getByText('Public')).toBeInTheDocument();
        expect(screen.getByText('Private')).toBeInTheDocument();
        expect(screen.getByText('Plugin Option')).toBeInTheDocument();
        expect(screen.queryAllByRole('button')).toHaveLength(3);
    });

    test('clicking plugin button fires onChange with plugin id', async () => {
        const onChange = jest.fn();
        renderWithContext(
            <PublicPrivateSelector
                selected='O'
                onChange={onChange}
                pluginOptions={[
                    {
                        id: 'plug',
                        label: 'Plugin Option',
                        description: 'plugin sub',
                        icon: <i data-testid='plugin-icon'/>,
                    },
                ]}
            />,
        );

        const pluginButton = screen.getByText('Plugin Option');
        await userEvent.click(pluginButton);

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('plug');
    });

    test('clicking already-selected plugin button does not fire onChange', async () => {
        const onChange = jest.fn();
        renderWithContext(
            <PublicPrivateSelector
                selected='plug'
                onChange={onChange}
                pluginOptions={[
                    {
                        id: 'plug',
                        label: 'Plugin Option',
                        description: 'plugin sub',
                        icon: <i/>,
                    },
                ]}
            />,
        );

        const pluginButton = screen.getByText('Plugin Option');
        await userEvent.click(pluginButton);

        expect(onChange).not.toHaveBeenCalled();
    });

    test('plugin option button shows as selected when selected matches its id', () => {
        const onChange = jest.fn();
        renderWithContext(
            <PublicPrivateSelector
                selected='plug'
                onChange={onChange}
                pluginOptions={[
                    {
                        id: 'plug',
                        label: 'Plugin Option',
                        description: 'plugin sub',
                        icon: <i/>,
                    },
                ]}
            />,
        );

        const pluginButton = screen.getByText('Plugin Option').closest('button');
        expect(pluginButton).toHaveClass('selected');
    });

    test('clicking Public button fires onChange with OPEN_CHANNEL value', async () => {
        const onChange = jest.fn();
        renderWithContext(
            <PublicPrivateSelector
                selected='P'
                onChange={onChange}
            />,
        );

        const publicButton = screen.getByText('Public');
        await userEvent.click(publicButton);

        expect(onChange).toHaveBeenCalledWith('O');
    });
});
