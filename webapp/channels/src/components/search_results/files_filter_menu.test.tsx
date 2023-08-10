// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import FilesFilterMenu from 'components/search_results/files_filter_menu';

import type {ShallowWrapper} from 'enzyme';

describe('components/search_results/FilesFilterMenu', () => {
    const filters = ['all', 'documents', 'spreadsheets', 'presentations', 'code', 'images', 'audio', 'video'];
    for (const filter of filters) {
        test(`should match snapshot, on ${filter} filter selected`, () => {
            const wrapper: ShallowWrapper<any, any, any> = shallow(
                <FilesFilterMenu
                    selectedFilter={filter}
                    onFilter={jest.fn()}
                />,
            );

            expect(wrapper).toMatchSnapshot();
        });
    }
});
