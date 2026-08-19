// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyField} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import ModalController from 'components/modal_controller';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import ClassificationAttribute from './classification_attribute';

const mockSetNavigationBlocked = jest.fn();
jest.mock('actions/admin_actions', () => ({
    setNavigationBlocked: (blocked: boolean) => {
        mockSetNavigationBlocked(blocked);
        return {type: 'SET_NAVIGATION_BLOCKED', blocked};
    },
}));

const TEMPLATE: PropertyField = {
    id: 'template_field_id_123456789',
    group_id: 'group_id_1234567890123456',
    name: 'classification',
    type: 'rank',
    target_type: 'system',
    target_id: '',
    object_type: 'template',
    attrs: {
        options: [
            {id: 'lvl1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1},
            {id: 'lvl2', name: 'SECRET', color: '#C8102E', rank: 2},
        ],
    },
    create_at: 1,
    update_at: 1,
    delete_at: 0,
} as unknown as PropertyField;

function channelField(attrs: Record<string, unknown> = {}): PropertyField {
    return {
        ...TEMPLATE,
        id: 'channel_field_id_1234567890',
        object_type: 'channel',
        linked_field_id: TEMPLATE.id,
        permission_values: 'admin',
        attrs,
    } as unknown as PropertyField;
}

// The page loads the template and the channel field with one paged call each.
function mockLoad(existingChannelField?: PropertyField) {
    return jest.spyOn(Client4, 'getPropertyFields').mockImplementation(async (_group, objectType) => {
        if (objectType === 'template') {
            return [TEMPLATE];
        }
        return existingChannelField ? [existingChannelField] : [];
    });
}

function render() {
    return renderWithContext(
        <>
            <ClassificationAttribute/>
            <ModalController/>
        </>,
    );
}

describe('ClassificationAttribute', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('shows the definition without offering any way to edit it', async () => {
        mockLoad();

        render();

        expect(await screen.findByTestId('classificationAttributeName')).toHaveTextContent('classification');
        expect(screen.getByTestId('classificationAttributeType')).toHaveTextContent('Rank');
        expect(screen.getByTestId('classificationAttributeLevels')).toHaveTextContent('UNCLASSIFIED');
        expect(screen.getByTestId('classificationAttributeLevels')).toHaveTextContent('SECRET');

        // Levels are edited on the Classification Markings page, so nothing here is
        // an input.
        expect(screen.queryAllByRole('textbox')).toHaveLength(0);
        expect(screen.getByTestId('classificationAttributeMarkingsLink')).toHaveAttribute(
            'href',
            '/admin_console/site_config/classification_markings',
        );
    });

    it('says so when classification has not been set up yet', async () => {
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValue([]);

        render();

        expect(await screen.findByTestId('classificationAttributeMissing')).toBeInTheDocument();
        expect(screen.queryByTestId('classificationAttributeName')).not.toBeInTheDocument();
    });

    it('reads an existing channel field back into the row', async () => {
        mockLoad(channelField({required: true, actions: ['display_label_header']}));

        render();

        expect(await screen.findByTestId('channelsResourceRow')).toBeInTheDocument();
        expect(screen.getByTestId('channelsResourceRowSummary')).toHaveTextContent('Required · Display: Header');
        expect(screen.getByTestId('channelsResourceLocation-display_label_header')).toBeChecked();
    });

    it('offers Add resource when classification does not apply to channels', async () => {
        mockLoad();

        render();

        expect(await screen.findByTestId('appliesToAddResource')).toBeInTheDocument();
        expect(screen.queryByTestId('channelsResourceRow')).not.toBeInTheDocument();
    });

    it('creates the channel field when the resource is added and saved', async () => {
        mockLoad();
        const createSpy = jest.spyOn(Client4, 'createPropertyField').mockResolvedValue(channelField());

        render();

        await userEvent.click(await screen.findByTestId('appliesToAddResource'));
        await userEvent.click(screen.getByTestId('channelsResourceLocation-display_label_header'));
        await userEvent.click(screen.getByTestId('saveSetting'));

        await waitFor(() => {
            expect(createSpy).toHaveBeenCalledWith(
                'access_control',
                'channel',
                expect.objectContaining({
                    linked_field_id: TEMPLATE.id,
                    permission_values: 'admin',
                    attrs: {actions: ['display_label_header']},
                }),
            );
        });
    });

    it('keeps Save inert until something actually changes', async () => {
        // Every save is a full write of the channel keys, so an idle click would
        // rewrite the field with what it already holds.
        mockLoad(channelField({required: true, actions: ['display_label_header']}));
        const patchSpy = jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue(channelField());

        render();

        await waitFor(() => expect(screen.getByTestId('channelsResourceRow')).toBeInTheDocument());
        expect(screen.getByTestId('saveSetting')).toBeDisabled();

        await userEvent.click(screen.getByTestId('channelsResourceRequired-button'));
        expect(screen.getByTestId('saveSetting')).toBeEnabled();

        await userEvent.click(screen.getByTestId('saveSetting'));

        // Back to inert once the write lands, which is what the e2e helper waits on.
        await waitFor(() => expect(patchSpy).toHaveBeenCalled());
        await waitFor(() => expect(screen.getByTestId('saveSetting')).toBeDisabled());
    });

    it('patches an existing field rather than creating a second one', async () => {
        // The off states are written explicitly because the server merges attrs; the
        // shape of that patch is covered in channel_field_payload.test.
        mockLoad(channelField({required: true, actions: ['display_label_header']}));
        const patchSpy = jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue(channelField());
        const createSpy = jest.spyOn(Client4, 'createPropertyField');

        render();

        await userEvent.click(await screen.findByTestId('channelsResourceRequired-button'));
        await userEvent.click(screen.getByTestId('channelsResourceLocation-display_label_header'));
        await userEvent.click(screen.getByTestId('saveSetting'));

        await waitFor(() => {
            expect(patchSpy).toHaveBeenCalledWith(
                'access_control',
                'channel',
                'channel_field_id_1234567890',
                {attrs: {required: false, change_policy: 'any', editable: null, actions: []}},
            );
        });
        expect(createSpy).not.toHaveBeenCalled();
    });

    it('asks before removing the resource, and does nothing when cancelled', async () => {
        mockLoad(channelField({actions: ['display_label_header']}));
        const deleteSpy = jest.spyOn(Client4, 'deletePropertyField').mockResolvedValue({status: 'OK'});

        render();

        await userEvent.click(await screen.findByTestId('channelsResourceRowRemove'));

        expect(await screen.findByText('Stop applying Classification to channels?')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(deleteSpy).not.toHaveBeenCalled();
        expect(screen.getByTestId('channelsResourceRow')).toBeInTheDocument();
    });

    it('deletes the channel field once the removal is confirmed', async () => {
        mockLoad(channelField({actions: ['display_label_header']}));
        const deleteSpy = jest.spyOn(Client4, 'deletePropertyField').mockResolvedValue({status: 'OK'});

        render();

        await userEvent.click(await screen.findByTestId('channelsResourceRowRemove'));
        await userEvent.click(await screen.findByRole('button', {name: 'Remove and delete values'}));

        await waitFor(() => {
            expect(deleteSpy).toHaveBeenCalledWith('access_control', 'channel', 'channel_field_id_1234567890');
        });
        await waitFor(() => {
            expect(screen.queryByTestId('channelsResourceRow')).not.toBeInTheDocument();
        });
    });

    it('surfaces a failed save and keeps the form as it was', async () => {
        mockLoad(channelField({actions: ['display_label_header']}));
        jest.spyOn(Client4, 'patchPropertyField').mockRejectedValue(new Error('nope'));

        render();

        await userEvent.click(await screen.findByTestId('channelsResourceRequired-button'));
        await userEvent.click(screen.getByTestId('saveSetting'));

        expect(await screen.findByTestId('classificationAttributeSaveError')).toBeInTheDocument();
        expect(screen.getByTestId('channelsResourceRow')).toBeInTheDocument();
    });
});
