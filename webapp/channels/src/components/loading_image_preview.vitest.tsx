// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen} from '@testing-library/react';
import React from 'react';
import {describe, test, expect} from 'vitest';

import LoadingImagePreview from 'components/loading_image_preview';

describe('components/LoadingImagePreview', () => {
    test('should match snapshot', () => {
        const loading = 'Loading';
        const progress = 50;

        const {container, rerender} = render(
            <LoadingImagePreview
                loading={loading}
                progress={progress}
            />,
        );

        expect(container).toMatchSnapshot();
        expect(screen.getByText('Loading 50%')).toBeInTheDocument();

        // Test with updated progress
        rerender(
            <LoadingImagePreview
                loading={loading}
                progress={90}
            />,
        );

        expect(container).toMatchSnapshot();
        expect(screen.getByText('Loading 90%')).toBeInTheDocument();
    });
});
