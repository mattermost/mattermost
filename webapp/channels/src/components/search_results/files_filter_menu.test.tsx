// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import FilesFilterMenu from 'components/search_results/files_filter_menu';

import {renderWithContext} from 'tests/react_testing_utils';

describe('components/search_results/FilesFilterMenu', () => {
    const filters = ['all', 'documents', 'spreadsheets', 'presentations', 'code', 'images', 'audio', 'video'];
    for (const filter of filters) {
        test(`should match snapshot, on ${filter} filter selected`, () => {
            const {container} = renderWithContext(
                <FilesFilterMenu
                    selectedFilter={filter}
                    onFilter={jest.fn()}
                />,
            );

            expect(container).toMatchSnapshot();
        });
    }
});
