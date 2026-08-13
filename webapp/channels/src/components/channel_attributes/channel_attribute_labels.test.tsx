// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, screen, waitFor} from '@testing-library/react';
import React from 'react';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';
import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import ChannelAttributeLabels from './channel_attribute_labels';

jest.mock('mattermost-redux/actions/properties', () => ({
    fetchPropertyFields: jest.fn(() => () => Promise.resolve({data: []})),
}));

const GROUP_ID = 'group1';
const CHANNEL_ID = 'channel1';

function field(id: string, {sortOrder, color = '#1e325c'}: {sortOrder?: number; color?: string} = {}): PropertyField {
    return {
        id,
        group_id: GROUP_ID,
        name: id,
        type: 'select',
        target_id: '',
        target_type: 'system',
        object_type: 'channel',
        attrs: {
            actions: ['display_label_header'],
            options: [{id: `opt_${id}`, name: id.toUpperCase(), color}],
            display_name: id.toUpperCase(),
            ...(sortOrder === undefined ? {} : {sort_order: sortOrder}),
        },
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: '',
        updated_by: '',
    };
}

function value(fieldId: string): PropertyValue<unknown> {
    return {
        id: `value_${fieldId}`,
        target_id: CHANNEL_ID,
        target_type: 'channel',
        group_id: GROUP_ID,
        field_id: fieldId,
        value: `opt_${fieldId}`,
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: '',
        updated_by: '',
    };
}

function makeState(fields: PropertyField[], flag = 'true'): DeepPartial<GlobalState> {
    const byTargetId: Record<string, Record<string, PropertyValue<unknown>>> = {[CHANNEL_ID]: {}};
    for (const f of fields) {
        byTargetId[CHANNEL_ID][f.id] = value(f.id);
    }

    return {
        entities: {
            general: {
                config: {FeatureFlagChannelAttributes: flag},
                license: {IsLicensed: 'true', SkuShortName: 'enterprise'},
            },
            properties: {
                groups: {byId: {[GROUP_ID]: {id: GROUP_ID, name: 'access_control'}}, byName: {access_control: {id: GROUP_ID, name: 'access_control'}}},
                fields: {
                    byId: Object.fromEntries(fields.map((f) => [f.id, f])),
                    byObjectType: {channel: {[GROUP_ID]: Object.fromEntries(fields.map((f) => [f.id, f]))}},
                },
                values: {byTargetId, byFieldId: {}},
            },
        },
    } as DeepPartial<GlobalState>;
}

// jsdom does not lay out, so widths are stubbed: the container reports
// `containerWidth` and every chip a fixed width. That is enough to exercise the
// accumulate-and-split logic, which is the part with the bugs in it.
function stubWidths(containerWidth: number, chipWidth = 60) {
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        const isContainer = this.classList.contains('ChannelAttributeLabels__visible');
        return {width: isContainer ? containerWidth : chipWidth} as DOMRect;
    });
}

describe('ChannelAttributeLabels', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('renders nothing when no attribute is designated for the header', () => {
        const plain = field('program');
        plain.attrs = {...plain.attrs, actions: ['display_label_info']};

        renderWithContext(<ChannelAttributeLabels channelId={CHANNEL_ID}/>, makeState([plain]));

        expect(screen.queryByTestId('channelAttributeLabels')).not.toBeInTheDocument();
    });

    test('renders nothing when the feature flag is off', () => {
        renderWithContext(<ChannelAttributeLabels channelId={CHANNEL_ID}/>, makeState([field('program')], 'false'));

        expect(screen.queryByTestId('channelAttributeLabels')).not.toBeInTheDocument();
    });

    test('renders chips in sort_order, breaking ties on field name', () => {
        stubWidths(1000);

        renderWithContext(
            <ChannelAttributeLabels channelId={CHANNEL_ID}/>,
            makeState([
                field('zulu', {sortOrder: 2}),
                field('alpha', {sortOrder: 2}),
                field('first', {sortOrder: 1}),
            ]),
        );

        const chips = screen.getAllByTestId('attributeChip');
        expect(chips.map((chip) => chip.textContent)).toEqual([
            'FIRST: FIRST',
            'ALPHA: ALPHA',
            'ZULU: ZULU',
        ]);
    });

    test('shows every chip and no overflow affordance when they all fit', async () => {
        stubWidths(1000);

        renderWithContext(
            <ChannelAttributeLabels channelId={CHANNEL_ID}/>,
            makeState([field('a'), field('b'), field('c')]),
        );

        await waitFor(() => expect(screen.getAllByTestId('attributeChip')).toHaveLength(3));
        expect(screen.queryByTestId('channelAttributeLabelsOverflow')).not.toBeInTheDocument();
    });

    test('collapses the remainder into +N at a narrow width', async () => {
        // Room for one 60px chip plus the reserved +N, not two.
        stubWidths(110);

        renderWithContext(
            <ChannelAttributeLabels channelId={CHANNEL_ID}/>,
            makeState([field('a'), field('b'), field('c')]),
        );

        const overflow = await screen.findByTestId('channelAttributeLabelsOverflow');
        expect(overflow).toHaveTextContent('+2');
        expect(screen.getAllByTestId('attributeChip')).toHaveLength(1);
    });

    test('keeps at least one chip visible, so the header never shows only a count', async () => {
        stubWidths(10);

        renderWithContext(
            <ChannelAttributeLabels channelId={CHANNEL_ID}/>,
            makeState([field('a'), field('b')]),
        );

        await waitFor(() => expect(screen.getByTestId('channelAttributeLabelsOverflow')).toHaveTextContent('+1'));
        expect(screen.getAllByTestId('attributeChip')).toHaveLength(1);
    });

    test('lists the overflowed attributes in the popover', async () => {
        stubWidths(110);

        renderWithContext(
            <ChannelAttributeLabels channelId={CHANNEL_ID}/>,
            makeState([field('a'), field('b'), field('c')]),
        );

        const overflow = await screen.findByTestId('channelAttributeLabelsOverflow');
        await act(async () => {
            overflow.click();
        });

        const popover = await screen.findByTestId('channelAttributeLabelsPopover');
        expect(popover).toHaveTextContent('B');
        expect(popover).toHaveTextContent('C');
    });

    test('is deterministic: the same width yields the same split', async () => {
        stubWidths(110);
        const state = makeState([field('a'), field('b'), field('c')]);

        const first = renderWithContext(<ChannelAttributeLabels channelId={CHANNEL_ID}/>, state);
        const firstCount = (await screen.findByTestId('channelAttributeLabelsOverflow')).textContent;
        first.unmount();

        renderWithContext(<ChannelAttributeLabels channelId={CHANNEL_ID}/>, state);
        expect((await screen.findByTestId('channelAttributeLabelsOverflow')).textContent).toBe(firstCount);
    });
});
