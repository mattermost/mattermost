// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {NameMappedPropertyFields, PropertyField, PropertyValue} from '@mattermost/types/properties';

import {renderWithContext} from 'tests/react_testing_utils';

import PropertiesCardView from './properties_card_view';
import type {ActionRow} from './properties_card_view';

describe('PropertiesCardView actionRows', () => {
    const propertyFields: NameMappedPropertyFields = {
        status: {
            id: 'status_field_id',
            group_id: 'group_id',
            name: 'status',
            type: 'text',
            attrs: null,
            target_id: '',
            target_type: '',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        } as unknown as PropertyField,
    };

    const propertyValues: Array<PropertyValue<unknown>> = [
        {
            id: 'value_id',
            field_id: 'status_field_id',
            value: 'Pending',
        } as PropertyValue<unknown>,
    ];

    const baseProps = {
        title: 'Card Title',
        propertyFields,
        propertyValues,
        fieldOrder: ['status'],
        shortModeFieldOrder: ['status'],
    };

    const actionRows: ActionRow[] = [
        {label: 'Report', content: <div data-testid='report-content'>{'r'}</div>, testId: 'report-row'},
        {label: 'Actions', content: <div data-testid='actions-content'>{'a'}</div>, testId: 'actions-row'},
    ];

    test('renders action rows in full mode with labels and content', () => {
        renderWithContext(
            <PropertiesCardView
                {...baseProps}
                mode='full'
                actionRows={actionRows}
            />,
        );

        const reportRow = screen.getByTestId('report-row');
        expect(reportRow).toBeVisible();
        expect(reportRow).toHaveTextContent('Report');
        expect(screen.getByTestId('report-content')).toBeVisible();

        const actionsRow = screen.getByTestId('actions-row');
        expect(actionsRow).toBeVisible();
        expect(actionsRow).toHaveTextContent('Actions');
        expect(screen.getByTestId('actions-content')).toBeVisible();
    });

    test('does not render action rows in short mode', () => {
        renderWithContext(
            <PropertiesCardView
                {...baseProps}
                mode='short'
                actionRows={actionRows}
            />,
        );

        expect(screen.queryByTestId('report-row')).not.toBeInTheDocument();
        expect(screen.queryByTestId('actions-row')).not.toBeInTheDocument();
    });

    test('skips action rows whose content is falsy', () => {
        renderWithContext(
            <PropertiesCardView
                {...baseProps}
                mode='full'
                actionRows={[
                    {label: 'Empty', content: null, testId: 'empty-row'},
                    actionRows[0],
                ]}
            />,
        );

        expect(screen.queryByTestId('empty-row')).not.toBeInTheDocument();
        expect(screen.getByTestId('report-row')).toBeVisible();
    });
});
