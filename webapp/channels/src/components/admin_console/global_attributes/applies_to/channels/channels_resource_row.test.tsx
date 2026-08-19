// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {DISPLAY_BANNER_TOP, DISPLAY_LABEL_HEADER, DISPLAY_LABEL_INFO} from 'mattermost-redux/constants/properties';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import ChannelsResourceRow from './channels_resource_row';
import type {ChannelResourceConfig} from './types';
import {DEFAULT_CHANNEL_RESOURCE_CONFIG} from './types';

describe('ChannelsResourceRow', () => {
    const renderRow = (overrides: Partial<ChannelResourceConfig> = {}, props: {disabled?: boolean; ordered?: boolean} = {}) => {
        const onChange = jest.fn();
        const onRemove = jest.fn();

        const row = (config: Partial<ChannelResourceConfig>) => (
            <ChannelsResourceRow
                value={{...DEFAULT_CHANNEL_RESOURCE_CONFIG, ...config}}
                onChange={onChange}
                onRemove={onRemove}
                ordered={props.ordered}
                disabled={props.disabled}
            />
        );

        const view = renderWithContext(row(overrides));

        return {
            onChange,
            onRemove,
            rerender: (next: Partial<ChannelResourceConfig>) => view.rerender(row(next)),
        };
    };

    it('offers every display location the server renders, and not the one it does not', () => {
        renderRow();

        expect(screen.getByTestId(`channelsResourceLocation-${DISPLAY_LABEL_HEADER}`)).toBeInTheDocument();
        expect(screen.getByTestId(`channelsResourceLocation-${DISPLAY_LABEL_INFO}`)).toBeInTheDocument();
        expect(screen.getByTestId(`channelsResourceLocation-${DISPLAY_BANNER_TOP}`)).toBeInTheDocument();

        // Validates server-side, but always renders at the top.
        expect(screen.queryByTestId('channelsResourceLocation-display_banner_bottom')).not.toBeInTheDocument();
    });

    it('toggles required', async () => {
        const {onChange} = renderRow({required: false});

        await userEvent.click(screen.getByTestId('channelsResourceRequired-button'));

        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({required: true}));
    });

    it('states the required toggle in words as well as position', () => {
        const {rerender} = renderRow({required: false});
        expect(screen.getByText('Off')).toBeInTheDocument();
        expect(screen.getByText(/^Optional —/)).toBeInTheDocument();

        rerender({required: true});
        expect(screen.getByText('On')).toBeInTheDocument();
        expect(screen.getByText(/^Required —/)).toBeInTheDocument();
    });

    // Every menu-driven case here asserts the selected label, never the open menu:
    // MUI's Popover rejects a jsdom anchor as having no layout. Playwright covers
    // opening them.
    it('shows which change policy is selected', () => {
        const {rerender} = renderRow({changePolicy: 'any'});
        expect(screen.getByTestId('channelsResourceChangePolicyButton')).toHaveTextContent('Can be changed at any time');

        rerender({changePolicy: 'never'});
        expect(screen.getByTestId('channelsResourceChangePolicyButton')).toHaveTextContent('Cannot be changed once set');
    });

    it('explains why raising and lowering are unavailable on an unranked attribute', () => {
        renderRow({}, {ordered: false});

        expect(screen.getByText(/only offered on a Rank attribute/)).toBeInTheDocument();
    });

    it('drops that explanation once the values are ranked', () => {
        renderRow({}, {ordered: true});

        expect(screen.queryByText(/only offered on a Rank attribute/)).not.toBeInTheDocument();
    });

    it('describes a directional policy the attribute can no longer take', () => {
        // Set while the attribute was ranked, then the type changed underneath it.
        renderRow({changePolicy: 'raise_only'}, {ordered: false});

        expect(screen.getByTestId('channelsResourceChangePolicyButton')).toHaveTextContent('Can only be raised, never lowered');
    });

    it('adds a display location', async () => {
        const {onChange} = renderRow({displayLocations: []});

        await userEvent.click(screen.getByTestId(`channelsResourceLocation-${DISPLAY_LABEL_HEADER}`));

        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({displayLocations: [DISPLAY_LABEL_HEADER]}));
    });

    it('removes a display location', async () => {
        const {onChange} = renderRow({displayLocations: [DISPLAY_LABEL_HEADER, DISPLAY_BANNER_TOP]});

        await userEvent.click(screen.getByTestId(`channelsResourceLocation-${DISPLAY_LABEL_HEADER}`));

        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({displayLocations: [DISPLAY_BANNER_TOP]}));
    });

    it('stores display locations in a stable order regardless of tick order', async () => {
        const {onChange} = renderRow({displayLocations: [DISPLAY_BANNER_TOP]});

        await userEvent.click(screen.getByTestId(`channelsResourceLocation-${DISPLAY_LABEL_HEADER}`));

        // Header first, even though Banner was ticked first.
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
            displayLocations: [DISPLAY_LABEL_HEADER, DISPLAY_BANNER_TOP],
        }));
    });

    it('offers no control over who can set the value', () => {
        // Held back until the permissions work lands. The tier itself is still
        // written -- see channel_field_payload.
        renderRow();

        expect(screen.queryByTestId('channelsResourceSetterButton')).not.toBeInTheDocument();
        expect(screen.queryByText('Who can set the value')).not.toBeInTheDocument();
    });

    it('names its icon-only disclosure control', async () => {
        renderRow();

        expect(screen.getByRole('button', {name: 'Collapse channel settings'})).toBeInTheDocument();

        await userEvent.click(screen.getByTestId('channelsResourceRowDisclosure'));

        expect(screen.getByRole('button', {name: 'Expand channel settings'})).toBeInTheDocument();
    });

    it('groups the display locations under their own label', () => {
        renderRow();

        expect(screen.getByRole('group', {name: 'Display location'})).toBeInTheDocument();
    });

    it('summarises its own state for the collapsed view', () => {
        renderRow({
            required: true,
            displayLocations: [DISPLAY_LABEL_HEADER, DISPLAY_LABEL_INFO],
        });

        expect(screen.getByTestId('channelsResourceRowSummary')).toHaveTextContent('Required · Display: Header + Channel Info');
    });

    it('says so in the summary when the attribute is displayed nowhere or locked', () => {
        renderRow({displayLocations: [], changePolicy: 'never'});

        expect(screen.getByTestId('channelsResourceRowSummary')).toHaveTextContent('Optional · Not displayed · Locked once set');
    });

    it('summarises a directional policy too', () => {
        renderRow({changePolicy: 'raise_only', displayLocations: [DISPLAY_LABEL_HEADER]}, {ordered: true});

        expect(screen.getByTestId('channelsResourceRowSummary')).toHaveTextContent('Optional · Display: Header · Raise only');
    });

    it('collapses and expands its body', async () => {
        renderRow();

        expect(screen.getByTestId('channelsResourceRequired-button')).toBeInTheDocument();

        await userEvent.click(screen.getByTestId('channelsResourceRowDisclosure'));

        expect(screen.queryByTestId('channelsResourceRequired-button')).not.toBeInTheDocument();
        expect(screen.getByTestId('channelsResourceRowSummary')).toBeInTheDocument();
    });

    it('removes the resource', async () => {
        const {onRemove} = renderRow();

        await userEvent.click(screen.getByTestId('channelsResourceRowRemove'));

        expect(onRemove).toHaveBeenCalled();
    });

    it('does not accept changes while disabled', async () => {
        const {onChange, onRemove} = renderRow({}, {disabled: true});

        await userEvent.click(screen.getByTestId(`channelsResourceLocation-${DISPLAY_LABEL_HEADER}`));
        await userEvent.click(screen.getByTestId('channelsResourceRowRemove'));

        expect(onChange).not.toHaveBeenCalled();
        expect(onRemove).not.toHaveBeenCalled();
    });
});
