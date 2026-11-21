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
                testId='fixture.banner_preview'
                template='{{classification}} · {{program}}'
                attributes={[attribute('classification', 'TOP SECRET'), attribute('program', 'AURORA')]}
            />,
        );

        expect(screen.getByTestId('fixture.banner_preview')).toHaveTextContent('TOP SECRET · AURORA');
    });

    test('passes a literal through untouched', () => {
        renderWithContext(
            <BannerPreview
                testId='fixture.banner_preview'
                template='Handle with care'
                attributes={[]}
            />,
        );

        expect(screen.getByTestId('fixture.banner_preview')).toHaveTextContent('Handle with care');
    });

    test('shows a warning notice and hides the preview bar when nothing resolves', () => {
        renderWithContext(
            <BannerPreview
                testId='fixture.banner_preview'
                template='{{program}}'
                attributes={[attribute('program', '')]}
            />,
        );

        expect(screen.queryByTestId('fixture.banner_preview')).not.toBeInTheDocument();
        expect(screen.getByTestId('fixture.banner_preview.empty_notice')).toHaveTextContent(
            'The banner will not be displayed',
        );
        expect(screen.getByTestId('fixture.banner_preview.empty_notice')).toHaveTextContent(
            "There's nothing to display until the attributes in the banner text have values.",
        );
    });

    // Two tokens that resolve to nothing leave the space between them behind.
    test('shows the empty notice when unresolved tokens leave only whitespace', () => {
        renderWithContext(
            <BannerPreview
                testId='fixture.banner_preview'
                template='{{graph_option}} {{classification}}'
                attributes={[]}
            />,
        );

        expect(screen.queryByTestId('fixture.banner_preview')).not.toBeInTheDocument();
        expect(screen.getByTestId('fixture.banner_preview.empty_notice')).toBeInTheDocument();
    });

    test('asks for text, rather than values, when the template has no attributes', () => {
        renderWithContext(
            <BannerPreview
                testId='fixture.banner_preview'
                template=' · '
                attributes={[]}
            />,
        );

        expect(screen.getByTestId('fixture.banner_preview.empty_notice')).toHaveTextContent('Add banner text to display a banner.');
    });

    test('hides the empty notice once the template resolves to text', () => {
        renderWithContext(
            <BannerPreview
                testId='fixture.banner_preview'
                template='Handle with care'
                attributes={[]}
            />,
        );

        expect(screen.queryByTestId('fixture.banner_preview.empty_notice')).not.toBeInTheDocument();
        expect(screen.getByTestId('fixture.banner_preview')).toBeInTheDocument();
    });

    test('shows the empty notice when only whitespace resolves', () => {
        renderWithContext(
            <BannerPreview
                testId='fixture.banner_preview'
                template='  {{program}}  '
                attributes={[attribute('program', '')]}
            />,
        );

        expect(screen.getByTestId('fixture.banner_preview.empty_notice')).toBeInTheDocument();
        expect(screen.queryByTestId('fixture.banner_preview')).not.toBeInTheDocument();
    });

    test('paints itself in the banner colour, with contrasting text', () => {
        renderWithContext(
            <BannerPreview
                testId='fixture.banner_preview'
                template='SECRET'
                attributes={[]}
                backgroundColor='#1e325c'
            />,
        );

        const preview = screen.getByTestId('fixture.banner_preview');
        expect(preview).toHaveStyle({backgroundColor: '#1e325c'});
        expect(preview).toHaveStyle({color: '#ffffff'});
    });
});
