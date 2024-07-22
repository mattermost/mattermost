// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import {getAllLanguages} from 'i18n/i18n';
import {shallowWithIntl} from 'tests/helpers/intl-test-helper';

import ManageLanguages from './manage_languages';
import type {ManageLanguage as ManageLanguageClass} from './manage_languages';

describe('components/user_settings/display/manage_languages/manage_languages', () => {
    const user = {
        id: 'user_id',
    };

    const requiredProps = {
        user: user as UserProfile,
        locale: 'en',
        locales: getAllLanguages(),
        updateSection: jest.fn(),
        actions: {
            updateMe: jest.fn(() => Promise.resolve({})),
            patchUser: jest.fn(() => Promise.resolve({})),
        },
    };

    test('submitUser() should have called updateMe', async () => {
        const updateMe = jest.fn(() => Promise.resolve({data: true}));
        const props = {...requiredProps, actions: {...requiredProps.actions, updateMe}};
        const wrapper = shallowWithIntl(<ManageLanguages {...props}/>);
        const instance = wrapper.instance() as ManageLanguageClass;

        await instance.submitUser(requiredProps.user);

        expect(props.actions.updateMe).toHaveBeenCalledTimes(1);
        expect(props.actions.updateMe).toHaveBeenCalledWith(requiredProps.user);
    });
});
