// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent, waitFor} from '@testing-library/react';
import React from 'react';

import type {TeamReviewerSetting} from '@mattermost/types/config';
import type {Team} from '@mattermost/types/teams';

import {searchTeams} from 'mattermost-redux/actions/teams';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import TeamReviewersSection from './team_reviewers_section';

jest.mock('mattermost-redux/actions/teams', () => ({
    searchTeams: jest.fn(),
}));

jest.mock('../../user_multiselector/user_multiselector', () => ({
    UserMultiSelector: ({id, initialValue, onChange}: {id: string; initialValue: string[]; onChange: (ids: string[]) => void}) => (
        <div data-testid={`user-multi-selector-${id}`}>
            <span>{`Selected: {${initialValue.join(', ')}`}</span>
            <button onClick={() => onChange(['user1', 'user2'])}>
                {'Change Reviewers'}
            </button>
        </div>
    ),
}));

jest.mock('components/widgets/team_icon/team_icon', () => ({
    TeamIcon: ({content}: {content: string}) => <div data-testid='team-icon'>{content}</div>,
}));

const mockSearchTeams = searchTeams as jest.MockedFunction<typeof searchTeams>;

describe('TeamReviewersSection', () => {
    const mockTeams: Team[] = [
        TestHelper.getTeamMock({
            id: 'team1',
            display_name: 'Team One',
            name: 'team-one',
        }),
        TestHelper.getTeamMock({
            id: 'team2',
            display_name: 'Team Two',
            name: 'team-two',
        }),
    ];

    const defaultProps = {
        teamReviewersSetting: {} as Record<string, TeamReviewerSetting>,
        onChange: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockSearchTeams.mockResolvedValue({
            data: {
                teams: mockTeams,
                total_count: 2,
            },
        } as never);
    });

    test('should render component with teams data', async () => {
        renderWithContext(<TeamReviewersSection {...defaultProps}/>, {}, {useMockedStore: true});

        await waitFor(() => {
            expect(mockSearchTeams).toHaveBeenCalledWith('', {page: 0, per_page: 10});
        });

        await waitFor(() => {
            expect(screen.getByText('Team One')).toBeInTheDocument();
            expect(screen.getByText('Team Two')).toBeInTheDocument();
        });

        expect(screen.getByText('Team')).toBeInTheDocument();
        expect(screen.getByText('Reviewers')).toBeInTheDocument();
        expect(screen.getByText('Enabled')).toBeInTheDocument();
    });

    test('should call searchTeams on component mount', async () => {
        renderWithContext(<TeamReviewersSection {...defaultProps}/>);

        await waitFor(() => {
            expect(mockSearchTeams).toHaveBeenCalledWith('', {page: 0, per_page: 10});
        });
    });

    test('should handle search functionality', async () => {
        renderWithContext(<TeamReviewersSection {...defaultProps}/>);

        await waitFor(() => {
            expect(mockSearchTeams).toHaveBeenCalledWith('', {page: 0, per_page: 10});
        });

        const searchInput = screen.getByRole('textbox');
        fireEvent.change(searchInput, {target: {value: 'search term'}});

        await waitFor(() => {
            expect(mockSearchTeams).toHaveBeenCalledWith('search term', {page: 0, per_page: 10});
        });
    });

    test('should handle pagination - next page', async () => {
        mockSearchTeams.mockResolvedValue({
            data: {
                teams: mockTeams,
                total_count: 20,
            },
        } as never);

        renderWithContext(<TeamReviewersSection {...defaultProps}/>);

        await waitFor(() => {
            expect(mockSearchTeams).toHaveBeenCalledWith('', {page: 0, per_page: 10});
        });

        await waitFor(() => {
            expect(screen.getByText('Team One')).toBeInTheDocument();
        });

        const nextButton = screen.getByRole('button', {name: /next/i});
        fireEvent.click(nextButton);

        await waitFor(() => {
            expect(mockSearchTeams).toHaveBeenCalledWith('', {page: 1, per_page: 10});
        });
    });

    test('should handle pagination - previous page', async () => {
        mockSearchTeams.mockResolvedValue({
            data: {
                teams: mockTeams,
                total_count: 20,
            },
        } as never);

        renderWithContext(<TeamReviewersSection {...defaultProps}/>);

        await waitFor(() => {
            expect(mockSearchTeams).toHaveBeenCalledWith('', {page: 0, per_page: 10});
        });

        // First go to next page
        await waitFor(() => {
            expect(screen.getByText('Team One')).toBeInTheDocument();
        });

        const nextButton = screen.getByRole('button', {name: /next/i});
        fireEvent.click(nextButton);

        await waitFor(() => {
            expect(mockSearchTeams).toHaveBeenCalledWith('', {page: 1, per_page: 10});
        });

        // Then go back to previous page
        const prevButton = screen.getByRole('button', {name: /previous/i});
        fireEvent.click(prevButton);

        await waitFor(() => {
            expect(mockSearchTeams).toHaveBeenCalledWith('', {page: 0, per_page: 10});
        });
    });

    test('should handle toggle functionality for enabling team reviewers', async () => {
        const onChange = jest.fn();
        renderWithContext(
            <TeamReviewersSection
                {...defaultProps}
                onChange={onChange}
            />,
        );

        await waitFor(() => {
            expect(mockSearchTeams).toHaveBeenCalledWith('', {page: 0, per_page: 10});
        });

        await waitFor(() => {
            expect(screen.getByText('Team One')).toBeInTheDocument();
        });

        const toggle = screen.getByRole('button', {name: /enable or disable content reviewers for this team/i});
        fireEvent.click(toggle);

        expect(onChange).toHaveBeenCalledWith({
            team1: {
                Enabled: true,
                ReviewerIds: [],
            },
        });
    });

    test('should handle toggle functionality with existing settings', async () => {
        const onChange = jest.fn();
        const teamReviewersSetting = {
            team1: {
                Enabled: true,
                ReviewerIds: ['user1'],
            },
        };

        renderWithContext(
            <TeamReviewersSection
                teamReviewersSetting={teamReviewersSetting}
                onChange={onChange}
            />,
        );

        await waitFor(() => {
            expect(mockSearchTeams).toHaveBeenCalledWith('', {page: 0, per_page: 10});
        });

        await waitFor(() => {
            expect(screen.getByText('Team One')).toBeInTheDocument();
        });

        const toggle = screen.getByRole('button', {name: /enable or disable content reviewers for this team/i});
        fireEvent.click(toggle);

        expect(onChange).toHaveBeenCalledWith({
            team1: {
                Enabled: false,
                ReviewerIds: ['user1'],
            },
        });
    });

    test('should handle reviewer selection changes', async () => {
        const onChange = jest.fn();
        renderWithContext(
            <TeamReviewersSection
                {...defaultProps}
                onChange={onChange}
            />,
        );

        await waitFor(() => {
            expect(mockSearchTeams).toHaveBeenCalledWith('', {page: 0, per_page: 10});
        });

        await waitFor(() => {
            expect(screen.getByText('Team One')).toBeInTheDocument();
        });

        const changeReviewersButton = screen.getByText('Change Reviewers');
        fireEvent.click(changeReviewersButton);

        expect(onChange).toHaveBeenCalledWith({
            team1: {
                Enabled: false,
                ReviewerIds: ['user1', 'user2'],
            },
        });
    });

    test('should display existing reviewer settings', async () => {
        const teamReviewersSetting = {
            team1: {
                Enabled: true,
                ReviewerIds: ['existing-user1', 'existing-user2'],
            },
        };

        renderWithContext(
            <TeamReviewersSection
                teamReviewersSetting={teamReviewersSetting}
                onChange={jest.fn()}
            />,
        );

        await waitFor(() => {
            expect(mockSearchTeams).toHaveBeenCalledWith('', {page: 0, per_page: 10});
        });

        await waitFor(() => {
            expect(screen.getByText('Selected: existing-user1, existing-user2')).toBeInTheDocument();
        });
    });

    test('should render disable all button', async () => {
        renderWithContext(<TeamReviewersSection {...defaultProps}/>);

        await waitFor(() => {
            expect(mockSearchTeams).toHaveBeenCalledWith('', {page: 0, per_page: 10});
        });

        await waitFor(() => {
            expect(screen.getByText('Disable for all teams')).toBeInTheDocument();
        });

        const disableAllButton = screen.getByRole('button', {name: /disable for all teams/i});
        expect(disableAllButton).toBeInTheDocument();
    });

    test('should handle API error gracefully', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        mockSearchTeams.mockRejectedValue(new Error('API Error'));

        renderWithContext(<TeamReviewersSection {...defaultProps}/>);

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith(new Error('API Error'));
        });

        consoleSpy.mockRestore();
    });

    test('should display correct pagination counts', async () => {
        mockSearchTeams.mockResolvedValue({
            data: {
                teams: mockTeams,
                total_count: 25,
            },
        } as never);

        renderWithContext(<TeamReviewersSection {...defaultProps}/>);

        await waitFor(() => {
            expect(mockSearchTeams).toHaveBeenCalledWith('', {page: 0, per_page: 10});
        });

        await waitFor(() => {
            expect(screen.getByText(/1.*10.*25/)).toBeInTheDocument();
        });
    });

    test('should reset page to 0 when searching', async () => {
        mockSearchTeams.
            mockResolvedValueOnce({
                data: {teams: mockTeams, total_count: 20},
            } as never).
            mockResolvedValueOnce({
                data: {teams: mockTeams, total_count: 20},
            } as never).
            mockResolvedValueOnce({
                data: {teams: mockTeams, total_count: 5},
            } as never);

        renderWithContext(<TeamReviewersSection {...defaultProps}/>);

        // Wait for initial load
        await waitFor(() => {
            expect(mockSearchTeams).toHaveBeenCalledWith('', {page: 0, per_page: 10});
        });

        await waitFor(() => {
            expect(screen.getByText('Team One')).toBeInTheDocument();
        });

        // Go to next page
        const nextButton = screen.getByRole('button', {name: /next/i});
        fireEvent.click(nextButton);

        await waitFor(() => {
            expect(mockSearchTeams).toHaveBeenCalledWith('', {page: 1, per_page: 10});
        });

        // Search - should reset to page 0
        const searchInput = screen.getByRole('textbox');
        fireEvent.change(searchInput, {target: {value: 'search'}});

        await waitFor(() => {
            expect(mockSearchTeams).toHaveBeenCalledWith('search', {page: 0, per_page: 10});
        });
    });

    test('should handle empty teams response', async () => {
        mockSearchTeams.mockResolvedValue({
            data: {
                teams: [],
                total_count: 0,
            },
        } as never);

        renderWithContext(<TeamReviewersSection {...defaultProps}/>);

        await waitFor(() => {
            expect(mockSearchTeams).toHaveBeenCalledWith('', {page: 0, per_page: 10});
        });

        // Should not crash and should still render headers
        expect(screen.getByText('Team')).toBeInTheDocument();
        expect(screen.getByText('Reviewers')).toBeInTheDocument();
        expect(screen.getByText('Enabled')).toBeInTheDocument();
    });

    test('should handle multiple toggle clicks correctly', async () => {
        const onChange = jest.fn();
        renderWithContext(
            <TeamReviewersSection
                {...defaultProps}
                onChange={onChange}
            />,
        );

        await waitFor(() => {
            expect(mockSearchTeams).toHaveBeenCalledWith('', {page: 0, per_page: 10});
        });

        await waitFor(() => {
            expect(screen.getByText('Team One')).toBeInTheDocument();
        });

        const toggle = screen.getByRole('button', {name: /enable or disable content reviewers for this team/i});

        // First click - enable
        fireEvent.click(toggle);
        expect(onChange).toHaveBeenCalledWith({
            team1: {
                Enabled: true,
                ReviewerIds: [],
            },
        });

        // Update props to simulate state change
        const updatedProps = {
            teamReviewersSetting: {
                team1: {
                    Enabled: true,
                    ReviewerIds: [],
                },
            },
            onChange,
        };

        renderWithContext(<TeamReviewersSection {...updatedProps}/>);

        await waitFor(() => {
            expect(mockSearchTeams).toHaveBeenCalledWith('', {page: 0, per_page: 10});
        });

        await waitFor(() => {
            expect(screen.getByText('Team One')).toBeInTheDocument();
        });

        const updatedToggle = screen.getByRole('button', {name: /enable or disable content reviewers for this team/i});

        // Second click - disable
        fireEvent.click(updatedToggle);
        expect(onChange).toHaveBeenCalledWith({
            team1: {
                Enabled: false,
                ReviewerIds: [],
            },
        });
    });
});
