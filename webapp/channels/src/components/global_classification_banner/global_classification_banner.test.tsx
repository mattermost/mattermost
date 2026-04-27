// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyField} from '@mattermost/types/properties';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import GlobalClassificationBanner from './global_classification_banner';

jest.mock('mattermost-redux/client');

function makeClassificationField(overrides: {
    enabled?: boolean;
    placement?: string;
    levelName?: string;
    levels?: Array<{name: string; color: string}>;
} = {}): PropertyField {
    const {
        enabled = true,
        placement = 'top',
        levelName = 'SECRET',
        levels = [{name: 'SECRET', color: '#C8102E'}],
    } = overrides;

    return {
        id: 'field1',
        group_id: 'custom_profile_attributes',
        name: 'classification',
        type: 'select',
        object_type: 'template',
        target_type: 'system',
        target_id: '',
        create_at: 1000,
        update_at: 1000,
        delete_at: 0,
        created_by: 'user1',
        updated_by: 'user1',
        attrs: {
            options: levels.map((l, i) => ({id: `opt-${i}`, name: l.name, color: l.color, rank: i + 1})),
            managed: 'admin',
            global_banner: {
                enabled,
                placement,
                level_name: levelName,
            },
        },
    };
}

function makeState(field: PropertyField | null, featureFlagEnabled = true): DeepPartial<GlobalState> {
    const fieldsById: Record<string, PropertyField> = {};
    if (field) {
        fieldsById[field.id] = field;
    }
    return {
        entities: {
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
                values: {byTargetId: {}, byFieldId: {}},
                groups: {byId: {}, byName: {}},
            },
        },
    };
}

describe('GlobalClassificationBanner', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Prevent the bootstrap fetch from making real HTTP calls when no field is in state.
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValue([]);
    });

    test('renders top banner with level name and background color', () => {
        renderWithContext(
            <GlobalClassificationBanner position='top'/>,
            makeState(makeClassificationField()),
        );

        const banner = screen.getByTestId('global-classification-banner-top');
        expect(banner).toBeInTheDocument();
        expect(banner).toHaveStyle({backgroundColor: '#C8102E'});
        expect(screen.getByText('SECRET')).toBeInTheDocument();
    });

    test('does not render when feature flag is off', () => {
        renderWithContext(
            <GlobalClassificationBanner position='top'/>,
            makeState(makeClassificationField(), false),
        );

        expect(screen.queryByTestId('global-classification-banner-top')).not.toBeInTheDocument();
    });

    test('does not render when banner is disabled', () => {
        renderWithContext(
            <GlobalClassificationBanner position='top'/>,
            makeState(makeClassificationField({enabled: false})),
        );

        expect(screen.queryByTestId('global-classification-banner-top')).not.toBeInTheDocument();
    });

    test('does not render when level name is empty', () => {
        renderWithContext(
            <GlobalClassificationBanner position='top'/>,
            makeState(makeClassificationField({levelName: ''})),
        );

        expect(screen.queryByTestId('global-classification-banner-top')).not.toBeInTheDocument();
    });

    test('renders bottom banner when placement is top_and_bottom', () => {
        renderWithContext(
            <GlobalClassificationBanner position='bottom'/>,
            makeState(makeClassificationField({placement: 'top_and_bottom'})),
        );

        expect(screen.getByTestId('global-classification-banner-bottom')).toBeInTheDocument();
        expect(screen.getByText('SECRET')).toBeInTheDocument();
    });

    test('does not render bottom banner when placement is top', () => {
        renderWithContext(
            <GlobalClassificationBanner position='bottom'/>,
            makeState(makeClassificationField({placement: 'top'})),
        );

        expect(screen.queryByTestId('global-classification-banner-bottom')).not.toBeInTheDocument();
    });

    test('renders top banner regardless of placement value', () => {
        renderWithContext(
            <GlobalClassificationBanner position='top'/>,
            makeState(makeClassificationField({placement: 'top_and_bottom'})),
        );

        expect(screen.getByTestId('global-classification-banner-top')).toBeInTheDocument();
    });

    test('does not render when field is not in the store', () => {
        renderWithContext(
            <GlobalClassificationBanner position='top'/>,
            makeState(null),
        );

        expect(screen.queryByTestId('global-classification-banner-top')).not.toBeInTheDocument();
    });

    test('derives color from level options', () => {
        const field = makeClassificationField({
            levelName: 'TOP SECRET',
            levels: [
                {name: 'UNCLASSIFIED', color: '#007A33'},
                {name: 'TOP SECRET', color: '#FCE83A'},
            ],
        });

        renderWithContext(
            <GlobalClassificationBanner position='top'/>,
            makeState(field),
        );

        const banner = screen.getByTestId('global-classification-banner-top');
        expect(banner).toHaveStyle({backgroundColor: '#FCE83A'});
        expect(banner).toContainHTML('TOP SECRET');
    });
});
