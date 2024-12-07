// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen, render} from '@testing-library/react';

import LoadingImagePreview from 'components/loading_image_preview';

describe('components/LoadingImagePreview', () => {
    test('should render loading text with progress', () => {
        const loading = 'Loading';
        let progress = 50;

        const {rerender} = render(
            <LoadingImagePreview
                loading={loading}
                progress={progress}
            />,
        );

        expect(screen.getByText('Loading 50%')).toBeInTheDocument();

        progress = 90;
        rerender(
            <LoadingImagePreview
                loading={loading}
                progress={progress}
            />,
        );

        expect(screen.getByText('Loading 90%')).toBeInTheDocument();
    });
});
