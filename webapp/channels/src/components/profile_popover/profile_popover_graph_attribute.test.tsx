// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import React from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {clearPropertyFieldOptionWalks, pageAllAccessControlFieldOptions} from 'components/property_fields/graph/page_all_access_control_field_options';
import {clearGraphOptionNameCache} from 'components/property_fields/graph/use_graph_option_names';

import {renderWithContext} from 'tests/react_testing_utils';

import ProfilePopoverGraphAttribute from './profile_popover_graph_attribute';

import {TestHelper} from '../../utils/test_helper';

jest.mock('components/property_fields/graph/page_all_access_control_field_options', () => ({
    ...jest.requireActual('components/property_fields/graph/page_all_access_control_field_options'),
    pageAllAccessControlFieldOptions: jest.fn(),
}));

const mockPageAll = jest.mocked(pageAllAccessControlFieldOptions);

const graphOption = (id: string, name: string, parents: string[] = []): PropertyFieldOption => ({
    id,
    name,
    parents,
    create_at: 1,
});

const REGIME_1 = [
    graphOption('opt1', 'Option 1'),
    graphOption('opt2', 'Option 2'),
    graphOption('opt3', 'Option 3'),
];

describe('components/ProfilePopoverGraphAttribute', () => {
    const attribute: UserPropertyField = {
        id: 'graph_attribute_id',
        name: 'Program',
        type: 'graph',
        group_id: 'custom_profile_attributes',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        created_by: '',
        updated_by: '',
        target_id: '',
        target_type: '',
        object_type: 'user',
        attrs: {
            options: REGIME_1,
            visibility: 'when_set',
            sort_order: 0,
            value_type: '',
        },
    };

    const baseProps = {
        attribute,
        userProfile: TestHelper.getUserMock({
            id: 'user_id',
            custom_profile_attributes: {
                graph_attribute_id: ['opt1'],
            },
        }),
    };

    beforeEach(() => {
        clearPropertyFieldOptionWalks();
        clearGraphOptionNameCache();
        mockPageAll.mockImplementation(() => {
            throw new Error('pageAllAccessControlFieldOptions called without an explicit mock for this test');
        });
    });

    test('should render the selected option name from inlined options', () => {
        renderWithContext(<ProfilePopoverGraphAttribute {...baseProps}/>);

        const textElement = screen.getByText('Option 1');
        const paragraph = textElement.closest('p') ?? textElement;
        expect(paragraph).toHaveClass('user-popover__subtitle-text');
        expect(paragraph).toHaveAttribute('aria-labelledby', 'user-popover__custom_attributes-title-graph_attribute_id');
        expect(screen.queryByText('opt1')).not.toBeInTheDocument();
        expect(mockPageAll).not.toHaveBeenCalled();
    });

    test('should render multiple selected option names', () => {
        const props = {
            ...baseProps,
            userProfile: TestHelper.getUserMock({
                id: 'user_id',
                custom_profile_attributes: {
                    graph_attribute_id: ['opt1', 'opt2'],
                },
            }),
        };
        renderWithContext(<ProfilePopoverGraphAttribute {...props}/>);

        expect(screen.getByText('Option 1 and Option 2')).toBeInTheDocument();
        expect(screen.queryByText('opt1')).not.toBeInTheDocument();
    });

    test('should not render when attribute value is missing', () => {
        const props = {
            ...baseProps,
            userProfile: TestHelper.getUserMock({
                id: 'user_id',
                custom_profile_attributes: {},
            }),
        };
        const {container} = renderWithContext(<ProfilePopoverGraphAttribute {...props}/>);
        expect(container.firstChild).toBeNull();
        expect(mockPageAll).not.toHaveBeenCalled();
    });

    test('should show a count, not raw ids, when options are omitted and names have not resolved', () => {
        const props = {
            ...baseProps,
            attribute: {
                ...attribute,
                attrs: {
                    ...attribute.attrs,
                    options: undefined,
                    options_omitted: true,
                },
            },
            userProfile: TestHelper.getUserMock({
                id: 'user_id',
                custom_profile_attributes: {
                    graph_attribute_id: ['opt1', 'opt2'],
                },
            }),
        };

        mockPageAll.mockResolvedValue(REGIME_1);
        renderWithContext(<ProfilePopoverGraphAttribute {...props}/>);

        expect(screen.getByText('2 values selected')).toBeInTheDocument();
        expect(screen.queryByText('opt1')).not.toBeInTheDocument();
    });

    test('should render fetched option names after walking an omitted field', async () => {
        const props = {
            ...baseProps,
            attribute: {
                ...attribute,
                attrs: {
                    ...attribute.attrs,
                    options: undefined,
                    options_omitted: true,
                },
            },
            userProfile: TestHelper.getUserMock({
                id: 'user_id',
                custom_profile_attributes: {
                    graph_attribute_id: ['opt1'],
                },
            }),
        };

        mockPageAll.mockResolvedValue(REGIME_1);
        renderWithContext(<ProfilePopoverGraphAttribute {...props}/>);

        await waitFor(() => expect(screen.getByText('Option 1')).toBeInTheDocument());
        expect(screen.queryByText('opt1')).not.toBeInTheDocument();
        expect(screen.queryByText('1 value selected')).not.toBeInTheDocument();
    });

    test('should show a count when a stored id is stale and only some names resolve', () => {
        const props = {
            ...baseProps,
            userProfile: TestHelper.getUserMock({
                id: 'user_id',
                custom_profile_attributes: {
                    graph_attribute_id: ['opt1', 'no-longer-exists'],
                },
            }),
        };
        renderWithContext(<ProfilePopoverGraphAttribute {...props}/>);

        expect(screen.getByText('2 values selected')).toBeInTheDocument();
        expect(screen.queryByText('Option 1')).not.toBeInTheDocument();
        expect(screen.queryByText('no-longer-exists')).not.toBeInTheDocument();
    });
});
