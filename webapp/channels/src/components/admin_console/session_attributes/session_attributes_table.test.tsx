// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {within} from '@testing-library/react';
import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties_user';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import SessionAttributesTable from './session_attributes_table';
import type {SessionAttributeField} from './utils';

type ExtraAttrs = {
    sort_order?: number;
    options?: Array<{id?: string; name: string}>;
    display_name?: string;
    enabled?: boolean;
    platforms?: string[];
    ttl_seconds?: number;
    grace_period_seconds?: number;
};

function makeField(name: string, type: 'text' | 'select', extra: ExtraAttrs = {}): SessionAttributeField {
    const {sort_order: sortOrder, options, ...tunables} = extra;

    return {
        id: `field-${name}`,
        name,
        type,
        group_id: 'session_attributes',
        create_at: 1736541716295,
        update_at: 0,
        delete_at: 0,
        created_by: '',
        updated_by: '',
        target_id: '',
        target_type: 'system',
        object_type: 'session',
        attrs: {
            sort_order: sortOrder ?? 0,
            visibility: 'when_set',
            value_type: '',
            ...(options ? {options} : {}),
            ...tunables,
        },
    } as UserPropertyField;
}

const boolOptions = [{name: 'true'}, {name: 'false'}];

const fields: SessionAttributeField[] = [
    makeField('ip_address', 'text', {
        sort_order: 0,
        display_name: 'Client IP',
        platforms: ['desktop', 'browser'],
        ttl_seconds: 300,
        grace_period_seconds: 60,
        enabled: true,
    }),
    makeField('client_ip_address', 'text', {
        sort_order: 1,
        platforms: ['desktop', 'mobile', 'browser'],
        enabled: false,
    }),
    makeField('os_version', 'text', {sort_order: 2, enabled: true}),
    makeField('app_version', 'text', {sort_order: 3, enabled: true}),
    makeField('client_version', 'text', {sort_order: 4, enabled: true}),
    makeField('device_managed', 'select', {sort_order: 5, options: boolOptions, enabled: true}),
    makeField('is_mobile', 'select', {sort_order: 6, options: boolOptions, enabled: true}),
    makeField('network_secure', 'select', {sort_order: 7, options: boolOptions, enabled: true}),
    makeField('network_status', 'select', {
        sort_order: 8,
        options: [{name: 'trusted'}, {name: 'untrusted'}, {name: 'unknown'}],
        enabled: true,
    }),
    makeField('user_agent_os', 'text', {sort_order: 9, enabled: true}),
    makeField('client_type', 'text', {sort_order: 10, enabled: true}),
];

function rowFor(text: string): HTMLElement {
    const row = screen.getAllByText(text)[0].closest('tr');
    if (!row) {
        throw new Error(`No row found for "${text}"`);
    }
    return row as HTMLElement;
}

