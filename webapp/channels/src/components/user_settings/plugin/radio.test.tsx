// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {getPluginPreferenceKey} from 'utils/plugins/preferences';

import type {GlobalState} from 'types/store';

import RadioInput from './radio';

type Props = ComponentProps<typeof RadioInput>;

const PLUGIN_ID = 'pluginId';
const SETTING_NAME = 'setting_name';
const OPTION_0_TEXT = 'Option 0';
const OPTION_1_TEXT = 'Option 1';

function getBaseProps(): Props {
    return {
        informChange: jest.fn(),
        pluginId: PLUGIN_ID,
        setting: {
            default: '0',
            options: [
                {
                    text: OPTION_0_TEXT,
                    value: '0',
                    helpText: 'Help text 0',
                },
                {
                    text: OPTION_1_TEXT,
                    value: '1',
                    helpText: 'Help text 1',
                },
            ],
            name: SETTING_NAME,
            type: 'radio',
            helpText: 'Some help text',
            title: 'Some title',
        },
    };
}
describe('radio', () => {
    it('all texts are displayed', () => {
        const props = getBaseProps();
        renderWithContext(<RadioInput {...getBaseProps()}/>);

        expect(screen.queryByText(props.setting.helpText!)).toBeInTheDocument();
        expect(screen.queryByText(props.setting.title!)).toBeInTheDocument();
    });

    it('inform change is called', async () => {
        const props = getBaseProps();
        renderWithContext(<RadioInput {...props}/>);

        await userEvent.click(screen.getByText(OPTION_1_TEXT));

        expect(props.informChange).toHaveBeenCalledWith(SETTING_NAME, '1');
    });

    it('properly get the default from preferences', () => {
        const category = getPluginPreferenceKey(PLUGIN_ID);
        const prefKey = getPreferenceKey(category, SETTING_NAME);
        const state: DeepPartial<GlobalState> = {
            entities: {
                preferences: {
                    myPreferences: {
                        [prefKey]: {
                            category,
                            name: SETTING_NAME,
                            user_id: 'id',
                            value: '1',
                        },
                    },
                },
            },
        };
        renderWithContext(<RadioInput {...getBaseProps()}/>, state);

        expect(screen.getByRole('radio', {name: OPTION_0_TEXT})).not.toBeChecked();
        expect(screen.getByRole('radio', {name: OPTION_1_TEXT})).toBeChecked();
    });

    it('properly get the default from props', () => {
        const category = getPluginPreferenceKey(PLUGIN_ID);
        const prefKey = getPreferenceKey(category, SETTING_NAME);
        const state: DeepPartial<GlobalState> = {
            entities: {
                preferences: {
                    myPreferences: {
                        [prefKey]: {
                            category,
                            name: SETTING_NAME,
                            user_id: 'id',
                            value: '1',
                        },
                    },
                },
            },
        };
        const props = getBaseProps();
        props.setting.default = '1';
        renderWithContext(<RadioInput {...props}/>, state);

        expect(screen.getByRole('radio', {name: OPTION_0_TEXT})).not.toBeChecked();
        expect(screen.getByRole('radio', {name: OPTION_1_TEXT})).toBeChecked();
    });

    it('properly persist changes', async () => {
        renderWithContext(<RadioInput {...getBaseProps()}/>);

        expect(screen.getByRole('radio', {name: OPTION_0_TEXT})).toBeChecked();
        expect(screen.getByRole('radio', {name: OPTION_1_TEXT})).not.toBeChecked();

        await userEvent.click(screen.getByRole('radio', {name: OPTION_1_TEXT}));
        expect(screen.getByRole('radio', {name: OPTION_0_TEXT})).not.toBeChecked();
        expect(screen.getByRole('radio', {name: OPTION_1_TEXT})).toBeChecked();
    });
});
