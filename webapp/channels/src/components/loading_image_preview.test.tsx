// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import LoadingImagePreview from 'components/loading_image_preview';

import {render, screen} from 'tests/react_testing_utils';

describe('components/LoadingImagePreview', () => {
    test('should match snapshot with progress 50%', () => {
        const {container} = render(
            <LoadingImagePreview
                loading='Loading'
                progress={50}
            />,
        );

        expect(container).toMatchSnapshot();
        expect(screen.getByText('Loading 50%')).toBeInTheDocument();
    });

    test('should match snapshot with progress 90%', () => {
        const {container} = render(
            <LoadingImagePreview
                loading='Loading'
                progress={90}
            />,
        );

        expect(container).toMatchSnapshot();
        expect(screen.getByText('Loading 90%')).toBeInTheDocument();
    });
});
