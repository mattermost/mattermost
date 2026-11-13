// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import LoadingImagePreview from 'components/loading_image_preview';

import {render, screen} from 'tests/react_testing_utils';

describe('components/LoadingImagePreview', () => {
    test('should render with progress 50%', () => {
        render(
            <LoadingImagePreview
                loading='Loading'
                progress={50}
            />,
        );
        expect(screen.getByText('Loading 50%')).toBeInTheDocument();
    });

    test('should render with progress 90%', () => {
        render(
            <LoadingImagePreview
                loading='Loading'
                progress={90}
            />,
        );
        expect(screen.getByText('Loading 90%')).toBeInTheDocument();
    });
});
