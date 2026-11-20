// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties_user';

import ModalController from 'components/modal_controller';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import SessionAttributesDotMenu from './session_attributes_dot_menu';
import type {SessionAttributeField} from './utils';

type ExtraAttrs = {
    display_name?: string;
    enabled?: boolean;
    ttl_seconds?: number;
    grace_period_seconds?: number;
};

function makeField(name: string, extra: ExtraAttrs = {}): SessionAttributeField {
    return {
        id: `field-${name}`,
        name,
        type: 'text',
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
            sort_order: 0,
            visibility: 'when_set',
            value_type: '',
            ...extra,
        },
    } as UserPropertyField;
}

const enabledField = makeField('client_ip_address', {
    display_name: 'Client IP',
    enabled: true,
    ttl_seconds: 300,
    grace_period_seconds: 60,
});

const disabledField = makeField('vpn_active', {
    display_name: 'VPN active',
    enabled: false,
    ttl_seconds: 60,
    grace_period_seconds: 60,
});

const serverSourcedField = makeField('ip_address', {
    display_name: 'IP Address',
    enabled: true,
    ttl_seconds: 300,
    grace_period_seconds: 60,
});

function renderMenu(field: SessionAttributeField, onStageChange = jest.fn()) {
    renderWithContext(
        <div>
            <SessionAttributesDotMenu
                field={field}
                onStageChange={onStageChange}
            />
            <ModalController/>
        </div>,
    );
    return onStageChange;
}

describe('SessionAttributesDotMenu', () => {
    it('renders the kebab button', () => {
        renderMenu(enabledField);
        expect(screen.getByTestId('admin.session_attributes.row.actions--button')).toBeInTheDocument();
    });

    it('shows the TTL and Grace submenus with their current values', async () => {
        renderMenu(enabledField);

        await userEvent.click(screen.getByTestId('admin.session_attributes.row.actions--button'));

        const ttl = screen.getByRole('menuitem', {name: /Time-to-live/});
        const grace = screen.getByRole('menuitem', {name: /Grace Period/});
        expect(ttl).toHaveTextContent('5m');
        expect(grace).toHaveTextContent('1m');
    });

    it('stages a TTL preset selection', async () => {
        const onStageChange = renderMenu(enabledField);

        await userEvent.click(screen.getByTestId('admin.session_attributes.row.actions--button'));
        await userEvent.hover(screen.getByRole('menuitem', {name: /Time-to-live/}));

        const option = await screen.findByTestId('admin.session_attributes.actions_menu.ttl:3600--menuitemradio');
        await userEvent.click(option);

        expect(onStageChange).toHaveBeenCalledTimes(1);
        expect(onStageChange).toHaveBeenCalledWith(enabledField.id, {ttl_seconds: 3600});
    });

    it('stages a Grace preset selection', async () => {
        const onStageChange = renderMenu(enabledField);

        await userEvent.click(screen.getByTestId('admin.session_attributes.row.actions--button'));
        await userEvent.hover(screen.getByRole('menuitem', {name: /Grace Period/}));

        const option = await screen.findByTestId('admin.session_attributes.actions_menu.grace:300--menuitemradio');
        await userEvent.click(option);

        expect(onStageChange).toHaveBeenCalledTimes(1);
        expect(onStageChange).toHaveBeenCalledWith(enabledField.id, {grace_period_seconds: 300});
    });

    it('marks the currently selected TTL preset as checked', async () => {
        renderMenu(enabledField);

        await userEvent.click(screen.getByTestId('admin.session_attributes.row.actions--button'));
        await userEvent.hover(screen.getByRole('menuitem', {name: /Time-to-live/}));

        const selected = await screen.findByTestId('admin.session_attributes.actions_menu.ttl:300--menuitemradio');
        expect(selected).toHaveAttribute('aria-checked', 'true');

        const unselected = screen.getByTestId('admin.session_attributes.actions_menu.ttl:60--menuitemradio');
        expect(unselected).toHaveAttribute('aria-checked', 'false');
    });

    it('does not offer a 30 second TTL preset', async () => {
        renderMenu(enabledField);

        await userEvent.click(screen.getByTestId('admin.session_attributes.row.actions--button'));
        await userEvent.hover(screen.getByRole('menuitem', {name: /Time-to-live/}));

        await screen.findByTestId('admin.session_attributes.actions_menu.ttl:60--menuitemradio');
        expect(screen.queryByTestId('admin.session_attributes.actions_menu.ttl:30--menuitemradio')).not.toBeInTheDocument();
    });

    it('hides the TTL and Grace submenus for server-sourced attributes', async () => {
        renderMenu(serverSourcedField);

        await userEvent.click(screen.getByTestId('admin.session_attributes.row.actions--button'));

        expect(screen.queryByRole('menuitem', {name: /Time-to-live/})).not.toBeInTheDocument();
        expect(screen.queryByRole('menuitem', {name: /Grace Period/})).not.toBeInTheDocument();
    });

    it('opens the confirmation modal for Disable without staging immediately', async () => {
        const onStageChange = renderMenu(enabledField);

        await userEvent.click(screen.getByTestId('admin.session_attributes.row.actions--button'));
        await userEvent.click(screen.getByTestId('admin.session_attributes.actions_menu.disable--menuitem'));

        await waitFor(() => {
            expect(screen.getByText('Disable attribute')).toBeInTheDocument();
        });
        expect(onStageChange).not.toHaveBeenCalled();

        await userEvent.click(screen.getByRole('button', {name: 'Disable'}));

        expect(onStageChange).toHaveBeenCalledTimes(1);
        expect(onStageChange).toHaveBeenCalledWith(enabledField.id, {enabled: false});
    });

    it('stages Enable in one click without a modal', async () => {
        const onStageChange = renderMenu(disabledField);

        await userEvent.click(screen.getByTestId('admin.session_attributes.row.actions--button'));

        expect(screen.queryByTestId('admin.session_attributes.actions_menu.disable--menuitem')).not.toBeInTheDocument();

        await userEvent.click(screen.getByTestId('admin.session_attributes.actions_menu.enable--menuitem'));

        await waitFor(() => {
            expect(onStageChange).toHaveBeenCalledTimes(1);
        });
        expect(onStageChange).toHaveBeenCalledWith(disabledField.id, {enabled: true});
        expect(screen.queryByText('Disable attribute')).not.toBeInTheDocument();
    });
});
