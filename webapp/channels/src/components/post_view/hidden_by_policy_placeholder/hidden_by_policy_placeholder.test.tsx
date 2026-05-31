// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import HiddenByPolicyPlaceholder from './hidden_by_policy_placeholder';

describe('HiddenByPolicyPlaceholder', () => {
    it('renders the muted placeholder text and the lock icon container', () => {
        renderWithContext(
            <HiddenByPolicyPlaceholder postId='post123'/>,
        );

        expect(screen.getByTestId('hidden-by-policy-post123')).toBeInTheDocument();
        expect(screen.getByText('Hidden by policy')).toBeInTheDocument();
    });

    it('exposes an accessible label so screen readers explain the empty body', () => {
        renderWithContext(
            <HiddenByPolicyPlaceholder postId='post123'/>,
        );

        expect(
            screen.getByLabelText('This message is hidden by a channel policy.'),
        ).toBeInTheDocument();
    });

    it('is non-interactive (no button, no reveal action)', () => {
        renderWithContext(
            <HiddenByPolicyPlaceholder postId='post123'/>,
        );

        // The BurnOnRead placeholder is a <button>; this one is a <div role="note">.
        // Server enforces the policy on every fetch, so there's no client-side reveal.
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(screen.getByRole('note')).toBeInTheDocument();
    });
});
