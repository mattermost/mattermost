// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import CELHelpModal from './cel_help_modal';

describe('CELHelpModal', () => {
    // This modal is where an admin learns how to name the accessed channel in
    // CEL, so its examples have to spell it the way the engine does.
    test('documents channel attributes as channel.attributes.*', () => {
        renderWithContext(<CELHelpModal onExited={jest.fn()}/>);

        expect(screen.getByText(/user\.attributes\.Clearance >= channel\.attributes\.MinClearance/)).toBeInTheDocument();
        expect(screen.getByText(/user\.attributes\.Programs\.hasAnyOf\(channel\.attributes\.Programs\)/)).toBeInTheDocument();
        expect(screen.getByText(/refers to the channel being accessed/)).toHaveTextContent('channel.attributes.*');
        expect(screen.queryByText(/resource\.attributes/)).not.toBeInTheDocument();
    });
});
