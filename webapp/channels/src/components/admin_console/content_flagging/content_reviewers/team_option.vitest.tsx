// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {OptionProps} from 'react-select';
import {describe, it, expect, beforeEach, vi} from 'vitest';

import type {Team} from '@mattermost/types/teams';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';
import * as Utils from 'utils/utils';

import {TeamOptionComponent} from './team_option';

import type {AutocompleteOptionType} from '../user_multiselector/user_multiselector';

// Mock the utils module
vi.mock('utils/utils', () => ({
    imageURLForTeam: vi.fn(),
}));

// Mock the TeamIcon component
vi.mock('components/widgets/team_icon/team_icon', () => ({
    TeamIcon: ({content, size, url}: {content: string; size: string; url: string}) => (
        <div
            data-testid='team-icon'
            data-size={size}
            data-url={url}
        >
            {content}
        </div>
    ),
}));

describe('TeamOptionComponent', () => {
    const mockTeam: Team = {
        id: 'team-id-1',
        create_at: 1234567890,
        update_at: 1234567890,
        delete_at: 0,
        display_name: 'Test Team',
        name: 'test-team',
        description: 'A test team',
        email: 'test@example.com',
        type: 'O',
        company_name: '',
        allowed_domains: '',
        invite_id: '',
        allow_open_invite: true,
        scheme_id: '',
        group_constrained: false,
        policy_id: '',
    };

    const mockProps: OptionProps<AutocompleteOptionType<Team>, true> = {
        data: {
            raw: mockTeam,
            label: mockTeam.display_name,
            value: mockTeam.id,
        },
        innerProps: {
            onClick: vi.fn(),
            onMouseMove: vi.fn(),
            onMouseOver: vi.fn(),
        },
        isDisabled: false,
        isFocused: false,
        isSelected: false,
        innerRef: vi.fn(),
        selectProps: {} as any,
        getValue: vi.fn(),
        hasValue: false,
        getStyles: vi.fn(),
        selectOption: vi.fn(),
        setValue: vi.fn(),
        clearValue: vi.fn(),
        cx: vi.fn(),
        getClassNames: vi.fn(),
        theme: {} as any,
        isMulti: true,
        options: [],
    } as unknown as OptionProps<AutocompleteOptionType<Team>, true>;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(Utils.imageURLForTeam).mockReturnValue('http://example.com/team-icon.png');
    });

    it('should render team option with team icon and display name', () => {
        renderWithContext(<TeamOptionComponent {...mockProps}/>);

        expect(screen.queryAllByText('Test Team')).toHaveLength(2);
        expect(screen.getByTestId('team-icon')).toBeInTheDocument();
        expect(screen.getByTestId('team-icon')).toHaveAttribute('data-size', 'xsm');
        expect(screen.getByTestId('team-icon')).toHaveAttribute('data-url', 'http://example.com/team-icon.png');
        expect(screen.getByTestId('team-icon')).toHaveTextContent('Test Team');
    });

    it('should call imageURLForTeam with correct team data', () => {
        renderWithContext(<TeamOptionComponent {...mockProps}/>);

        expect(Utils.imageURLForTeam).toHaveBeenCalledWith(mockTeam);
        expect(Utils.imageURLForTeam).toHaveBeenCalledTimes(1);
    });

    it('should apply CSS class and inner props correctly', () => {
        renderWithContext(<TeamOptionComponent {...mockProps}/>);

        const container = screen.queryAllByText('Test Team')[0].closest('.TeamOptionComponent');
        expect(container).toBeInTheDocument();
        expect(container).toHaveClass('TeamOptionComponent');
    });

    it('should return null when data is null', () => {
        const propsWithNullData = {
            ...mockProps,
            data: null,
        } as unknown as OptionProps<AutocompleteOptionType<Team>, true>;

        const {container} = renderWithContext(<TeamOptionComponent {...propsWithNullData}/>);
        expect(container.firstChild).toBeNull();
    });

    it('should return null when data is undefined', () => {
        const propsWithUndefinedData = {
            ...mockProps,
            data: undefined,
        } as unknown as OptionProps<AutocompleteOptionType<Team>, true>;

        const {container} = renderWithContext(<TeamOptionComponent {...propsWithUndefinedData}/>);
        expect(container.firstChild).toBeNull();
    });

    it('should return null when data.raw is null', () => {
        const propsWithNullRaw = {
            ...mockProps,
            data: {
                raw: null,
                label: 'Test',
                value: 'test',
            },
        } as unknown as OptionProps<AutocompleteOptionType<Team>, true>;

        const {container} = renderWithContext(<TeamOptionComponent {...propsWithNullRaw}/>);
        expect(container.firstChild).toBeNull();
    });

    it('should return null when data.raw is undefined', () => {
        const propsWithUndefinedRaw = {
            ...mockProps,
            data: {
                raw: undefined,
                label: 'Test',
                value: 'test',
            },
        } as unknown as OptionProps<AutocompleteOptionType<Team>, true>;

        const {container} = renderWithContext(<TeamOptionComponent {...propsWithUndefinedRaw}/>);
        expect(container.firstChild).toBeNull();
    });

    it('should handle different team types', () => {
        const privateTeam = {
            ...mockTeam,
            type: 'P' as const,
            display_name: 'Private Team',
        };

        const propsWithPrivateTeam = {
            ...mockProps,
            data: {
                ...mockProps.data!,
                raw: privateTeam,
            },
        } as unknown as OptionProps<AutocompleteOptionType<Team>, true>;

        renderWithContext(<TeamOptionComponent {...propsWithPrivateTeam}/>);

        expect(screen.queryAllByText('Private Team')[0]).toBeInTheDocument();
        expect(Utils.imageURLForTeam).toHaveBeenCalledWith(privateTeam);
    });
});
