// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';

import {
    DISPLAY_BANNER_BOTTOM,
    DISPLAY_BANNER_TOP,
    CLASSIFICATIONS_FIELD_TARGET_ID,
    CLASSIFICATIONS_FIELD_TARGET_TYPE,
    CLASSIFICATIONS_GROUP_NAME,
    CLASSIFICATIONS_SYSTEM_OBJECT_TYPE,
    CLASSIFICATIONS_SYSTEM_VALUE_TARGET_ID,
} from 'components/admin_console/classification_markings/utils';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

const MOCK_USER_ID = 'current_user_id_12345678';

import GlobalClassificationBanner from './global_classification_banner';

jest.mock('mattermost-redux/client');

const TEMPLATE_FIELD_ID = 'template_field1';
const LINKED_FIELD_ID = 'linked_field1';

function makeLinkedField(actions: string[], options: Array<{id: string; name: string; color: string}> = []): PropertyField {
    return {
        id: LINKED_FIELD_ID,
        group_id: CLASSIFICATIONS_GROUP_NAME,
        name: 'classification',
        type: 'select',
        object_type: CLASSIFICATIONS_SYSTEM_OBJECT_TYPE,
        target_type: CLASSIFICATIONS_FIELD_TARGET_TYPE,
        target_id: CLASSIFICATIONS_FIELD_TARGET_ID,
        linked_field_id: TEMPLATE_FIELD_ID,
        create_at: 2000,
        update_at: 2000,
        delete_at: 0,
        created_by: 'user1',
        updated_by: 'user1',
        attrs: {
            actions,
            options: options.map((o, i) => ({id: o.id, name: o.name, color: o.color, rank: i + 1})),
        },
    };
}

function makeSystemValue(optionId: string): PropertyValue<string> {
    return {
        id: 'value1',
        target_id: CLASSIFICATIONS_SYSTEM_VALUE_TARGET_ID,
        target_type: CLASSIFICATIONS_SYSTEM_OBJECT_TYPE,
        group_id: CLASSIFICATIONS_GROUP_NAME,
        field_id: LINKED_FIELD_ID,
        value: optionId,
        create_at: 3000,
        update_at: 3000,
        delete_at: 0,
        created_by: 'user1',
        updated_by: 'user1',
    };
}

type StateOptions = {
    linkedField?: PropertyField | null;
    systemValue?: PropertyValue<string> | null;
    featureFlagEnabled?: boolean;
};

function makeState({
    linkedField = null,
    systemValue = null,
    featureFlagEnabled = true,
}: StateOptions = {}): DeepPartial<GlobalState> {
    const fieldsById: Record<string, PropertyField> = {};
    if (linkedField) {
        fieldsById[linkedField.id] = linkedField;
    }

    const byTargetId: Record<string, Record<string, PropertyValue<unknown>>> = {};
    const byFieldId: Record<string, Record<string, PropertyValue<unknown>>> = {};
    if (systemValue) {
        byTargetId[systemValue.target_id] = {[systemValue.field_id]: systemValue};
        byFieldId[systemValue.field_id] = {[systemValue.target_id]: systemValue};
    }

    return {
        entities: {
            users: {
                currentUserId: MOCK_USER_ID,
            },
            general: {
                config: {
                    FeatureFlagClassificationMarkings: featureFlagEnabled ? 'true' : 'false',
                },
            },
            properties: {
                fields: {
                    byId: fieldsById,
                    byObjectType: {},
                },
                values: {byTargetId, byFieldId},
                groups: {byId: {}, byName: {}},
            },
        },
    };
}

