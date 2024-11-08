// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import * as reactRedux from 'react-redux';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import UserAccountOutOfOfficeMenuItem, {type Props} from './user_account_out_of_office_menuitem';

describe('UserAccountOutOfOfficeMenuItem', () => {
    let defaultProps: Props;

    beforeEach(() => {
        defaultProps = {
            userId: TestHelper.getUserMock().id,
            shouldConfirmBeforeStatusChange: false,
            isStatusOutOfOffice: true,
        };
    });

    test('should not render if status is not out of office', () => {
        const props = {...defaultProps, isStatusOutOfOffice: false};
        renderWithContext(<UserAccountOutOfOfficeMenuItem {...props}/>);

        expect(screen.queryByText('Out of office')).not.toBeInTheDocument();
    });

    test('should only render when status is out of office', () => {
        renderWithContext(<UserAccountOutOfOfficeMenuItem {...defaultProps}/>);

        expect(screen.getAllByText(/Out of office/).length).toBe(1);
        expect(screen.getAllByText(/Automatic replies are enabled/).length).toBe(1);
    });

    test('should try to open reset status modal', async () => {
        jest.spyOn(reactRedux, 'useDispatch').mockReturnValue(jest.fn());

        const props = {...defaultProps, shouldConfirmBeforeStatusChange: true};
        renderWithContext(<UserAccountOutOfOfficeMenuItem {...props}/>);

        userEvent.click(screen.getByRole('menuitem'));

        expect(reactRedux.useDispatch).toHaveBeenCalledTimes(1);
    });
});
