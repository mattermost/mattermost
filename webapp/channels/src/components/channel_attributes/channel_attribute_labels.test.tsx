// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, screen, waitFor} from '@testing-library/react';
import React from 'react';

import type {PropertyField, PropertyFieldOption, PropertyValue} from '@mattermost/types/properties';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';

import * as rhsActions from 'actions/views/rhs';

import {clearPropertyFieldOptionWalks, pageAllAccessControlFieldOptions} from 'components/property_fields/graph/page_all_access_control_field_options';
import {clearGraphOptionNameCache} from 'components/property_fields/graph/use_graph_option_names';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import ChannelAttributeLabels from './channel_attribute_labels';
import {setChannelAttributeValue} from './set_channel_attribute_value';

jest.mock('mattermost-redux/actions/properties', () => ({
    fetchPropertyFields: jest.fn(() => () => Promise.resolve({data: []})),
}));

jest.mock('components/property_fields/graph/page_all_access_control_field_options', () => ({
    ...jest.requireActual('components/property_fields/graph/page_all_access_control_field_options'),
    pageAllAccessControlFieldOptions: jest.fn(),
}));

const mockPageAll = jest.mocked(pageAllAccessControlFieldOptions);

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

// Graph fields carry a truncated option list, so a chip shows the raw option id
// until the picker's own fetch lands and names it.
function graphField(id: string): PropertyField {
    const graph = field(id);
    return {
        ...graph,
        type: 'graph',
        attrs: {...graph.attrs, options: undefined, options_omitted: true},
    };
}

