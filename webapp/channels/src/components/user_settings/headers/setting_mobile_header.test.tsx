// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent} from '@testing-library/react';
import type {ComponentProps} from 'react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import SettingMobileHeader from './setting_mobile_header';

type Props = ComponentProps<typeof SettingMobileHeader>;

const baseProps: Props = {
    closeModal: jest.fn(),
    collapseModal: jest.fn(),
    text: 'setting header',
};

describe('plugin tab', () => {
    it('calls closeModal on hitting close', () => {
        renderWithContext(<SettingMobileHeader {...baseProps}/>);
        fireEvent.click(screen.getByText('×'));
        expect(baseProps.closeModal).toHaveBeenCalled();
    });

    it('calls collapseModal on hitting back', () => {
        renderWithContext(<SettingMobileHeader {...baseProps}/>);
        fireEvent.click(screen.getByLabelText('Collapse Icon'));
        expect(baseProps.collapseModal).toHaveBeenCalled();
    });

    it('properly renders the header', () => {
        renderWithContext(<SettingMobileHeader {...baseProps}/>);
        const header = screen.queryByText('setting header');
        expect(header).toBeInTheDocument();

        // The className is important for how the modal system work
        expect(header?.className).toBe('modal-title');
        expect(header?.parentElement?.className).toBe('modal-header');
    });
});
