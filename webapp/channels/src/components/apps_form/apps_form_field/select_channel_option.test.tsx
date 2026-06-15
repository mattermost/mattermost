// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {OptionProps} from 'react-select';

import type {Channel} from '@mattermost/types/channels';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {SelectChannelOption} from './select_channel_option';

// Minimal mock of react-select Option props
function makeOptionProps(channel: Channel): OptionProps<Channel> {
    return {
        data: channel,
        getValue: () => [],
        hasValue: false,
        isDisabled: false,
        isFocused: false,
        isMulti: false,
        isRtl: false,
        isSelected: false,
        label: channel.display_name,
        options: [],
        selectOption: jest.fn(),
        setValue: jest.fn(),
        type: 'option',
        innerProps: {},
        innerRef: () => {},
        cx: () => '',
        clearValue: jest.fn(),
        getClassNames: () => '',
        getStyles: () => ({}),
        isOptionDisabled: jest.fn().mockReturnValue(false),
        isOptionSelected: jest.fn().mockReturnValue(false),
        selectProps: {} as any,
        theme: {} as any,
        children: null,
    } as unknown as OptionProps<Channel>;
}

describe('SelectChannelOption', () => {
    const overrideState = (overrides: any[]) => ({
        plugins: {components: {ChannelIconOverride: overrides}},
    } as any);

    it('renders fallback globe icon for open channel when matcher returns false', () => {
        const channel = TestHelper.getChannelMock({id: 'ch-1', type: 'O', delete_at: 0});

        const {container} = renderWithContext(
            <SelectChannelOption {...makeOptionProps(channel)}/>,
            overrideState([{id: '1', pluginId: 'p', matcher: () => false, iconName: 'shield-outline'}]),
        );

        const icon = container.querySelector('.select-option-icon i');
        expect(icon).toBeInTheDocument();
        expect(icon).toHaveClass('icon-globe');
        expect(icon).not.toHaveClass('icon-shield-outline');
    });

    it('renders override icon-shield-outline when matcher matches', () => {
        const channel = TestHelper.getChannelMock({id: 'ch-1', type: 'O', delete_at: 0});

        const {container} = renderWithContext(
            <SelectChannelOption {...makeOptionProps(channel)}/>,
            overrideState([{id: '1', pluginId: 'p', matcher: () => true, iconName: 'shield-outline'}]),
        );

        const icon = container.querySelector('.select-option-icon i');
        expect(icon).toBeInTheDocument();
        expect(icon).toHaveClass('icon-shield-outline');
        expect(icon).not.toHaveClass('icon-globe');
    });

    it('renders lock icon for private channel when no override', () => {
        const channel = TestHelper.getChannelMock({id: 'ch-1', type: 'P', delete_at: 0});

        const {container} = renderWithContext(
            <SelectChannelOption {...makeOptionProps(channel)}/>,
            overrideState([]),
        );

        const icon = container.querySelector('.select-option-icon i');
        expect(icon).toBeInTheDocument();
        expect(icon).toHaveClass('icon-lock-outline');
    });
});
