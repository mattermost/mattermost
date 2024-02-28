// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import type {ComponentProps} from 'react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import SettingDesktopHeader from './setting_desktop_header';

type Props = ComponentProps<typeof SettingDesktopHeader>;

describe('settings_desktop_header', () => {
    const baseProps: Props = {
        text: 'setting section header',
    };

    it('properly renders the header', () => {
        renderWithContext(<SettingDesktopHeader {...baseProps}/>);
        const header = screen.queryByText('setting section header');
        expect(header).toBeInTheDocument();

        // The className is important for how the modal system work
        expect(header?.className).toBe('tab-header');
    });
});
