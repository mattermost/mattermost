// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import {IntlProvider} from 'react-intl';
import {MemoryRouter} from 'react-router-dom';

import type {ClientConfig} from '@mattermost/types/config';

import {RequestStatus} from 'mattermost-redux/constants';

import LocalStorageStore from 'stores/local_storage_store';

import AlertBanner from 'components/alert_banner';
import ExternalLoginButton from 'components/external_login_button/external_login_button';
import Login from 'components/login/login';
import SaveButton from 'components/save_button';
import Input from 'components/widgets/inputs/input/input';
import PasswordInput from 'components/widgets/inputs/password_input/password_input';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import Constants, {WindowSizes} from 'utils/constants';

import type {GlobalState} from 'types/store';

let mockState: GlobalState;
let mockLocation = {pathname: '', search: '', hash: ''};
const mockHistoryReplace = jest.fn();
const mockHistoryPush = jest.fn();
const mockLicense = {IsLicensed: 'false'};
let mockConfig: Partial<ClientConfig>;

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
    useDispatch: jest.fn(() => (action: unknown) => action),
}));

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom') as typeof import('react-router-dom'),
    useLocation: () => mockLocation,
    useHistory: () => ({
        replace: mockHistoryReplace,
        push: mockHistoryPush,
    }),
}));

jest.mock('mattermost-redux/selectors/entities/general', () => ({
    ...jest.requireActual('mattermost-redux/selectors/entities/general') as typeof import('mattermost-redux/selectors/entities/general'),
    getLicense: () => mockLicense,
    getConfig: () => mockConfig,
}));

