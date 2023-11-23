// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import PermissionRow from 'components/admin_console/permission_schemes_settings/permission_row';

describe('components/admin_console/permission_schemes_settings/permission_row', () => {
    const defaultProps = {
        id: 'id',
        uniqId: 'uniqId',
        inherited: undefined,
        readOnly: false,
        value: 'checked',
        selectRow: jest.fn(),
        onChange: jest.fn(),
        additionalValues: {},
    };

    test('should match snapshot on editable and not inherited', () => {
        const wrapper = shallow(
            <PermissionRow {...defaultProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on editable and inherited', () => {
        const wrapper = shallow(
            <PermissionRow
                {...defaultProps}
                inherited={{name: 'test'}}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on read only and not inherited', () => {
        const wrapper = shallow(
            <PermissionRow
                {...defaultProps}
                readOnly={true}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on read only and not inherited', () => {
        const wrapper = shallow(
            <PermissionRow
                {...defaultProps}
                readOnly={true}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should call onChange function on click', () => {
        const onChange = jest.fn();
        const wrapper = shallow(
            <PermissionRow
                {...defaultProps}
                onChange={onChange}
            />,
        );
        wrapper.find('div').first().simulate('click');
        expect(onChange).toBeCalledWith('id');
    });

    test('shouldn\'t call onChange function on click when is read-only', () => {
        const onChange = jest.fn();
        const wrapper = shallow(
            <PermissionRow
                {...defaultProps}
                readOnly={true}
                onChange={onChange}
            />,
        );
        wrapper.find('div').first().simulate('click');
        expect(onChange).not.toBeCalled();
    });
});
