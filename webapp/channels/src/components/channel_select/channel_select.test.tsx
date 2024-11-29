// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen} from '@testing-library/react';

import type {ChannelType} from '@mattermost/types/channels';

import {renderWithIntl} from 'tests/react_testing_utils';
import Constants from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ChannelSelect from './channel_select';

describe('components/ChannelSelect', () => {
    const defaultProps = {
        channels: [
            TestHelper.getChannelMock({
                id: 'id1',
                display_name: 'Channel 1',
                name: 'channel1',
                type: Constants.OPEN_CHANNEL as ChannelType,
            }),
            TestHelper.getChannelMock({
                id: 'id2',
                display_name: 'Channel 2',
                name: 'channel2',
                type: Constants.PRIVATE_CHANNEL as ChannelType,
            }),
            TestHelper.getChannelMock({
                id: 'id3',
                display_name: 'Channel 3',
                name: 'channel3',
                type: Constants.DM_CHANNEL as ChannelType,
            }),
        ],
        onChange: jest.fn(),
        value: 'testValue',
        selectOpen: false,
        selectPrivate: false,
        selectDm: false,
    };

    test('should render default placeholder text', () => {
        renderWithIntl(<ChannelSelect {...defaultProps}/>);

        const select = screen.getByRole('combobox');
        expect(select).toBeInTheDocument();
        expect(select).toHaveValue('testValue');
        
        const placeholder = screen.getByText('--- Select a channel ---');
        expect(placeholder).toBeInTheDocument();
        expect(placeholder.tagName.toLowerCase()).toBe('option');
        expect(placeholder.getAttribute('value')).toBe('');
    });

    test('should show open channels when selectOpen is true', () => {
        renderWithIntl(
            <ChannelSelect
                {...defaultProps}
                selectOpen={true}
            />,
        );

        expect(screen.getByText('Channel 1')).toBeInTheDocument();
        expect(screen.queryByText('Channel 2')).not.toBeInTheDocument();
        expect(screen.queryByText('Channel 3')).not.toBeInTheDocument();
    });

    test('should show private channels when selectPrivate is true', () => {
        renderWithIntl(
            <ChannelSelect
                {...defaultProps}
                selectPrivate={true}
            />,
        );

        expect(screen.queryByText('Channel 1')).not.toBeInTheDocument();
        expect(screen.getByText('Channel 2')).toBeInTheDocument();
        expect(screen.queryByText('Channel 3')).not.toBeInTheDocument();
    });

    test('should show DM channels when selectDm is true', () => {
        renderWithIntl(
            <ChannelSelect
                {...defaultProps}
                selectDm={true}
            />,
        );

        expect(screen.queryByText('Channel 1')).not.toBeInTheDocument();
        expect(screen.queryByText('Channel 2')).not.toBeInTheDocument();
        expect(screen.getByText('Channel 3')).toBeInTheDocument();
    });
});
