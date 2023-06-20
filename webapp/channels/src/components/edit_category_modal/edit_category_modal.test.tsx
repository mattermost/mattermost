// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import EditCategoryModal from './edit_category_modal';

describe('components/EditCategoryModal', () => {
    describe('isConfirmDisabled', () => {
        const requiredProps = {
            onExited: jest.fn(),
            currentTeamId: '42',
            actions: {
                createCategory: jest.fn(),
                renameCategory: jest.fn(),
            },
        };

        test.each([
            ['', true],
            ['Where is Jessica Hyde?', false],
            ['Some string with length more than 22', true],
        ])('when categoryName: %s, isConfirmDisabled should return %s', (categoryName, expected) => {
            const wrapper = shallow<EditCategoryModal>(<EditCategoryModal {...requiredProps}/>);

            wrapper.setState({categoryName});
            const instance = wrapper.instance();
            expect(instance.isConfirmDisabled()).toBe(expected);
        });
    });
});
