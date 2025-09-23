// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import {act} from 'react-dom/test-utils';

import type {AccessControlPolicy} from '@mattermost/types/access_control';

import type {ActionResult} from 'mattermost-redux/types/actions';

import type {Column} from 'components/admin_console/data_grid/data_grid';

import PolicyList from './policies';

const mockHistoryPushInternal = jest.fn();
jest.mock('utils/browser_history', () => ({
    getHistory: () => ({
        push: mockHistoryPushInternal,
    }),
}));

describe('components/admin_console/access_control/PolicyList', () => {
    const mockSearchPolicies = jest.fn();
    const mockDeletePolicy = jest.fn();
    const defaultProps = {
        actions: {
            searchPolicies: mockSearchPolicies,
            deletePolicy: mockDeletePolicy,
        },
    };

    beforeEach(() => {
        mockSearchPolicies.mockReset();
        mockDeletePolicy.mockReset();
        mockHistoryPushInternal.mockReset();
    });

    test('should match snapshot with no policies', async () => {
        mockSearchPolicies.mockResolvedValue({data: {policies: [], total: 0}} as ActionResult);
        const wrapper = shallow(<PolicyList {...defaultProps}/>);
        await act(async () => {
            await Promise.resolve();
        });
        wrapper.update();
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with policies', async () => {
        mockSearchPolicies.mockResolvedValue({
            data: {
                policies: [
                    {id: 'policy1', name: 'Policy 1'} as AccessControlPolicy,
                    {id: 'policy2', name: 'Policy 2'} as AccessControlPolicy,
                ],
                total: 2,
            },
        } as ActionResult);
        const wrapper = shallow(<PolicyList {...defaultProps}/>);
        await act(async () => {
            await Promise.resolve();
        });
        wrapper.update();
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with search error', async () => {
        mockSearchPolicies.mockRejectedValue(new Error('Search failed'));
        const wrapper = shallow(<PolicyList {...defaultProps}/>);
        await act(async () => {
            await Promise.resolve();
        });
        wrapper.update();
        expect(wrapper).toMatchSnapshot();
    });

    test('should not call previousPage if no history', async () => {
        mockSearchPolicies.mockResolvedValueOnce({data: {policies: [], total: 0}} as ActionResult);
        const wrapper = shallow(<PolicyList {...defaultProps}/>);
        await act(async () => {
            await Promise.resolve();
        });
        wrapper.update();

        mockSearchPolicies.mockClear(); // Clear calls from mount

        await act(async () => {
            (wrapper.find('DataGrid').props() as any).previousPage();
        });
        wrapper.update();

        expect(mockSearchPolicies).not.toHaveBeenCalled();
        expect(wrapper.find('DataGrid').prop('page')).toBe(0);
    });

    test('should get columns correctly', () => {
        const wrapper = shallow(<PolicyList {...defaultProps}/>);

        // Columns are determined synchronously
        const columns = wrapper.find('DataGrid').prop('columns') as Column[];
        expect(columns).toHaveLength(3);
        expect(columns[0].field).toBe('name');
        expect(columns[1].field).toBe('resources');
        expect(columns[2].field).toBe('actions');
    });
});
