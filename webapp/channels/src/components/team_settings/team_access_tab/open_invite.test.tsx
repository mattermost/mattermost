// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type ComponentProps} from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import OpenInvite from './open_invite';

describe('components/TeamSettings/OpenInvite', () => {
    const onChange = jest.fn();
    const defaultProps: ComponentProps<typeof OpenInvite> = {
        isPublic: false,
        isGroupConstrained: false,
        policyEnforced: false,
        onChange,
    };

    beforeEach(() => jest.clearAllMocks());

    test('renders group-constrained notice when team is group-constrained', () => {
        renderWithContext(
            <OpenInvite
                {...defaultProps}
                isGroupConstrained={true}
            />,
        );
        expect(screen.getByText(/members of this team are added and removed by linked groups/i)).toBeInTheDocument();
        expect(screen.getByText('Learn More')).toBeInTheDocument();
    });

    test('renders Public and Private option buttons when not group-constrained', () => {
        renderWithContext(<OpenInvite {...defaultProps}/>);
        expect(screen.getByText('Public Team')).toBeInTheDocument();
        expect(screen.getByText('Private Team')).toBeInTheDocument();
    });

    test('calls onChange(true) when Public Team card is clicked while private', async () => {
        renderWithContext(
            <OpenInvite
                {...defaultProps}
                isPublic={false}
            />,
        );
        await userEvent.click(screen.getByText('Public Team'));
        expect(onChange).toHaveBeenCalledWith(true);
    });

    test('calls onChange(false) when Private Team card is clicked while public', async () => {
        renderWithContext(
            <OpenInvite
                {...defaultProps}
                isPublic={true}
            />,
        );
        await userEvent.click(screen.getByText('Private Team'));
        expect(onChange).toHaveBeenCalledWith(false);
    });

    test('shows policy-enforced notice and disables cards when policyEnforced and policyIsActive are true on a public team', () => {
        renderWithContext(
            <OpenInvite
                {...defaultProps}
                isPublic={true}
                policyEnforced={true}
                policyIsActive={true}
            />,
        );
        expect(screen.getByText(/membership is managed by a policy/i)).toBeInTheDocument();
        const publicBtn = screen.getByRole('button', {name: /public team/i});
        const privateBtn = screen.getByRole('button', {name: /private team/i});
        expect(publicBtn.className).toMatch(/disabled/);
        expect(privateBtn.className).toMatch(/disabled/);
    });

    test('does not disable cards when policyEnforced but policyIsActive is false', async () => {
        renderWithContext(
            <OpenInvite
                {...defaultProps}
                isPublic={true}
                policyEnforced={true}
                policyIsActive={false}
            />,
        );
        expect(screen.queryByText(/membership is managed by a policy/i)).not.toBeInTheDocument();
        await userEvent.click(screen.getByText('Private Team'));
        expect(onChange).toHaveBeenCalledWith(false);
    });

    test('does not disable cards on a private team even when policyIsActive is true', async () => {
        renderWithContext(
            <OpenInvite
                {...defaultProps}
                isPublic={false}
                policyEnforced={true}
                policyIsActive={true}
            />,
        );
        await userEvent.click(screen.getByText('Public Team'));
        expect(onChange).toHaveBeenCalledWith(true);
    });
});
