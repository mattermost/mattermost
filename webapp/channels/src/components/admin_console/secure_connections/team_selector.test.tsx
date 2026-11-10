// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Team} from '@mattermost/types/teams';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import TeamSelector from './team_selector';

let mockLastDropdownProps: any;

jest.mock('components/dropdown_input', () => {
    return function MockDropdownInput(props: any) {
        mockLastDropdownProps = props;
        return (
            <div
                data-testid={props.testId}
                data-name={props.name}
                data-legend={props.legend}
                data-value={props.value ? JSON.stringify(props.value) : ''}
                data-options={JSON.stringify(props.options)}
            />
        );
    };
});

const teamA: Team = TestHelper.getTeamMock({id: 'team-a', display_name: 'Charlie'});
const teamB: Team = TestHelper.getTeamMock({id: 'team-b', display_name: 'Alpha'});
const teamC: Team = TestHelper.getTeamMock({id: 'team-c', display_name: 'Bravo'});

const teamsById: IDMappedObjects<Team> = {
    [teamA.id]: teamA,
    [teamB.id]: teamB,
    [teamC.id]: teamC,
};

describe('TeamSelector', () => {
    beforeEach(() => {
        mockLastDropdownProps = undefined;
    });

    it('passes teams sorted by display_name as DropdownInput options', () => {
        renderWithContext(
            <TeamSelector
                value=''
                teamsById={teamsById}
                onChange={jest.fn()}
                testId='destination-team'
            />,
        );

        expect(mockLastDropdownProps.options).toEqual([
            {value: teamB.id, label: 'Alpha'},
            {value: teamC.id, label: 'Bravo'},
            {value: teamA.id, label: 'Charlie'},
        ]);
    });

    it('passes the matching team as the current value', () => {
        renderWithContext(
            <TeamSelector
                value={teamA.id}
                teamsById={teamsById}
                onChange={jest.fn()}
                testId='destination-team'
            />,
        );

        expect(mockLastDropdownProps.value).toEqual({label: 'Charlie', value: teamA.id});
    });

    it('passes undefined as value when the id does not match a team', () => {
        renderWithContext(
            <TeamSelector
                value='unknown-team-id'
                teamsById={teamsById}
                onChange={jest.fn()}
                testId='destination-team'
            />,
        );

        expect(mockLastDropdownProps.value).toBeUndefined();
    });

    it('forwards the legend, testId, and required flag', () => {
        renderWithContext(
            <TeamSelector
                value=''
                teamsById={teamsById}
                onChange={jest.fn()}
                testId='destination-team'
                legend='Pick a team'
            />,
        );

        expect(mockLastDropdownProps.testId).toBe('destination-team');
        expect(mockLastDropdownProps.legend).toBe('Pick a team');
        expect(mockLastDropdownProps.required).toBe(true);
        expect(mockLastDropdownProps.name).toBe('team_selector');
    });

    it('invokes onChange with the chosen team id', () => {
        const onChange = jest.fn();

        renderWithContext(
            <TeamSelector
                value=''
                teamsById={teamsById}
                onChange={onChange}
                testId='destination-team'
            />,
        );

        mockLastDropdownProps.onChange({value: teamC.id, label: 'Bravo'});

        expect(onChange).toHaveBeenCalledWith(teamC.id);
    });
});
