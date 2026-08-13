// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import type {PropertyField} from '@mattermost/types/properties';

import type {ResolvedChannelAttribute} from 'mattermost-redux/selectors/entities/properties';

import {renderWithContext} from 'tests/react_testing_utils';

import BannerTokenControls from './banner_token_controls';

function attribute(name: string, displayValue: string, displayName?: string): ResolvedChannelAttribute {
    const field = {
        id: `field_${name}`,
        group_id: 'group1',
        name,
        type: 'select',
        target_id: '',
        target_type: 'system',
        object_type: 'channel',
        attrs: displayName ? {display_name: displayName} : {},
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: '',
        updated_by: '',
    } as PropertyField;

    return {field, displayValue};
}

// jsdom performs no layout, so every element reports a zero-size rect and MUI's
// popover rejects the anchor. Giving the anchor a size is a test-environment
// concession, not a product concern.
function stubLayout() {
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
        width: 120,
        height: 24,
        top: 0,
        left: 0,
        right: 120,
        bottom: 24,
        x: 0,
        y: 0,
        toJSON: () => ({}),
    } as DOMRect);
}

describe('BannerTokenControls', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('renders nothing when the channel has no attributes to offer', () => {
        renderWithContext(
            <BannerTokenControls
                template=''
                attributes={[]}
                onInsertToken={jest.fn()}
            />,
        );

        expect(screen.queryByTestId('bannerAttributeTokenButton')).not.toBeInTheDocument();
    });

    test('offers each attribute by its display name and inserts its machine-name token', async () => {
        stubLayout();
        const onInsertToken = jest.fn();

        renderWithContext(
            <BannerTokenControls
                template=''
                attributes={[attribute('caveat', 'NOFORN', 'Caveat / Releasability')]}
                onInsertToken={onInsertToken}
            />,
        );

        await userEvent.click(screen.getByTestId('bannerAttributeTokenButton'));

        const items = await screen.findAllByRole('menuitem');
        const caveat = items.find((item) => item.textContent?.includes('Caveat / Releasability'));
        await userEvent.click(caveat!);

        // Menu.Item defers onClick until the menu's close animation finishes, so
        // this has to be awaited rather than asserted synchronously.
        //
        // The token keys on the machine name so renaming the display name cannot
        // empty an existing banner.
        await waitFor(() => expect(onInsertToken).toHaveBeenCalledWith('{{caveat}}'));
    });

    test('shows no preview until the template references an attribute', () => {
        renderWithContext(
            <BannerTokenControls
                template='**TOP SECRET**'
                attributes={[attribute('program', 'AURORA')]}
                onInsertToken={jest.fn()}
            />,
        );

        expect(screen.queryByTestId('bannerAttributePreview')).not.toBeInTheDocument();
    });

    test('previews what the template resolves to for this channel', async () => {
        renderWithContext(
            <BannerTokenControls
                template='{{classification}} · {{program}}'
                attributes={[attribute('classification', 'TOP SECRET'), attribute('program', 'AURORA')]}
                onInsertToken={jest.fn()}
            />,
        );

        await waitFor(() => expect(screen.getByTestId('bannerAttributePreview')).toHaveTextContent('Renders as: TOP SECRET · AURORA'));
    });

    test('says so when every referenced attribute is unset, rather than showing a blank line', async () => {
        renderWithContext(
            <BannerTokenControls
                template='{{program}}'
                attributes={[attribute('program', '')]}
                onInsertToken={jest.fn()}
            />,
        );

        await waitFor(() => expect(screen.getByTestId('bannerAttributePreview')).toHaveTextContent('nothing yet'));
    });

    test('disables insertion when the banner fields are locked', () => {
        renderWithContext(
            <BannerTokenControls
                template=''
                attributes={[attribute('program', 'AURORA')]}
                onInsertToken={jest.fn()}
                disabled={true}
            />,
        );

        expect(screen.getByTestId('bannerAttributeTokenButton')).toBeDisabled();
    });
});
