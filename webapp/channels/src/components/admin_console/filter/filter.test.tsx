// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import Filter from 'components/admin_console/filter/filter';
import type {FilterOptions} from 'components/admin_console/filter/filter';

// import {renderWithContext} from 'tests/react_testing_utils';

describe('components/filter', () => {
    test('should only count true, resets all to false', async () => {
        const options: FilterOptions = {
            channels: {
                name: 'Channels',
                values: {
                    public: {
                        name: 'Public',
                        value: true,
                    },
                    private: {
                        name: 'Private',
                        value: true,
                    },
                    deleted: {
                        name: 'Archive',
                        value: false,
                    },
                },
                keys: ['public', 'private', 'deleted'],
            },
        };

        const onFilter = jest.fn();
        const filterProps = {
            options,
            keys: ['channels'],
            onFilter,
        };

        const wrapper = shallow<Filter>(<Filter {...filterProps}/>);

        expect(wrapper.instance().state.filterCount).toBe(2);
        wrapper.instance().resetFilters();
        expect(onFilter).toHaveBeenCalled();
        expect(wrapper.instance().state.filterCount).toBe(0);
    });
});
