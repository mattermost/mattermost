// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {PropertyField} from '@mattermost/types/properties';

import type {ResolvedChannelAttribute} from 'mattermost-redux/selectors/entities/properties';

import {renderWithContext} from 'tests/react_testing_utils';

import BannerPreview from './banner_preview';

function attribute(name: string, displayValue: string): ResolvedChannelAttribute {
    const field = {
        id: `field_${name}`,
        group_id: 'group1',
        name,
        type: 'select',
        target_id: '',
        target_type: 'system',
        object_type: 'channel',
        attrs: {},
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: '',
        updated_by: '',
    } as PropertyField;

    return {field, displayValue, displayValues: [displayValue]};
}

describe('BannerPreview', () => {
    test('renders what the template resolves to for this channel', () => {
        renderWithContext(
            <BannerPreview
                template='{{classification}} · {{program}}'
                attributes={[attribute('classification', 'TOP SECRET'), attribute('program', 'AURORA')]}
            />,
        );

        expect(screen.getByTestId('bannerAttributePreview')).toHaveTextContent('TOP SECRET · AURORA');
    });

    test('passes a literal through untouched', () => {
        renderWithContext(
            <BannerPreview
                template='Handle with care'
                attributes={[]}
            />,
        );

        expect(screen.getByTestId('bannerAttributePreview')).toHaveTextContent('Handle with care');
    });

    test('shows a warning notice and hides the preview bar when nothing resolves', () => {
        renderWithContext(
            <BannerPreview
                template='{{program}}'
                attributes={[attribute('program', '')]}
            />,
        );

        expect(screen.queryByTestId('bannerAttributePreview')).not.toBeInTheDocument();
        expect(screen.getByTestId('bannerPreviewEmptyNotice')).toHaveTextContent(
            'The banner will not be displayed',
        );
        expect(screen.getByTestId('bannerPreviewEmptyNotice')).toHaveTextContent(
            "There's nothing to display until the attributes in the banner text have values.",
        );
    });

    test('hides the empty notice once the template resolves to text', () => {
        renderWithContext(
            <BannerPreview
                template='Handle with care'
                attributes={[]}
            />,
        );

        expect(screen.queryByTestId('bannerPreviewEmptyNotice')).not.toBeInTheDocument();
        expect(screen.getByTestId('bannerAttributePreview')).toBeInTheDocument();
    });

    test('paints itself in the banner colour, with contrasting text', () => {
        renderWithContext(
            <BannerPreview
                template='SECRET'
                attributes={[]}
                backgroundColor='#1e325c'
            />,
        );

        const preview = screen.getByTestId('bannerAttributePreview');
        expect(preview).toHaveStyle({backgroundColor: '#1e325c'});
        expect(preview).toHaveStyle({color: '#ffffff'});
    });
});
