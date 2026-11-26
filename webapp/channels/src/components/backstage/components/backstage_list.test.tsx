// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {JSX} from 'react';
import {FormattedMessage} from 'react-intl';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import BackstageList from './backstage_list';

describe('components/backstage/components/BackstageList', () => {
    const baseProps = {
        header: 'Things',
        loading: false,
        children: [] as JSX.Element[],
        emptyText: 'No things yet',
        emptyTextSearch: (
            <FormattedMessage
                id='backstage_list.test.noMatch'
                defaultMessage='No things match {searchTerm}'
                values={{searchTerm: ''}}
            />
        ),
    };

    it('shows the empty text with the illustration when there are no items', () => {
        renderWithContext(
            <BackstageList
                {...baseProps}
                emptyIllustration={<span data-testid='empty-illustration'/>}
            />,
        );

        expect(screen.getByText('No things yet')).toBeInTheDocument();
        expect(screen.getByTestId('empty-illustration')).toBeInTheDocument();
    });

    it('shows the empty text without an illustration when none is given', () => {
        renderWithContext(<BackstageList {...baseProps}/>);

        expect(screen.getByText('No things yet')).toBeInTheDocument();
        expect(screen.queryByTestId('empty-illustration')).not.toBeInTheDocument();
    });

    it('shows the search empty state with the illustration when a filter matches nothing', async () => {
        renderWithContext(
            <BackstageList
                {...baseProps}
                emptyIllustration={<span data-testid='empty-illustration'/>}
            />,
        );

        await userEvent.type(screen.getByRole('searchbox'), 'zzz');

        expect(screen.getByText('No things match zzz')).toBeInTheDocument();
        expect(screen.getByTestId('empty-illustration')).toBeInTheDocument();
    });
});