describe('components/login/Login', () => {
    beforeEach(() => {
        mockLocation = {pathname: '', search: '', hash: ''};

        LocalStorageStore.setWasLoggedIn(false);

        mockState = {
            entities: {
                general: {
                    config: {},
                    license: {},
                },
                users: {
                    currentUserId: '',
                    profiles: {
                        user1: {
                            id: 'user1',
                            roles: '',
                        },
                    },
                },
                teams: {
                    currentTeamId: 'team1',
                    teams: {
                        team1: {
                            id: 'team1',
                            name: 'team-1',
                            displayName: 'Team 1',
                        },
                    },
                    myMembers: {
                        team1: {roles: 'team_role'},
                    },
                },
            },
            requests: {
                users: {
                    logout: {
                        status: RequestStatus.NOT_STARTED,
                    },
                },
            },
            storage: {
                initialized: true,
            },
            views: {
                browser: {
                    windowSize: WindowSizes.DESKTOP_VIEW,
                },
            },
        } as unknown as GlobalState;

        mockConfig = {
            EnableLdap: 'false',
            EnableSaml: 'false',
            EnableSignInWithEmail: 'false',
            EnableSignInWithUsername: 'false',
            EnableSignUpWithEmail: 'false',
            EnableSignUpWithGitLab: 'false',
            EnableSignUpWithOffice365: 'false',
            EnableSignUpWithGoogle: 'false',
            EnableSignUpWithOpenId: 'false',
            EnableOpenServer: 'false',
            LdapLoginFieldName: '',
            GitLabButtonText: '',
            GitLabButtonColor: '',
            OpenIdButtonText: '',
            OpenIdButtonColor: '',
            SamlLoginButtonText: '',
            EnableCustomBrand: 'false',
            CustomBrandText: '',
            CustomDescriptionText: '',
            SiteName: 'Mattermost',
            ExperimentalPrimaryTeam: '',
            PasswordEnableForgotLink: 'true',
        };
    });

    it('should match snapshot', () => {
        const wrapper = shallow(
            <Login/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    it('should match snapshot with base login', () => {
        mockConfig.EnableSignInWithEmail = 'true';

        const wrapper = shallow(
            <Login/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    it('should handle session expired', () => {
        LocalStorageStore.setWasLoggedIn(true);
        mockConfig.EnableSignInWithEmail = 'true';

        const wrapper = mountWithIntl(
            <MemoryRouter><Login/></MemoryRouter>,
        );

        const alertBanner = wrapper.find(AlertBanner).first();
        expect(alertBanner.props().mode).toEqual('warning');
        expect(alertBanner.props().title).toEqual('Your session has expired. Please log in again.');

        alertBanner.find('button').first().simulate('click');

        expect(wrapper.find(AlertBanner)).toEqual({});
    });

    it('should handle initializing when logout status success', () => {
        mockState.requests.users.logout.status = RequestStatus.SUCCESS;

        const intlProviderProps = {
            defaultLocale: 'en',
            locale: 'en',
            messages: {},
        };

        const wrapper = mountWithIntl(
            <IntlProvider {...intlProviderProps}>
                <MemoryRouter>
                    <Login/>
                </MemoryRouter>
            </IntlProvider>,
        );

        // eslint-disable-next-line react/jsx-key, react/jsx-no-literals
        expect(wrapper.contains([<p>Loading</p>])).toEqual(true);
    });

    it('should handle initializing when storage not initalized', () => {
        mockState.storage.initialized = false;

        const intlProviderProps = {
            defaultLocale: 'en',
            locale: 'en',
            messages: {},
        };

        const wrapper = mountWithIntl(
            <IntlProvider {...intlProviderProps}>
                <Login/>
            </IntlProvider>,
        );

        // eslint-disable-next-line react/jsx-no-literals, react/jsx-key
        expect(wrapper.contains([<p>Loading</p>])).toEqual(true);
    });

    it('should handle suppress session expired notification on sign in change', () => {
        mockLocation.search = '?extra=' + Constants.SIGNIN_CHANGE;
        LocalStorageStore.setWasLoggedIn(true);
        mockConfig.EnableSignInWithEmail = 'true';

        const wrapper = mountWithIntl(
            <MemoryRouter>
                <Login/>
            </MemoryRouter>,
        );

        expect(LocalStorageStore.getWasLoggedIn()).toEqual(false);

        const alertBanner = wrapper.find(AlertBanner).first();
        expect(alertBanner.props().mode).toEqual('success');
        expect(alertBanner.props().title).toEqual('Sign-in method changed successfully');

        alertBanner.find('button').first().simulate('click');

        expect(wrapper.find(AlertBanner)).toEqual({});
    });

    it('should handle discard session expiry notification on failed sign in', () => {
        LocalStorageStore.setWasLoggedIn(true);
        mockConfig.EnableSignInWithEmail = 'true';

        const wrapper = mountWithIntl(
            <MemoryRouter>
                <Login/>
            </MemoryRouter>,
        );

        let alertBanner = wrapper.find(AlertBanner).first();
        expect(alertBanner.props().mode).toEqual('warning');
        expect(alertBanner.props().title).toEqual('Your session has expired. Please log in again.');

        const input = wrapper.find(Input).first().find('input').first();
        input.simulate('change', {target: {value: 'user1'}});

        const passwordInput = wrapper.find(PasswordInput).first().find('input').first();
        passwordInput.simulate('change', {target: {value: 'passw'}});

        const saveButton = wrapper.find(SaveButton).first();
        expect(saveButton.props().disabled).toEqual(false);

        saveButton.find('button').first().simulate('click');

        setTimeout(() => {
            alertBanner = wrapper.find(AlertBanner).first();
            expect(alertBanner.props().mode).toEqual('danger');
            expect(alertBanner.props().title).toEqual('The email/username or password is invalid.');
        });
    });

    it('should handle gitlab text and color props', () => {
        mockConfig.EnableSignInWithEmail = 'true';
        mockConfig.EnableSignUpWithGitLab = 'true';
        mockConfig.GitLabButtonText = 'GitLab 2';
        mockConfig.GitLabButtonColor = '#00ff00';

        const wrapper = shallow(
            <Login/>,
        );

        const externalLoginButton = wrapper.find(ExternalLoginButton).first();
        expect(externalLoginButton.props().url).toEqual('/oauth/gitlab/login');
        expect(externalLoginButton.props().label).toEqual('GitLab 2');
        expect(externalLoginButton.props().style).toEqual({color: '#00ff00', borderColor: '#00ff00'});
    });

    it('should handle openid text and color props', () => {
        mockConfig.EnableSignInWithEmail = 'true';
        mockConfig.EnableSignUpWithOpenId = 'true';
        mockConfig.OpenIdButtonText = 'OpenID 2';
        mockConfig.OpenIdButtonColor = '#00ff00';

        const wrapper = shallow(
            <Login/>,
        );

        const externalLoginButton = wrapper.find(ExternalLoginButton).first();
        expect(externalLoginButton.props().url).toEqual('/oauth/openid/login');
        expect(externalLoginButton.props().label).toEqual('OpenID 2');
        expect(externalLoginButton.props().style).toEqual({color: '#00ff00', borderColor: '#00ff00'});
    });

    it('should redirect on login', () => {
        mockState.entities.users.currentUserId = 'user1';
        LocalStorageStore.setWasLoggedIn(true);
        mockConfig.EnableSignInWithEmail = 'true';
        const redirectPath = '/boards/team/teamID/boardID';
        mockLocation.search = '?redirect_to=' + redirectPath;
        mountWithIntl(
            <MemoryRouter>
                <Login/>
            </MemoryRouter>,
        );
        expect(mockHistoryPush).toHaveBeenCalledWith(redirectPath);
    });
});
