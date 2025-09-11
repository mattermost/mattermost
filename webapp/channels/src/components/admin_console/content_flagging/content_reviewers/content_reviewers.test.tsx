// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent} from '@testing-library/react';
import React from 'react';

import type {ContentFlaggingReviewerSetting, TeamReviewerSetting} from '@mattermost/types/config';

import type {SystemConsoleCustomSettingsComponentProps} from 'components/admin_console/schema_admin_settings';

import {renderWithContext} from 'tests/react_testing_utils';

import ContentFlaggingContentReviewers from './content_reviewers';

// Mock the UserMultiSelector component
jest.mock('../../content_flagging/user_multiselector/user_multiselector', () => ({
    __esModule: true,
    UserSelector: ({id, multiSelectInitialValue, multiSelectOnChange}: {id: string; multiSelectInitialValue: string[]; multiSelectOnChange: (userIds: string[]) => void}) => (
        <div data-testid={`user-multi-selector-${id}`}>
            <button
                onClick={() => multiSelectOnChange(['user1', 'user2'])}
                data-testid={`${id}-change-users`}
            >
                {'Change Users'}
            </button>
            <span data-testid={`${id}-initial-value`}>{multiSelectInitialValue.join(',')}</span>
        </div>
    ),
}));

// Mock the TeamReviewers component
jest.mock('./team_reviewers_section/team_reviewers_section', () => ({
    __esModule: true,
    default: ({teamReviewersSetting, onChange}: {teamReviewersSetting: Record<string, TeamReviewerSetting>; onChange: (settings: Record<string, TeamReviewerSetting>) => void}) => (
        <div data-testid='team-reviewers'>
            <button
                onClick={() => onChange({team1: {Enabled: true, ReviewerIds: ['user3']}})}
                data-testid='team-reviewers-change'
            >
                {'Change Team Reviewers'}
            </button>
            <span data-testid='team-reviewers-setting'>{JSON.stringify(teamReviewersSetting)}</span>
        </div>
    ),
}));

