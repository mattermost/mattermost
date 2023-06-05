// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen} from '@testing-library/react';

import {GenericModal} from './generic_modal';
import {wrapIntl} from '../testUtils';

describe('GenericModal', () => {
    const baseProps = {
        onExited: jest.fn(),
        modalHeaderText: 'Modal Header Text',
        children: <></>,
    };

    test('should match snapshot for base case', () => {
        const wrapper = render(
            wrapIntl(<GenericModal {...baseProps}/>),
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should have confirm and cancels buttons when handlers are passed for both buttons', () => {
        const props = {
            ...baseProps,
            handleConfirm: jest.fn(),
            handleCancel: jest.fn(),
        };

        render(
            wrapIntl(<GenericModal {...props}/>),
        );
        
        expect(screen.getByText('Confirm')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
});
