// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PolicySimulationActionDecision} from '@mattermost/types/access_control';
import {POLICY_SIMULATION_BLAME_SOURCES} from '@mattermost/types/access_control';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import DecisionChip from './decision_chip';

describe('DecisionChip divergence state', () => {
    const divergedAllow: PolicySimulationActionDecision = {
        decision: true,
        blame: [{source: POLICY_SIMULATION_BLAME_SOURCES.DIVERGENCE, outcome: 'deny'}],
    };

    test('a simulated allow that production denies renders the divergence chip, not a green allow', () => {
        renderWithContext(<DecisionChip decision={divergedAllow}/>);

        expect(screen.getByTestId('simulate-access-row-chip-diverged')).toBeInTheDocument();
        expect(screen.queryByTestId('simulate-access-row-chip-allow')).not.toBeInTheDocument();
        expect(screen.getByText("doesn't match enforcement")).toBeInTheDocument();
    });

    test('a simulated deny that production allows renders the divergence chip, not a red deny', () => {
        renderWithContext(
            <DecisionChip
                decision={{
                    decision: false,
                    blame: [{source: POLICY_SIMULATION_BLAME_SOURCES.DIVERGENCE, outcome: 'allow'}],
                }}
            />,
        );

        expect(screen.getByTestId('simulate-access-row-chip-diverged')).toBeInTheDocument();
        expect(screen.queryByTestId('simulate-access-row-chip-deny')).not.toBeInTheDocument();
    });

    test('the tooltip names the verdict enforcement would actually produce', () => {
        renderWithContext(<DecisionChip decision={divergedAllow}/>);

        expect(screen.getByTestId('simulate-access-row-chip-diverged')).toHaveAttribute(
            'title',
            'Simulation and enforcement disagree for this user. Enforcement would deny access.',
        );
    });

    test('divergence takes precedence over the synthetic not-applicable markers', () => {
        renderWithContext(
            <DecisionChip
                decision={{
                    decision: true,
                    blame: [
                        {source: POLICY_SIMULATION_BLAME_SOURCES.NO_APPLICABLE_POLICY},
                        {source: POLICY_SIMULATION_BLAME_SOURCES.DIVERGENCE, outcome: 'deny'},
                    ],
                }}
            />,
        );

        expect(screen.getByTestId('simulate-access-row-chip-diverged')).toBeInTheDocument();
        expect(screen.queryByTestId('simulate-access-row-chip-not-applicable')).not.toBeInTheDocument();
    });

    test('a pending row still shows the spinner state', () => {
        renderWithContext(
            <DecisionChip
                decision={divergedAllow}
                pending={true}
            />,
        );

        expect(screen.getByTestId('simulate-access-row-chip-pending')).toBeInTheDocument();
    });

    test('decisions without divergence blame are unaffected', () => {
        renderWithContext(<DecisionChip decision={{decision: true}}/>);
        expect(screen.getByTestId('simulate-access-row-chip-allow')).toBeInTheDocument();

        renderWithContext(<DecisionChip decision={{decision: false}}/>);
        expect(screen.getByTestId('simulate-access-row-chip-deny')).toBeInTheDocument();
    });
});
