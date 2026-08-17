// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {fakeDate} from 'tests/helpers/date';
import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import PostEditedIndicator from './post_edited_indicator';

const NOW = new Date('2020-06-15T18:00:00.000Z');

describe('PostEditedIndicator', () => {
    let resetFakeDate: () => void;

    beforeEach(() => {
        resetFakeDate = fakeDate(NOW);
    });

    afterEach(() => {
        resetFakeDate();
    });

    const baseProps = {
        postId: 'post_id',
        postOwner: false,
        canEdit: false,
        post: undefined,
        actions: {openShowEditHistory: jest.fn()},
    };

    function renderAt(editedAt: string) {
        return renderWithContext(
            <PostEditedIndicator
                {...baseProps}
                editedAt={new Date(editedAt).getTime()}
            />,
        );
    }

    test('renders nothing when the post was never edited', () => {
        const {container} = renderWithContext(
            <PostEditedIndicator
                {...baseProps}
                editedAt={0}
            />,
        );

        expect(container).toBeEmptyDOMElement();
    });

    test('renders nothing without a postId', () => {
        const {container} = renderWithContext(
            <PostEditedIndicator
                {...baseProps}
                postId={undefined}
                editedAt={NOW.getTime()}
            />,
        );

        expect(container).toBeEmptyDOMElement();
    });

    test('renders the Edited indicator', () => {
        renderAt('2020-06-15T16:32:00.000Z');

        expect(screen.getByText('Edited')).toBeInTheDocument();
    });

    test.each([
        ['today', '2020-06-15T16:32:00.000Z', 'Edited today at 4:32 PM'],
        ['yesterday', '2020-06-14T16:32:00.000Z', 'Edited yesterday at 4:32 PM'],
        ['within the last week', '2020-06-11T16:32:00.000Z', 'Edited Thursday at 4:32 PM'],
        ['earlier this year', '2020-02-11T16:32:00.000Z', 'Edited February 11 at 4:32 PM'],
    ])('tooltip describes an edit %s', async (_label, editedAt, expected) => {
        const user = userEvent.setup();

        renderAt(editedAt);

        await user.hover(screen.getByText('Edited'));

        expect(await screen.findByRole('tooltip')).toHaveTextContent(expected);
    });

    test('tooltip offers edit history to the post owner', async () => {
        const user = userEvent.setup();

        renderWithContext(
            <PostEditedIndicator
                {...baseProps}
                postOwner={true}
                canEdit={true}
                editedAt={new Date('2020-06-15T16:32:00.000Z').getTime()}
            />,
        );

        await user.hover(screen.getByRole('button', {name: 'Edited'}));

        expect(await screen.findByRole('tooltip')).toHaveTextContent('Click to view history');
    });
});