describe('GlobalClassificationBanner', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Prevent the bootstrap useEffect from making real HTTP calls.
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValue([]);
        jest.spyOn(Client4, 'getPropertyValues').mockResolvedValue([]);
    });

    test('renders top banner with level name and background color from template options', () => {
        const options = [{id: 'opt1', name: 'SECRET', color: '#C8102E'}];
        const linked = makeLinkedField([DISPLAY_BANNER_TOP], options);
        const value = makeSystemValue('opt1');

        renderWithContext(
            <GlobalClassificationBanner position='top'/>,
            makeState({linkedField: linked, systemValue: value}),
        );

        const banner = screen.getByTestId('global-classification-banner-top');
        expect(banner).toBeInTheDocument();
        expect(banner).toHaveStyle({backgroundColor: '#C8102E'});
        expect(screen.getByText('SECRET')).toBeInTheDocument();
    });

    test('does not render when feature flag is off', () => {
        const options = [{id: 'opt1', name: 'SECRET', color: '#C8102E'}];
        const linked = makeLinkedField([DISPLAY_BANNER_TOP], options);
        const value = makeSystemValue('opt1');

        renderWithContext(
            <GlobalClassificationBanner position='top'/>,
            makeState({linkedField: linked, systemValue: value, featureFlagEnabled: false}),
        );

        expect(screen.queryByTestId('global-classification-banner-top')).not.toBeInTheDocument();
    });

    test('does not render when linked field has no display actions', () => {
        const options = [{id: 'opt1', name: 'SECRET', color: '#C8102E'}];
        const linked = makeLinkedField([], options);
        const value = makeSystemValue('opt1');

        renderWithContext(
            <GlobalClassificationBanner position='top'/>,
            makeState({linkedField: linked, systemValue: value}),
        );

        expect(screen.queryByTestId('global-classification-banner-top')).not.toBeInTheDocument();
    });

    test('does not render when system property value is absent', () => {
        const options = [{id: 'opt1', name: 'SECRET', color: '#C8102E'}];
        const linked = makeLinkedField([DISPLAY_BANNER_TOP], options);

        renderWithContext(
            <GlobalClassificationBanner position='top'/>,
            makeState({linkedField: linked, systemValue: null}),
        );

        expect(screen.queryByTestId('global-classification-banner-top')).not.toBeInTheDocument();
    });

    test('does not render when option ID in value does not match any template option', () => {
        const options = [{id: 'opt1', name: 'SECRET', color: '#C8102E'}];
        const linked = makeLinkedField([DISPLAY_BANNER_TOP], options);
        const value = makeSystemValue('nonexistent_id');

        renderWithContext(
            <GlobalClassificationBanner position='top'/>,
            makeState({linkedField: linked, systemValue: value}),
        );

        expect(screen.queryByTestId('global-classification-banner-top')).not.toBeInTheDocument();
    });

    test('renders bottom banner when linked field has display_banner_bottom action', () => {
        const options = [{id: 'opt1', name: 'SECRET', color: '#C8102E'}];
        const linked = makeLinkedField([DISPLAY_BANNER_TOP, DISPLAY_BANNER_BOTTOM], options);
        const value = makeSystemValue('opt1');

        renderWithContext(
            <GlobalClassificationBanner position='bottom'/>,
            makeState({linkedField: linked, systemValue: value}),
        );

        expect(screen.getByTestId('global-classification-banner-bottom')).toBeInTheDocument();
        expect(screen.getByText('SECRET')).toBeInTheDocument();
    });

    test('does not render bottom banner when linked field only has display_banner_top', () => {
        const options = [{id: 'opt1', name: 'SECRET', color: '#C8102E'}];
        const linked = makeLinkedField([DISPLAY_BANNER_TOP], options);
        const value = makeSystemValue('opt1');

        renderWithContext(
            <GlobalClassificationBanner position='bottom'/>,
            makeState({linkedField: linked, systemValue: value}),
        );

        expect(screen.queryByTestId('global-classification-banner-bottom')).not.toBeInTheDocument();
    });

    test('renders top banner when both actions are present', () => {
        const options = [{id: 'opt1', name: 'SECRET', color: '#C8102E'}];
        const linked = makeLinkedField([DISPLAY_BANNER_TOP, DISPLAY_BANNER_BOTTOM], options);
        const value = makeSystemValue('opt1');

        renderWithContext(
            <GlobalClassificationBanner position='top'/>,
            makeState({linkedField: linked, systemValue: value}),
        );

        expect(screen.getByTestId('global-classification-banner-top')).toBeInTheDocument();
    });

    test('does not render when linked field is not in store', () => {
        const value = makeSystemValue('opt1');

        renderWithContext(
            <GlobalClassificationBanner position='top'/>,
            makeState({linkedField: null, systemValue: value}),
        );

        expect(screen.queryByTestId('global-classification-banner-top')).not.toBeInTheDocument();
    });

    test('does not render when no fields are in store', () => {
        renderWithContext(
            <GlobalClassificationBanner position='top'/>,
            makeState(),
        );

        expect(screen.queryByTestId('global-classification-banner-top')).not.toBeInTheDocument();
    });

    test('derives color from the correct option in template field by option ID', () => {
        const options = [
            {id: 'opt1', name: 'UNCLASSIFIED', color: '#007A33'},
            {id: 'opt2', name: 'TOP SECRET', color: '#FCE83A'},
        ];
        const linked = makeLinkedField([DISPLAY_BANNER_TOP], options);
        const value = makeSystemValue('opt2'); // points to TOP SECRET

        renderWithContext(
            <GlobalClassificationBanner position='top'/>,
            makeState({linkedField: linked, systemValue: value}),
        );

        const banner = screen.getByTestId('global-classification-banner-top');
        expect(banner).toHaveStyle({backgroundColor: '#FCE83A'});
        expect(screen.getByText('TOP SECRET')).toBeInTheDocument();
    });

    test('triggers bootstrap fetch for linked fields when not in store', () => {
        renderWithContext(
            <GlobalClassificationBanner position='top'/>,
            makeState({linkedField: null}),
        );

        expect(Client4.getPropertyFields).toHaveBeenCalledWith(
            CLASSIFICATIONS_GROUP_NAME,
            CLASSIFICATIONS_SYSTEM_OBJECT_TYPE,
            CLASSIFICATIONS_FIELD_TARGET_TYPE,
            CLASSIFICATIONS_FIELD_TARGET_ID,
            expect.anything(),
        );
    });
});
