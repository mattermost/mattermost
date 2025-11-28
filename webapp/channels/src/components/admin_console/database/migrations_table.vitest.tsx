// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, screen, waitFor} from '@testing-library/react';
import React from 'react';
import {FormattedMessage} from 'react-intl';
import {describe, test, expect, vi} from 'vitest';

import type {SchemaMigration} from '@mattermost/types/admin';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import MigrationsTable from './migrations_table';

const migrationsMockData: SchemaMigration[] = [];

describe('components/MigrationsTable', () => {
    const createHelpText = (
        <FormattedMessage
            id='admin.database.migrations_table.help_text'
            defaultMessage='All applied migrations.'
        />
    );

    const baseProps = {
        createHelpText,
        className: '',
        actions: {
            getAppliedSchemaMigrations: (vi.fn()).mockResolvedValue({
                data: migrationsMockData,
            } as ActionResult),
        },
    };

    test('should match snapshot when there are no migrations', () => {
        const {container} = renderWithContext(
            <MigrationsTable
                {...baseProps}
            />);

        expect(container).toMatchSnapshot();
    });

    test('should have called actions.getAppliedSchemaMigrations only when first rendered', async () => {
        const mockMigrations = [
            {version: '1.0', name: 'Initial migration'},
            {version: '1.1', name: 'Add users table'},
        ];
        const withDataProps = {
            ...baseProps,
            actions: {
                getAppliedSchemaMigrations: (vi.fn()).mockResolvedValue({
                    data: mockMigrations,
                } as ActionResult),
            },
        };

        const view = renderWithContext(<MigrationsTable {...withDataProps}/>);

        await waitFor(() => {
            expect(withDataProps.actions.getAppliedSchemaMigrations).toHaveBeenCalledTimes(1);
        });

        act(() => {
            const newProps = {...withDataProps, className: 'foo'};
            view.rerender(<MigrationsTable {...newProps}/>);
        });

        await waitFor(() => {
            expect(withDataProps.actions.getAppliedSchemaMigrations).toHaveBeenCalledTimes(1);
            mockMigrations.forEach((migration) => {
                expect(screen.getByText(migration.version)).toBeInTheDocument();
                expect(screen.getByText(migration.name)).toBeInTheDocument();
            });
        });
    });
});
