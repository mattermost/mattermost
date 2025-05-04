// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {AccessControlPolicy} from '@mattermost/types/access_control';

import type {ActionResult} from 'mattermost-redux/types/actions';

import PolicyList from './policies';

jest.mock('utils/browser_history', () => ({
    getHistory: () => ({
        push: jest.fn(),
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
    });

    test('should match snapshot with no policies', () => {
        const wrapper = shallow(<PolicyList {...defaultProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with policies', () => {
        const wrapper = shallow(<PolicyList {...defaultProps}/>);

        // Set state with mock policies
        wrapper.setState({
            policies: [
                {id: 'policy1', name: 'Policy 1'} as AccessControlPolicy,
                {id: 'policy2', name: 'Policy 2'} as AccessControlPolicy,
            ],
            total: 2,
        });

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with loading state', () => {
        const wrapper = shallow(<PolicyList {...defaultProps}/>);

        // Set loading state
        wrapper.setState({loading: true});

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with search error', () => {
        const wrapper = shallow(<PolicyList {...defaultProps}/>);

        // Set search error state
        wrapper.setState({searchErrored: true});

        expect(wrapper).toMatchSnapshot();
    });

    test('should call searchPolicies on mount', () => {
        shallow(<PolicyList {...defaultProps}/>);

        expect(mockSearchPolicies).toHaveBeenCalledWith('', 'parent', '', 11);
    });

    test('should handle search', async () => {
        const wrapper = shallow(<PolicyList {...defaultProps}/>);

        // Mock the searchPolicies function to return a successful result
        mockSearchPolicies.mockResolvedValue({
            data: {
                policies: [
                    {id: 'policy1', name: 'Policy 1'} as AccessControlPolicy,
                ],
                total: 1,
            },
        } as ActionResult);

        // Call onSearch with a search term
        await (wrapper.instance() as any).onSearch('test');

        expect(mockSearchPolicies).toHaveBeenCalledWith('test', 'parent', '', 11);
        expect(wrapper.state('search')).toBe('test');
    });

    test('should handle next page', async () => {
        const wrapper = shallow(<PolicyList {...defaultProps}/>);

        // Set initial state
        wrapper.setState({
            after: 'policy1',
            cursorHistory: [],
            page: 0,
        });

        // Mock the searchPolicies function to return a successful result
        mockSearchPolicies.mockResolvedValue({
            data: {
                policies: [
                    {id: 'policy2', name: 'Policy 2'} as AccessControlPolicy,
                ],
                total: 2,
            },
        } as ActionResult);

        // Call nextPage
        await (wrapper.instance() as any).nextPage();

        expect(mockSearchPolicies).toHaveBeenCalledWith('', 'parent', 'policy1', 11);
        expect(wrapper.state('page')).toBe(1);
        expect(wrapper.state('cursorHistory')).toEqual(['policy1']);
    });

    test('should handle previous page', async () => {
        const wrapper = shallow(<PolicyList {...defaultProps}/>);

        // Set initial state
        wrapper.setState({
            cursorHistory: ['policy1'],
            page: 1,
        });

        // Mock the searchPolicies function to return a successful result
        mockSearchPolicies.mockResolvedValue({
            data: {
                policies: [
                    {id: 'policy1', name: 'Policy 1'} as AccessControlPolicy,
                ],
                total: 2,
            },
        } as ActionResult);

        // Clear any calls from componentDidMount
        mockSearchPolicies.mockClear();

        // Call previousPage
        await (wrapper.instance() as any).previousPage();

        expect(mockSearchPolicies).toHaveBeenCalledWith('', 'parent', '', 11);
        expect(wrapper.state('page')).toBe(0);
        expect(wrapper.state('cursorHistory')).toEqual([]);
    });

    test('should not call previousPage if no history', async () => {
        const wrapper = shallow(<PolicyList {...defaultProps}/>);

        // Set initial state with empty history
        wrapper.setState({
            cursorHistory: [],
            page: 0,
        });

        // Clear any calls from componentDidMount
        mockSearchPolicies.mockClear();

        // Call previousPage
        await (wrapper.instance() as any).previousPage();

        expect(mockSearchPolicies).not.toHaveBeenCalled();
        expect(wrapper.state('page')).toBe(0);
    });

    test('should get rows correctly', () => {
        const wrapper = shallow(<PolicyList {...defaultProps}/>);

        // Set state with mock policies
        wrapper.setState({
            policies: [
                {id: 'policy1', name: 'Policy 1'} as AccessControlPolicy,
                {id: 'policy2', name: 'Policy 2'} as AccessControlPolicy,
            ],
        });

        const rows = (wrapper.instance() as any).getRows();

        expect(rows).toHaveLength(2);
        expect(rows[0].cells.name.props.children).toBe('Policy 1');
        expect(rows[1].cells.name.props.children).toBe('Policy 2');
    });

    test('should get columns correctly', () => {
        const wrapper = shallow(<PolicyList {...defaultProps}/>);

        const columns = (wrapper.instance() as any).getColumns();

        expect(columns).toHaveLength(3);
        expect(columns[0].field).toBe('name');
        expect(columns[1].field).toBe('resources');
        expect(columns[2].field).toBe('actions');
    });

    test('should get pagination props correctly', () => {
        const wrapper = shallow(<PolicyList {...defaultProps}/>);

        // Set state with mock policies
        wrapper.setState({
            policies: [
                {id: 'policy1', name: 'Policy 1'} as AccessControlPolicy,
                {id: 'policy2', name: 'Policy 2'} as AccessControlPolicy,
            ],
            page: 0,
            total: 5,
        });

        const paginationProps = (wrapper.instance() as any).getPaginationProps();

        expect(paginationProps.startCount).toBe(1);
        expect(paginationProps.endCount).toBe(2);
        expect(paginationProps.total).toBe(5);
    });
});
