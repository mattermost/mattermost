// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {SearchableChannelList} from 'components/searchable_channel_list';

import {type MockIntl} from 'tests/helpers/intl-test-helper';

import {Filter, Sort} from './browse_channels/browse_channels';

describe('components/SearchableChannelList', () => {
    const baseProps = {
        channels: [],
        isSearch: false,
        channelsPerPage: 10,
        nextPage: jest.fn(),
        search: jest.fn(),
        handleJoin: jest.fn(),
        loading: true,
        toggleArchivedChannels: jest.fn(),
        closeModal: jest.fn(),
        hideJoinedChannelsPreference: jest.fn(),
        changeFilter: jest.fn(),
        changeSort: jest.fn(),
        myChannelMemberships: {},
        canShowArchivedChannels: false,
        rememberHideJoinedChannelsChecked: false,
        noResultsText: <>{'no channel found'}</>,
        filter: Filter.All,
        sort: Sort.Recommended,
        intl: {
            formatMessage: ({defaultMessage}) => defaultMessage,
        } as MockIntl,
    };

    test('should match init snapshot', () => {
        const wrapper = shallow(
            <SearchableChannelList {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should set page to 0 when starting search', () => {
        const wrapper = shallow(
            <SearchableChannelList {...baseProps}/>,
        );

        wrapper.setState({page: 10});
        wrapper.setProps({isSearch: true});

        expect(wrapper.state('page')).toEqual(0);
    });

    describe('Sorting functionality', () => {
        test('should call changeSort and reset page when sort changes', () => {
            const changeSort = jest.fn();
            const props = {
                ...baseProps,
                changeSort,
            };

            const wrapper = shallow<SearchableChannelList>(
                <SearchableChannelList {...props}/>,
            );

            wrapper.setState({page: 5});

            // Call sortChange method
            wrapper.instance().sortChange(Sort.AtoZ);

            expect(changeSort).toHaveBeenCalledWith(Sort.AtoZ);
            expect(wrapper.state('page')).toEqual(0);
        });

        test('should not reset page when sort remains the same', () => {
            const changeSort = jest.fn();
            const props = {
                ...baseProps,
                changeSort,
                sort: Sort.Recommended,
            };

            const wrapper = shallow<SearchableChannelList>(
                <SearchableChannelList {...props}/>,
            );

            wrapper.setState({page: 5});

            // Call sortChange with same sort
            wrapper.instance().sortChange(Sort.Recommended);

            expect(changeSort).toHaveBeenCalledWith(Sort.Recommended);
            expect(wrapper.state('page')).toEqual(5);
        });

        test('should return correct label for Recommended sort', () => {
            const props = {
                ...baseProps,
                sort: Sort.Recommended,
            };

            const wrapper = shallow<SearchableChannelList>(
                <SearchableChannelList {...props}/>,
            );

            const label = wrapper.instance().getSortLabel();
            expect(label.props.defaultMessage).toBe('Sort: Recommended');
        });

        test('should return correct label for Newest sort', () => {
            const props = {
                ...baseProps,
                sort: Sort.Newest,
            };

            const wrapper = shallow<SearchableChannelList>(
                <SearchableChannelList {...props}/>,
            );

            const label = wrapper.instance().getSortLabel();
            expect(label.props.defaultMessage).toBe('Sort: Newest');
        });

        test('should return correct label for MostMembers sort', () => {
            const props = {
                ...baseProps,
                sort: Sort.MostMembers,
            };

            const wrapper = shallow<SearchableChannelList>(
                <SearchableChannelList {...props}/>,
            );

            const label = wrapper.instance().getSortLabel();
            expect(label.props.defaultMessage).toBe('Sort: Most Members');
        });

        test('should return correct label for AtoZ sort', () => {
            const props = {
                ...baseProps,
                sort: Sort.AtoZ,
            };

            const wrapper = shallow<SearchableChannelList>(
                <SearchableChannelList {...props}/>,
            );

            const label = wrapper.instance().getSortLabel();
            expect(label.props.defaultMessage).toBe('Sort: A to Z');
        });

        test('should return correct label for ZtoA sort', () => {
            const props = {
                ...baseProps,
                sort: Sort.ZtoA,
            };

            const wrapper = shallow<SearchableChannelList>(
                <SearchableChannelList {...props}/>,
            );

            const label = wrapper.instance().getSortLabel();
            expect(label.props.defaultMessage).toBe('Sort: Z to A');
        });

        test('should return default label for undefined sort', () => {
            const props = {
                ...baseProps,
                sort: 'InvalidSort' as any,
            };

            const wrapper = shallow<SearchableChannelList>(
                <SearchableChannelList {...props}/>,
            );

            const label = wrapper.instance().getSortLabel();
            expect(label.props.defaultMessage).toBe('Sort: Recommended');
        });

        test('should reset page to 0 when filter changes', () => {
            const wrapper = shallow<SearchableChannelList>(
                <SearchableChannelList {...baseProps}/>,
            );

            wrapper.setState({page: 10});

            // Call filterChange method
            wrapper.instance().filterChange(Filter.Private);

            expect(baseProps.changeFilter).toHaveBeenCalledWith(Filter.Private);
            expect(wrapper.state('page')).toEqual(0);
        });

        test('should not reset page when filter remains the same', () => {
            const props = {
                ...baseProps,
                filter: Filter.All,
            };

            const wrapper = shallow<SearchableChannelList>(
                <SearchableChannelList {...props}/>,
            );

            wrapper.setState({page: 10});

            // Call filterChange with same filter
            wrapper.instance().filterChange(Filter.All);

            expect(props.changeFilter).toHaveBeenCalledWith(Filter.All);
            expect(wrapper.state('page')).toEqual(10);
        });
    });
});
