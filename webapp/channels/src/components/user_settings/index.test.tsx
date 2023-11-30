// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import type {ComponentProps} from 'react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import UserSettings from '.';

type Props = ComponentProps<typeof UserSettings>;

const PLUGIN_ID = 'pluginId';
const UINAME = 'plugin name';
const UINAME2 = 'other plugin';

function getBaseProps(): Props {
    return {
        user: TestHelper.getUserMock(),
        activeTab: '',
        activeSection: '',
        closeModal: jest.fn(),
        collapseModal: jest.fn(),
        pluginSettings: {
            [PLUGIN_ID]: {
                id: PLUGIN_ID,
                sections: [],
                uiName: UINAME,
            },
            otherPlugin: {
                id: 'otherPlugin',
                sections: [],
                uiName: 'other plugin',
            },
        },
        setEnforceFocus: jest.fn(),
        setRequireConfirm: jest.fn(),
        updateSection: jest.fn(),
        updateTab: jest.fn(),
    };
}

describe('plugin tabs', () => {
    it('render the correct plugin tab', () => {
        const props = getBaseProps();
        props.activeTab = PLUGIN_ID;
        renderWithContext(<UserSettings {...props}/>);

        expect(screen.queryAllByText(`${UINAME} Settings`)).not.toHaveLength(0);
        expect(screen.queryAllByText(`${UINAME2} Settings`)).toHaveLength(0);
    });
});