describe('SessionAttributesTable', () => {
    const onStageChange = jest.fn();

    beforeEach(() => {
        onStageChange.mockReset();
    });

    it('renders all column headers', () => {
        renderWithContext(
            <SessionAttributesTable
                data={fields}
                onStageChange={onStageChange}
            />,
        );

        for (const header of ['Display Name', 'Name', 'Type', 'Platform', 'TTL', 'Grace', 'Status', 'Actions']) {
            expect(screen.getByRole('columnheader', {name: header})).toBeInTheDocument();
        }
    });

    it('maps each field to its display type', () => {
        renderWithContext(
            <SessionAttributesTable
                data={fields}
                onStageChange={onStageChange}
            />,
        );

        const labels = screen.getAllByTestId('session-attribute-type').map((cell) => cell.textContent);

        const counts = labels.reduce<Record<string, number>>((acc, label) => {
            const key = label ?? '';
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
        }, {});

        expect(labels).toHaveLength(fields.length);
        expect(counts.Boolean).toBe(3);
        expect(counts.Enum).toBe(1);

        // IP/Version display types were removed; every non-select field is String.
        expect(counts.String).toBe(7);
    });

    it('shows the Server badge only on request-derived fields', () => {
        renderWithContext(
            <SessionAttributesTable
                data={fields}
                onStageChange={onStageChange}
            />,
        );

        expect(screen.getAllByTestId('session-attribute-server-label')).toHaveLength(2);

        expect(within(rowFor('ip_address')).getByTestId('session-attribute-server-label')).toBeInTheDocument();
        expect(within(rowFor('user_agent_os')).getByTestId('session-attribute-server-label')).toBeInTheDocument();

        // client_ip_address is seeded but not request-derived, so it must not be flagged.
        expect(within(rowFor('client_ip_address')).queryByTestId('session-attribute-server-label')).not.toBeInTheDocument();
        expect(within(rowFor('client_type')).queryByTestId('session-attribute-server-label')).not.toBeInTheDocument();
        expect(within(rowFor('os_version')).queryByTestId('session-attribute-server-label')).not.toBeInTheDocument();
    });

    it('reflects attrs.platforms in the platform icons', () => {
        renderWithContext(
            <SessionAttributesTable
                data={fields}
                onStageChange={onStageChange}
            />,
        );

        const platforms = within(rowFor('Client IP')).getByTestId('session-attribute-platforms');

        expect(platforms.querySelector('[data-platform="desktop"]')).toHaveAttribute('data-active', 'true');
        expect(platforms.querySelector('[data-platform="browser"]')).toHaveAttribute('data-active', 'true');
        expect(platforms.querySelector('[data-platform="mobile"]')).toHaveAttribute('data-active', 'false');
    });

    it('reflects attrs.enabled in the status chip', () => {
        renderWithContext(
            <SessionAttributesTable
                data={fields}
                onStageChange={onStageChange}
            />,
        );

        const enabled = within(rowFor('Client IP')).getByTestId('session-attribute-status');
        expect(enabled).toHaveTextContent('Enabled');
        expect(enabled).toHaveAttribute('data-enabled', 'true');

        const disabled = within(rowFor('client_ip_address')).getByTestId('session-attribute-status');
        expect(disabled).toHaveTextContent('Disabled');
        expect(disabled).toHaveAttribute('data-enabled', 'false');
    });

    it('formats TTL and grace durations', () => {
        renderWithContext(
            <SessionAttributesTable
                data={fields}
                onStageChange={onStageChange}
            />,
        );

        const row = rowFor('Client IP');
        expect(within(row).getByTestId('session-attribute-ttl')).toHaveTextContent('5m');
        expect(within(row).getByTestId('session-attribute-grace')).toHaveTextContent('1m');
    });

    it('falls back to the field name when display_name is absent', () => {
        renderWithContext(
            <SessionAttributesTable
                data={fields}
                onStageChange={onStageChange}
            />,
        );

        expect(within(rowFor('Client IP')).getByTestId('session-attribute-display-name')).toHaveTextContent('Client IP');
        expect(within(rowFor('os_version')).getByTestId('session-attribute-display-name')).toHaveTextContent('os_version');
    });

    it('renders default/zero TTL, grace and platforms sensibly', () => {
        renderWithContext(
            <SessionAttributesTable
                data={fields}
                onStageChange={onStageChange}
            />,
        );

        const row = rowFor('os_version');
        expect(within(row).getByTestId('session-attribute-ttl')).toHaveTextContent('0s');
        expect(within(row).getByTestId('session-attribute-grace')).toHaveTextContent('0s');

        const slots = within(row).getByTestId('session-attribute-platforms').querySelectorAll('[data-active]');
        expect(slots).toHaveLength(3);
        expect(Array.from(slots).every((slot) => slot.getAttribute('data-active') === 'false')).toBe(true);
    });

    it('renders an interactive kebab button per row', () => {
        renderWithContext(
            <SessionAttributesTable
                data={fields}
                onStageChange={onStageChange}
            />,
        );

        const buttons = fields.map((field) => screen.getByTestId(`session-attribute-dotmenu-${field.id}`));
        expect(buttons).toHaveLength(fields.length);
        buttons.forEach((button) => expect(button.tagName).toBe('BUTTON'));
    });
});
