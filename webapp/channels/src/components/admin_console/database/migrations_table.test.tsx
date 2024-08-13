// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {RenderResult} from '@testing-library/react';
import {act, render, screen, waitFor} from '@testing-library/react';
import {shallow} from 'enzyme';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {SchemaMigration} from '@mattermost/types/admin';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {withIntl} from 'tests/helpers/intl-test-helper';

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
            getAppliedSchemaMigrations: (jest.fn()).mockResolvedValue({
                data: migrationsMockData,
            } as ActionResult),
        },
    };

    test('should match snapshot when there are no migrations', () => {
        const wrapper = shallow(
            <MigrationsTable
                {...baseProps}
            />);

        expect(wrapper).toMatchSnapshot();
    });

    test('should have called actions.getAppliedSchemaMigrations only when first rendered', async () => {
        let view: RenderResult;

        const mockMigrations = [
            {version: '1.0', name: 'Initial migration'},
            {version: '1.1', name: 'Add users table'},
        ];
        const withDataProps = {
            ...baseProps,
            actions: {
                getAppliedSchemaMigrations: (jest.fn()).mockResolvedValue({
                    data: mockMigrations,
                } as ActionResult),
            },
        };

        act(() => {
            view = render(withIntl(<MigrationsTable {...withDataProps}/>));
        });

        await waitFor(() => {
            expect(withDataProps.actions.getAppliedSchemaMigrations).toHaveBeenCalledTimes(1);
        });

        act(() => {
            const newProps = {...withDataProps, className: 'foo'};
            view.rerender(withIntl(<MigrationsTable {...newProps}/>));
        });

        await waitFor(() => {
            expect(withDataProps.actions.getAppliedSchemaMigrations).toHaveBeenCalledTimes(1);
            mockMigrations.forEach((migration) => {
                expect(screen.getByText(migration.version)).toBeInTheDocument();
                expect(screen.getByText(migration.name)).toBeInTheDocument();
            });
        });
    });

    // test('should match snapshot when no audits exist', () => {
    //     const wrapper = shallow(
    //         <AccessHistoryModal {...baseProps} />,
    //     );
    //     expect(wrapper).toMatchSnapshot();
    //     expect(wrapper.find(LoadingScreen).exists()).toBe(true);
    //     expect(wrapper.find(AuditTable).exists()).toBe(false);
    // });

    // test('should match snapshot when audits exist', () => {
    //     const wrapper = shallow(
    //         <AccessHistoryModal {...baseProps} />,
    //     );

    //     wrapper.setProps({ userAudits: ['audit1', 'audit2'] });
    //     expect(wrapper).toMatchSnapshot();
    //     expect(wrapper.find(LoadingScreen).exists()).toBe(false);
    //     expect(wrapper.find(AuditTable).exists()).toBe(true);
    // });

    // test('should have called actions.getUserAudits only when first rendered', () => {
    //     const actions = {
    //         getUserAudits: jest.fn(),
    //     };
    //     const props = { ...baseProps, actions };
    //     const view = render(withIntl(<AccessHistoryModal {...props} />));

    //     expect(actions.getUserAudits).toHaveBeenCalledTimes(1);
    //     const newProps = { ...props, currentUserId: 'foo' };
    //     view.rerender(withIntl(<AccessHistoryModal {...newProps} />));
    //     expect(actions.getUserAudits).toHaveBeenCalledTimes(1);
    // });

    // test('should hide', async () => {
    //     render(withIntl(<AccessHistoryModal {...baseProps} />));
    //     await waitFor(() => screen.getByText('Access History'));
    //     fireEvent.click(screen.getByLabelText('Close'));
    //     await waitForElementToBeRemoved(() => screen.getByText('Access History'));
    // });
});