describe('ContentFlaggingContentReviewers', () => {
    const defaultProps = {
        id: 'content_reviewers',
        value: {
            CommonReviewers: true,
            CommonReviewerIds: ['user1'],
            SystemAdminsAsReviewers: false,
            TeamAdminsAsReviewers: false,
            TeamReviewersSetting: {},
        } as ContentFlaggingReviewerSetting,
        onChange: jest.fn(),
        disabled: false,
        setByEnv: false,
    } as unknown as SystemConsoleCustomSettingsComponentProps;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the component with correct title and description', () => {
        renderWithContext(<ContentFlaggingContentReviewers {...defaultProps}/>);

        expect(screen.getByText('Content Reviewers')).toBeInTheDocument();
        expect(screen.getByText('Define who should review content in your environment')).toBeInTheDocument();
    });

    it('renders radio buttons for same reviewers for all teams setting', () => {
        renderWithContext(<ContentFlaggingContentReviewers {...defaultProps}/>);

        expect(screen.getByText('Same reviewers for all teams:')).toBeInTheDocument();
        expect(screen.getByTestId('sameReviewersForAllTeams_true')).toBeInTheDocument();
        expect(screen.getByTestId('sameReviewersForAllTeams_false')).toBeInTheDocument();
    });

    it('shows common reviewers section when CommonReviewers is true', () => {
        renderWithContext(<ContentFlaggingContentReviewers {...defaultProps}/>);

        expect(screen.getByText('Reviewers:')).toBeInTheDocument();
        expect(screen.getByTestId('user-multi-selector-content_reviewers_common_reviewers')).toBeInTheDocument();
        expect(screen.queryByTestId('team-reviewers')).not.toBeInTheDocument();
    });

    it('shows team-specific reviewers section when CommonReviewers is false', () => {
        const props = {
            ...defaultProps,
            value: {
                ...(defaultProps.value as ContentFlaggingReviewerSetting),
                CommonReviewers: false,
            },
        };

        renderWithContext(<ContentFlaggingContentReviewers {...props}/>);

        expect(screen.getByText('Configure content flagging per team')).toBeInTheDocument();
        expect(screen.getByTestId('team-reviewers')).toBeInTheDocument();
        expect(screen.queryByText('Reviewers:')).not.toBeInTheDocument();
    });

    it('renders additional reviewers checkboxes', () => {
        renderWithContext(<ContentFlaggingContentReviewers {...defaultProps}/>);

        expect(screen.getByText('Additional reviewers')).toBeInTheDocument();
        expect(screen.getByText('System Administrators')).toBeInTheDocument();
        expect(screen.getByText('Team Administrators')).toBeInTheDocument();
    });

    it('handles same reviewers for all teams radio button change to true', () => {
        const props = {
            ...defaultProps,
            value: {
                ...(defaultProps.value as ContentFlaggingReviewerSetting),
                CommonReviewers: false,
            },
        };

        renderWithContext(<ContentFlaggingContentReviewers {...props}/>);

        const trueRadio = screen.getByTestId('sameReviewersForAllTeams_true');
        fireEvent.click(trueRadio);

        expect(defaultProps.onChange).toHaveBeenCalledWith('content_reviewers', {
            ...props.value,
            CommonReviewers: true,
        });
    });

    it('handles same reviewers for all teams radio button change to false', () => {
        renderWithContext(<ContentFlaggingContentReviewers {...defaultProps}/>);

        const falseRadio = screen.getByTestId('sameReviewersForAllTeams_false');
        fireEvent.click(falseRadio);

        expect(defaultProps.onChange).toHaveBeenCalledWith('content_reviewers', {
            ...(defaultProps.value as ContentFlaggingReviewerSetting),
            CommonReviewers: false,
        });
    });

    it('handles system admin reviewer checkbox change', () => {
        renderWithContext(<ContentFlaggingContentReviewers {...defaultProps}/>);

        const systemAdminCheckbox = screen.getByRole('checkbox', {name: /system administrators/i});
        fireEvent.click(systemAdminCheckbox);

        expect(defaultProps.onChange).toHaveBeenCalledWith('content_reviewers', {
            ...(defaultProps.value as ContentFlaggingReviewerSetting),
            SystemAdminsAsReviewers: true,
        });
    });

    it('handles team admin reviewer checkbox change', () => {
        renderWithContext(<ContentFlaggingContentReviewers {...defaultProps}/>);

        const teamAdminCheckbox = screen.getByRole('checkbox', {name: /team administrators/i});
        fireEvent.click(teamAdminCheckbox);

        expect(defaultProps.onChange).toHaveBeenCalledWith('content_reviewers', {
            ...(defaultProps.value as ContentFlaggingReviewerSetting),
            TeamAdminsAsReviewers: true,
        });
    });

    it('handles common reviewers change', () => {
        renderWithContext(<ContentFlaggingContentReviewers {...defaultProps}/>);

        const changeUsersButton = screen.getByTestId('content_reviewers_common_reviewers-change-users');
        fireEvent.click(changeUsersButton);

        expect(defaultProps.onChange).toHaveBeenCalledWith('content_reviewers', {
            ...(defaultProps.value as ContentFlaggingReviewerSetting),
            CommonReviewerIds: ['user1', 'user2'],
        });
    });

    it('handles team reviewer settings change', () => {
        const props = {
            ...defaultProps,
            value: {
                ...(defaultProps.value as ContentFlaggingReviewerSetting),
                CommonReviewers: false,
            },
        };

        renderWithContext(<ContentFlaggingContentReviewers {...props}/>);

        const changeTeamReviewersButton = screen.getByTestId('team-reviewers-change');
        fireEvent.click(changeTeamReviewersButton);

        expect(defaultProps.onChange).toHaveBeenCalledWith('content_reviewers', {
            ...props.value,
            TeamReviewersSetting: {team1: {Enabled: true, ReviewerIds: ['user3']}},
        });
    });

    it('passes correct initial values to UserMultiSelector', () => {
        const props = {
            ...defaultProps,
            value: {
                ...(defaultProps.value as ContentFlaggingReviewerSetting),
                CommonReviewerIds: ['user1', 'user2', 'user3'],
            },
        };

        renderWithContext(<ContentFlaggingContentReviewers {...props}/>);

        const initialValueSpan = screen.getByTestId('content_reviewers_common_reviewers-initial-value');
        expect(initialValueSpan).toHaveTextContent('user1,user2,user3');
    });

    it('passes correct team reviewer settings to TeamReviewers component', () => {
        const teamReviewersSetting = {
            team1: {ReviewerIds: ['user1']},
            team2: {ReviewerIds: ['user2']},
        };

        const props = {
            ...defaultProps,
            value: {
                ...(defaultProps.value as ContentFlaggingReviewerSetting),
                CommonReviewers: false,
                TeamReviewersSetting: teamReviewersSetting,
            },
        };

        renderWithContext(<ContentFlaggingContentReviewers {...props}/>);

        const teamReviewersSettingSpan = screen.getByTestId('team-reviewers-setting');
        expect(teamReviewersSettingSpan).toHaveTextContent(JSON.stringify(teamReviewersSetting));
    });

    it('renders help text for additional reviewers', () => {
        renderWithContext(<ContentFlaggingContentReviewers {...defaultProps}/>);

        expect(screen.getByText(/If enabled, system administrators will be sent flagged posts/)).toBeInTheDocument();
    });

    it('correctly sets radio button checked states', () => {
        renderWithContext(<ContentFlaggingContentReviewers {...defaultProps}/>);

        const trueRadio = screen.getByTestId('sameReviewersForAllTeams_true') as HTMLInputElement;
        const falseRadio = screen.getByTestId('sameReviewersForAllTeams_false') as HTMLInputElement;

        expect(trueRadio.checked).toBe(true);
        expect(falseRadio.checked).toBe(false);
    });

    it('correctly sets radio button checked states when CommonReviewers is false', () => {
        const props = {
            ...defaultProps,
            value: {
                ...(defaultProps.value as ContentFlaggingReviewerSetting),
                CommonReviewers: false,
            },
        };

        renderWithContext(<ContentFlaggingContentReviewers {...props}/>);

        const trueRadio = screen.getByTestId('sameReviewersForAllTeams_true') as HTMLInputElement;
        const falseRadio = screen.getByTestId('sameReviewersForAllTeams_false') as HTMLInputElement;

        expect(trueRadio.checked).toBe(false);
        expect(falseRadio.checked).toBe(true);
    });
});
