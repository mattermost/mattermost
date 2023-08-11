// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import type {Value} from './multiselect';
import MultiSelectList from './multiselect_list';
import type {Props as MultiSelectProps} from './multiselect_list';

const element = () => <div/>;

describe('components/multiselect/multiselect', () => {
    const optionsNumber = 8;
    const users = [];
    for (let i = 0; i < optionsNumber; i++) {
        users.push({id: `${i}`, label: `${i}`, value: `${i}`});
    }

    const selectedItemRef = {
        current: {
            getBoundingClientRect: jest.fn(() => ({
                bottom: 100,
                top: 50,
            })) as any,
            scrollIntoView: jest.fn(),
        },
    } as any;

    const baseProps = {
        ariaLabelRenderer: element as any,
        loading: false,
        onAdd: jest.fn(),
        onPageChange: jest.fn(),
        onSelect: jest.fn(),
        optionRenderer: element,
        selectedItemRef,
        options: users,
        perPage: 5,
        page: 1,
    };

    test('MultiSelectList should have selected item scrollIntoView to align at bottom of list', () => {
        const renderOption: MultiSelectProps<Value>['optionRenderer'] = (option, isSelected, onAdd, onMouseMove) => {
            return (
                <p
                    key={option.id}
                    ref={isSelected ? selectedItemRef : option.id}
                    onClick={() => onAdd(option)}
                    onMouseMove={() => onMouseMove(option)}
                >
                    {option.id}
                </p>
            );
        };

        const wrapper = shallow(
            <MultiSelectList
                {...baseProps}
                optionRenderer={renderOption}
            />,
        );

        (wrapper.instance() as any).listRef = {
            current: {
                getBoundingClientRect: jest.fn(() => ({
                    bottom: 50,
                    top: 50,
                })),
            },
        } as any;

        wrapper.setState({selected: 1});
        expect(selectedItemRef.current.scrollIntoView).toHaveBeenCalledWith(false);
    });

    test('MultiSelectList should have selected item scrollIntoView to align at top of list', () => {
        const renderOption: MultiSelectProps<Value>['optionRenderer'] = (option, isSelected, onAdd, onMouseMove) => {
            return (
                <p
                    key={option.id}
                    ref={isSelected ? selectedItemRef : option.id}
                    onClick={() => onAdd(option)}
                    onMouseMove={() => onMouseMove(option)}
                >
                    {option.id}
                </p>
            );
        };

        const wrapper = shallow(
            <MultiSelectList
                {...baseProps}
                optionRenderer={renderOption}
            />,
        );

        (wrapper.instance() as any).listRef = {
            current: {
                getBoundingClientRect: jest.fn(() => ({
                    bottom: 200,
                    top: 60,
                })),
            },
        } as any;

        wrapper.setState({selected: 1});
        expect(selectedItemRef.current.scrollIntoView).toHaveBeenCalledWith(true);
    });
});