function value(fieldId: string, raw?: unknown): PropertyValue<unknown> {
    return {
        id: `value_${fieldId}`,
        target_id: CHANNEL_ID,
        target_type: 'channel',
        group_id: GROUP_ID,
        field_id: fieldId,
        value: raw === undefined ? `opt_${fieldId}` : raw,
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
        byTargetId[CHANNEL_ID][f.id] = value(f.id, f.type === 'graph' ? [`opt_${f.id}`] : undefined);
    }

    return {
        entities: {
            general: {
                config: {FeatureFlagChannelAttributes: flag},
                license: {IsLicensed: 'true', SkuShortName: 'advanced'},
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

// jsdom does not lay out, so widths are stubbed. Overflow is measured from the
// parent (space left by siblings), so the parent of ChannelAttributeLabels
// reports `containerWidth` and every chip a fixed width.
function stubWidths(containerWidth: number, chipWidth = 60) {
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
        const isLabels = this.classList.contains('ChannelAttributeLabels');
        const isParentOfLabels = Boolean(this.querySelector?.(':scope > .ChannelAttributeLabels'));
        return {width: isLabels || isParentOfLabels ? containerWidth : chipWidth} as DOMRect;
    });
}

describe('ChannelAttributeLabels', () => {
    beforeEach(() => {
        clearPropertyFieldOptionWalks();
        clearGraphOptionNameCache();
        mockPageAll.mockImplementation(() => {
            throw new Error('pageAllAccessControlFieldOptions called without an explicit mock for this test');
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('renders the info slot from its own action, not the header one', () => {
        stubWidths(1000);
        const info = field('program');
        info.attrs = {...info.attrs, actions: ['display_label_info']};

        renderWithContext(
            <ChannelAttributeLabels
                channelId={CHANNEL_ID}
                surface='info'
            />,
            makeState([info]),
        );

        expect(screen.getByTestId('channelAttributeLabels-info')).toBeInTheDocument();
        expect(screen.queryByTestId('channelAttributeLabels-header')).not.toBeInTheDocument();
    });

    test('renders chips from every requested surface in one row', async () => {
        stubWidths(1000);
        const info = field('program');
        info.attrs = {...info.attrs, actions: ['display_label_info']};

        renderWithContext(
            <ChannelAttributeLabels
                channelId={CHANNEL_ID}
                surface={['info', 'header']}
            />,
            makeState([info, field('classification')]),
        );

        await waitFor(() => expect(screen.getAllByTestId('attributeChip')).toHaveLength(2));
        expect(screen.getByTestId('channelAttributeLabels-info-header')).toBeInTheDocument();
        expect(screen.queryByTestId('channelAttributeLabelsOverflow-info-header')).not.toBeInTheDocument();
    });

    test('renders nothing when no attribute is designated for the header', () => {
        const plain = field('program');
        plain.attrs = {...plain.attrs, actions: ['display_label_info']};

        renderWithContext(
            <ChannelAttributeLabels
                channelId={CHANNEL_ID}
                surface='header'
            />,
            makeState([plain]),
        );

        expect(screen.queryByTestId('channelAttributeLabels-header')).not.toBeInTheDocument();
    });

    test('renders nothing when the feature flag is off', () => {
        renderWithContext(
            <ChannelAttributeLabels
                channelId={CHANNEL_ID}
                surface='header'
            />,
            makeState([field('program')], 'false'),
        );

        expect(screen.queryByTestId('channelAttributeLabels-header')).not.toBeInTheDocument();
    });

    test('renders chips in sort_order, breaking ties on field name', () => {
        stubWidths(1000);

        renderWithContext(
            <ChannelAttributeLabels
                channelId={CHANNEL_ID}
                surface='header'
            />,
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
            <ChannelAttributeLabels
                channelId={CHANNEL_ID}
                surface='header'
            />,
            makeState([field('a'), field('b'), field('c')]),
        );

        await waitFor(() => expect(screen.getAllByTestId('attributeChip')).toHaveLength(3));
        expect(screen.getAllByTestId('attributeChip')[0]).toHaveClass('AttributeChip--medium');
        expect(screen.queryByTestId('channelAttributeLabelsOverflow-header')).not.toBeInTheDocument();
    });

    test('collapses the remainder into +N at a narrow width', async () => {
        // Room for one 60px chip plus the reserved +N, not two.
        stubWidths(110);

        renderWithContext(
            <ChannelAttributeLabels
                channelId={CHANNEL_ID}
                surface='header'
            />,
            makeState([field('a'), field('b'), field('c')]),
        );

        const overflow = await screen.findByTestId('channelAttributeLabelsOverflow-header');
        expect(overflow).toHaveTextContent('+2');
        expect(screen.getAllByTestId('attributeChip')).toHaveLength(1);
    });

    test('keeps at least one chip visible, so the header never shows only a count', async () => {
        stubWidths(10);

        renderWithContext(
            <ChannelAttributeLabels
                channelId={CHANNEL_ID}
                surface='header'
            />,
            makeState([field('a'), field('b')]),
        );

        await waitFor(() => expect(screen.getByTestId('channelAttributeLabelsOverflow-header')).toHaveTextContent('+1'));
        expect(screen.getAllByTestId('attributeChip')).toHaveLength(1);
    });

    test('in the thread header, overflows every chip into +N when none fit', async () => {
        stubWidths(10);

        renderWithContext(
            <ChannelAttributeLabels
                channelId={CHANNEL_ID}
                surface='header'
                allowEmptyVisible={true}
            />,
            makeState([field('a'), field('b'), field('c')]),
        );

        const overflow = await screen.findByTestId('channelAttributeLabelsOverflow-header');
        expect(overflow).toHaveTextContent('+3');
        expect(screen.queryByTestId('attributeChip')).not.toBeInTheDocument();
    });

    test('in the thread header, the channel name yields so chips are not squeezed out', async () => {
        // Room for one 60px chip plus +N. A 60px channel-name sibling would
        // consume that leftover if counted, collapsing every chip into +3.
        stubWidths(110);

        renderWithContext(
            <div className='sidebar--right__title'>
                <button
                    type='button'
                    className='sidebar--right__title__channel'
                >
                    {'Off-Topic'}
                </button>
                <ChannelAttributeLabels
                    channelId={CHANNEL_ID}
                    surface='header'
                    allowEmptyVisible={true}
                />
            </div>,
            makeState([field('a'), field('b'), field('c')]),
        );

        const overflow = await screen.findByTestId('channelAttributeLabelsOverflow-header');
        expect(overflow).toHaveTextContent('+2');
        expect(screen.getAllByTestId('attributeChip')).toHaveLength(1);
    });

    test('lists the overflowed attributes in the popover', async () => {
        stubWidths(110);

        renderWithContext(
            <ChannelAttributeLabels
                channelId={CHANNEL_ID}
                surface='header'
            />,
            makeState([field('a'), field('b'), field('c')]),
        );

        const overflow = await screen.findByTestId('channelAttributeLabelsOverflow-header');
        await act(async () => {
            overflow.click();
        });

        const popover = await screen.findByTestId('channelAttributeLabelsPopover-header');
        expect(popover).toHaveTextContent('B');
        expect(popover).toHaveTextContent('C');
        expect(screen.getByTestId('channelAttributeLabelsViewAll-header')).toHaveTextContent('View all attributes');
    });

    // Regression: labels arrive after mount, so the split state starts life sized
    // for an empty list. If that stale index survives, every chip counts as
    // overflow — and because the measured row then contains nothing, it has zero
    // width, so no measurement ever corrects it. The header showed "+1" and no
    // chip at all. Found by the e2e suite; jsdom hid it because widths are stubbed.
    test('never renders an overflow count with no chips beside it', async () => {
        jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({width: 0} as DOMRect);

        renderWithContext(
            <ChannelAttributeLabels
                channelId={CHANNEL_ID}
                surface='header'
            />,
            makeState([field('a')]),
        );

        await waitFor(() => expect(screen.getAllByTestId('attributeChip')).toHaveLength(1));
        expect(screen.queryByTestId('channelAttributeLabelsOverflow-header')).not.toBeInTheDocument();
    });

    test('is deterministic: the same width yields the same split', async () => {
        stubWidths(110);
        const state = makeState([field('a'), field('b'), field('c')]);

        const first = renderWithContext(
            <ChannelAttributeLabels
                channelId={CHANNEL_ID}
                surface='header'
            />,
            state,
        );
        const firstCount = (await screen.findByTestId('channelAttributeLabelsOverflow-header')).textContent;
        first.unmount();

        renderWithContext(
            <ChannelAttributeLabels
                channelId={CHANNEL_ID}
                surface='header'
            />,
            state,
        );
        expect((await screen.findByTestId('channelAttributeLabelsOverflow-header')).textContent).toBe(firstCount);
    });

    test('opens channel info when a chip is clicked', async () => {
        stubWidths(1000);
        const showChannelInfo = jest.spyOn(rhsActions, 'showChannelInfo');

        renderWithContext(
            <ChannelAttributeLabels
                channelId={CHANNEL_ID}
                surface='header'
            />,
            makeState([field('program')]),
        );

        await userEvent.click(await screen.findByTestId('attributeChip'));
        expect(showChannelInfo).toHaveBeenCalledWith(CHANNEL_ID);
    });

    test('opens channel info when an overflowed chip is clicked', async () => {
        stubWidths(110);
        const showChannelInfo = jest.spyOn(rhsActions, 'showChannelInfo');

        renderWithContext(
            <ChannelAttributeLabels
                channelId={CHANNEL_ID}
                surface='header'
            />,
            makeState([field('a'), field('b'), field('c')]),
        );

        const overflow = await screen.findByTestId('channelAttributeLabelsOverflow-header');
        await act(async () => {
            overflow.click();
        });

        const popover = await screen.findByTestId('channelAttributeLabelsPopover-header');
        await userEvent.click(popover.querySelector('[data-testid="attributeChip"]')!);
        expect(showChannelInfo).toHaveBeenCalledWith(CHANNEL_ID);
    });

    test('shows every chip when the title row has room after a 100px header-text floor', async () => {
        jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
            if (this.classList.contains('channel-header__title')) {
                return {width: 1000} as DOMRect;
            }
            if (this.classList.contains('channel-header__top')) {
                return {width: 80} as DOMRect;
            }

            // Greedy description: leftover after the name. Chips must still use
            // the 100px floor, not this inflated width, or they stay collapsed.
            if (this.classList.contains('channel-header__description')) {
                return {width: 700} as DOMRect;
            }
            return {width: 60} as DOMRect;
        });

        renderWithContext(
            <div className='channel-header__title'>
                <div className='channel-header__top'/>
                <div className='channel-header__icons'>
                    <ChannelAttributeLabels
                        channelId={CHANNEL_ID}
                        surface='header'
                    />
                </div>
                <div className='channel-header__description'>
                    {'Testing a long channel header and how it looks'}
                </div>
            </div>,
            makeState([field('a'), field('b'), field('c')]),
        );

        await waitFor(() => expect(screen.getAllByTestId('attributeChip')).toHaveLength(3));
        expect(screen.queryByTestId('channelAttributeLabelsOverflow-header')).not.toBeInTheDocument();
    });

    // Regression: the row was hidden until re-measured whenever the chip id array
    // was rebuilt, and it is rebuilt on every value change and every graph name
    // that resolves. Editing one attribute blanked the whole row for a debounce.
    describe('does not blank the row when the chips themselves are unchanged', () => {
        test('while one attribute takes a new value', async () => {
            stubWidths(1000);

            const classification = field('classification');
            classification.attrs = {
                ...classification.attrs,
                options: [
                    {id: 'opt_classification', name: 'CONFIDENTIAL'},
                    {id: 'opt_raised', name: 'PROTECTED B'},
                ],
            };

            const {store} = renderWithContext(
                <ChannelAttributeLabels
                    channelId={CHANNEL_ID}
                    surface='header'
                />,
                makeState([classification, field('vegetables')]),
            );

            const row = await screen.findByTestId('channelAttributeLabels-header');
            await waitFor(() => expect(row).toBeVisible());

            const raised = value('classification', 'opt_raised');
            jest.spyOn(Client4, 'patchPropertyValues').mockResolvedValue([raised]);

            await act(async () => {
                await setChannelAttributeValue(store.dispatch, CHANNEL_ID, classification.id, 'opt_raised');
            });

            expect(row).toBeVisible();
            expect(screen.getAllByTestId('attributeChip').map((chip) => chip.textContent)).toEqual([
                'CLASSIFICATION: PROTECTED B',
                'VEGETABLES: VEGETABLES',
            ]);
        });

        test('while a graph attribute resolves its option names', async () => {
            stubWidths(1000);

            let landOptions: (options: PropertyFieldOption[]) => void = () => {};
            mockPageAll.mockReturnValue(new Promise((resolve) => {
                landOptions = resolve;
            }));

            renderWithContext(
                <ChannelAttributeLabels
                    channelId={CHANNEL_ID}
                    surface='header'
                />,
                makeState([graphField('programs'), field('vegetables')]),
            );

            const row = await screen.findByTestId('channelAttributeLabels-header');
            await waitFor(() => expect(row).toBeVisible());
            expect(screen.getAllByTestId('attributeChip').map((chip) => chip.textContent)).toEqual([
                'PROGRAMS: opt_programs',
                'VEGETABLES: VEGETABLES',
            ]);

            await act(async () => {
                landOptions([{id: 'opt_programs', name: 'Apollo', parents: [], create_at: 1}]);
            });

            expect(row).toBeVisible();
            expect(screen.getAllByTestId('attributeChip').map((chip) => chip.textContent)).toEqual([
                'PROGRAMS: Apollo',
                'VEGETABLES: VEGETABLES',
            ]);
        });
    });

    // The other direction: a chip the row has never measured must not be sized by
    // the split left over from the smaller set, which would render a phantom +N.
    test('blanks the row and re-measures when an attribute gains a chip', async () => {
        stubWidths(1000);

        const state = makeState([field('a'), field('b'), field('c'), field('d')]);
        delete state.entities!.properties!.values!.byTargetId![CHANNEL_ID]!.d;

        const {store} = renderWithContext(
            <ChannelAttributeLabels
                channelId={CHANNEL_ID}
                surface='header'
            />,
            state,
        );

        const row = await screen.findByTestId('channelAttributeLabels-header');
        await waitFor(() => expect(row).toBeVisible());
        expect(screen.getAllByTestId('attributeChip')).toHaveLength(3);

        jest.spyOn(Client4, 'patchPropertyValues').mockResolvedValue([value('d')]);

        await act(async () => {
            await setChannelAttributeValue(store.dispatch, CHANNEL_ID, 'd', 'opt_d');
        });

        expect(row).not.toBeVisible();

        await waitFor(() => expect(row).toBeVisible());
        expect(screen.getAllByTestId('attributeChip').map((chip) => chip.textContent)).toEqual([
            'A: A',
            'B: B',
            'C: C',
            'D: D',
        ]);
        expect(screen.queryByTestId('channelAttributeLabelsOverflow-header')).not.toBeInTheDocument();
    });

    test('in the thread header, chips read as labels because Channel Info cannot open there', async () => {
        stubWidths(110);
        const showChannelInfo = jest.spyOn(rhsActions, 'showChannelInfo');

        renderWithContext(
            <ChannelAttributeLabels
                channelId={CHANNEL_ID}
                surface='header'
                interactive={false}
            />,
            makeState([field('a'), field('b'), field('c')]),
        );

        const chip = await screen.findByTestId('attributeChip');
        expect(chip.closest('button')).toBeNull();
        await userEvent.click(chip);

        const overflow = await screen.findByTestId('channelAttributeLabelsOverflow-header');
        await act(async () => {
            overflow.click();
        });

        // The overflowed values are still readable, but nothing in the popover
        // offers to open a panel that would never load.
        const popover = await screen.findByTestId('channelAttributeLabelsPopover-header');
        expect(popover).toHaveTextContent('B');
        expect(popover.querySelector('button')).toBeNull();
        expect(screen.queryByTestId('channelAttributeLabelsViewAll-header')).not.toBeInTheDocument();

        expect(showChannelInfo).not.toHaveBeenCalled();
    });

    test('opens channel info from View all attributes', async () => {
        stubWidths(110);
        const showChannelInfo = jest.spyOn(rhsActions, 'showChannelInfo');

        renderWithContext(
            <ChannelAttributeLabels
                channelId={CHANNEL_ID}
                surface='header'
            />,
            makeState([field('a'), field('b'), field('c')]),
        );

        const overflow = await screen.findByTestId('channelAttributeLabelsOverflow-header');
        await act(async () => {
            overflow.click();
        });

        await userEvent.click(await screen.findByTestId('channelAttributeLabelsViewAll-header'));
        expect(showChannelInfo).toHaveBeenCalledWith(CHANNEL_ID);
    });
});
