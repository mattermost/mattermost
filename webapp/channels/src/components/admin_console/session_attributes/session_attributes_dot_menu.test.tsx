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

const enabledField = makeField('ip_address', {
    display_name: 'Client IP',
    enabled: true,
    ttl_seconds: 300,
    grace_period_seconds: 60,
});

const disabledField = makeField('vpn_active', {
    display_name: 'VPN active',
    enabled: false,
    ttl_seconds: 30,
    grace_period_seconds: 30,
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
        expect(screen.getByTestId(`session-attribute-dotmenu-${enabledField.id}`)).toBeInTheDocument();
    });

    it('shows the TTL and Grace submenus with their current values', async () => {
        renderMenu(enabledField);

        await userEvent.click(screen.getByTestId(`session-attribute-dotmenu-${enabledField.id}`));

        const ttl = screen.getByRole('menuitem', {name: /Time-to-live/});
        const grace = screen.getByRole('menuitem', {name: /Grace Period/});
        expect(ttl).toHaveTextContent('5m');
        expect(grace).toHaveTextContent('1m');
    });

    it('stages a TTL preset selection', async () => {
        const onStageChange = renderMenu(enabledField);

        await userEvent.click(screen.getByTestId(`session-attribute-dotmenu-${enabledField.id}`));
        await userEvent.hover(screen.getByRole('menuitem', {name: /Time-to-live/}));

        const option = await screen.findByTestId(`session-attribute-ttl-option-${enabledField.id}-3600`);
        await userEvent.click(option);

        expect(onStageChange).toHaveBeenCalledTimes(1);
        expect(onStageChange).toHaveBeenCalledWith(enabledField.id, {ttl_seconds: 3600});
    });

    it('stages a Grace preset selection', async () => {
        const onStageChange = renderMenu(enabledField);

        await userEvent.click(screen.getByTestId(`session-attribute-dotmenu-${enabledField.id}`));
        await userEvent.hover(screen.getByRole('menuitem', {name: /Grace Period/}));

        const option = await screen.findByTestId(`session-attribute-grace-option-${enabledField.id}-300`);
        await userEvent.click(option);

        expect(onStageChange).toHaveBeenCalledTimes(1);
        expect(onStageChange).toHaveBeenCalledWith(enabledField.id, {grace_period_seconds: 300});
    });

    it('marks the currently selected TTL preset as checked', async () => {
        renderMenu(enabledField);

        await userEvent.click(screen.getByTestId(`session-attribute-dotmenu-${enabledField.id}`));
        await userEvent.hover(screen.getByRole('menuitem', {name: /Time-to-live/}));

        const selected = await screen.findByTestId(`session-attribute-ttl-option-${enabledField.id}-300`);
        expect(selected).toHaveAttribute('aria-checked', 'true');

        const unselected = screen.getByTestId(`session-attribute-ttl-option-${enabledField.id}-30`);
        expect(unselected).toHaveAttribute('aria-checked', 'false');
    });

    it('opens the confirmation modal for Disable without staging immediately', async () => {
        const onStageChange = renderMenu(enabledField);

        await userEvent.click(screen.getByTestId(`session-attribute-dotmenu-${enabledField.id}`));
        await userEvent.click(screen.getByTestId(`session-attribute-disable-${enabledField.id}`));

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

        await userEvent.click(screen.getByTestId(`session-attribute-dotmenu-${disabledField.id}`));

        expect(screen.queryByTestId(`session-attribute-disable-${disabledField.id}`)).not.toBeInTheDocument();

        await userEvent.click(screen.getByTestId(`session-attribute-enable-${disabledField.id}`));

        await waitFor(() => {
            expect(onStageChange).toHaveBeenCalledTimes(1);
        });
        expect(onStageChange).toHaveBeenCalledWith(disabledField.id, {enabled: true});
        expect(screen.queryByText('Disable attribute')).not.toBeInTheDocument();
    });
});
