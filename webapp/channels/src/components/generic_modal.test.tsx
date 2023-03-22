// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import GenericModal from 'components/generic_modal';
import {mountWithIntl} from 'tests/helpers/intl-test-helper';

describe('components/GenericModal', () => {
    const requiredProps = {
        onExited: jest.fn(),
        modalHeaderText: 'Modal Header Text',
        children: <></>,
    };

    test('should match snapshot for base case', () => {
        const wrapper = shallow(
            <GenericModal {...requiredProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with both buttons', () => {
        const props = {
            ...requiredProps,
            handleConfirm: jest.fn(),
            handleCancel: jest.fn(),
        };

        const wrapper = shallow(
            <GenericModal {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('.GenericModal__button.confirm')).toHaveLength(1);
        expect(wrapper.find('.GenericModal__button.cancel')).toHaveLength(1);
    });

    test('should match snapshot with disabled confirm button', () => {
        const props = {
            ...requiredProps,
            handleConfirm: jest.fn(),
            isConfirmDisabled: true,
        };

        const wrapper = shallow(
            <GenericModal {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('.GenericModal__button.confirm.disabled')).toHaveLength(1);
    });

    test('should hide and run handleConfirm on confirm button click', (done) => {
        requiredProps.onExited.mockImplementation(() => done());

        const props = {
            ...requiredProps,
            handleConfirm: jest.fn(),
        };

        const wrapper = mountWithIntl(
            <GenericModal {...props}/>,
        );

        wrapper.find('.GenericModal__button.confirm').simulate('click');

        expect(props.handleConfirm).toHaveBeenCalled();
    });

    test('should hide and run handleCancel on cancel button click', (done) => {
        requiredProps.onExited.mockImplementation(() => done());

        const props = {
            ...requiredProps,
            handleCancel: jest.fn(),
        };

        const wrapper = mountWithIntl(
            <GenericModal {...props}/>,
        );

        wrapper.find('.GenericModal__button.cancel').simulate('click');

        expect(props.handleCancel).toHaveBeenCalled();
    });
});
