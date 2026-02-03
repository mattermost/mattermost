// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {ClientConfig} from '@mattermost/types/config';

import {RequestStatus} from 'mattermost-redux/constants';

import {redirectUserToDefaultTeam} from 'actions/global_actions';

import Signup from 'components/signup/signup';

import {renderWithContext, screen, waitFor, userEvent} from 'tests/react_testing_utils';
import {WindowSizes} from 'utils/constants';

import type {GlobalState} from 'types/store';

let mockState: GlobalState;
let mockLocation = {pathname: '', search: '', hash: ''};
const mockHistoryPush = jest.fn();
let mockLicense = {IsLicensed: 'true', Cloud: 'false'};
let mockConfig: Partial<ClientConfig>;
let mockDispatch = jest.fn();

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
    useDispatch: () => mockDispatch,
}));

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom') as typeof import('react-router-dom'),
    useLocation: () => mockLocation,
    useHistory: () => ({
        push: mockHistoryPush,
    }),
}));

jest.mock('mattermost-redux/selectors/entities/general', () => ({
    ...jest.requireActual('mattermost-redux/selectors/entities/general') as typeof import('mattermost-redux/selectors/entities/general'),
    getLicense: () => mockLicense,
    getConfig: () => mockConfig,
}));

let mockCurrentUserId = '';

jest.mock('mattermost-redux/selectors/entities/users', () => ({
    ...jest.requireActual('mattermost-redux/selectors/entities/users') as typeof import('mattermost-redux/selectors/entities/users'),
    getCurrentUserId: () => mockCurrentUserId,
}));

jest.mock('actions/global_actions', () => ({
    ...jest.requireActual('actions/global_actions'),
    redirectUserToDefaultTeam: jest.fn(),
}));

jest.mock('actions/team_actions', () => ({
    ...jest.requireActual('actions/team_actions') as typeof import('actions/team_actions'),
    addUserToTeamFromInvite: jest.fn().mockResolvedValue({data: {}}),
    addUsersToTeamFromInvite: jest.fn().mockResolvedValue({name: 'teamName'}),
}));

jest.mock('mattermost-redux/actions/users', () => ({
    ...jest.requireActual('mattermost-redux/actions/users') as typeof import('mattermost-redux/actions/users'),
    createUser: jest.fn().mockResolvedValue({data: {}}),
}));

jest.mock('actions/views/login', () => ({
    ...jest.requireActual('actions/views/login') as typeof import('actions/views/login'),
    loginById: jest.fn().mockResolvedValue({data: {}}),
}));

jest.mock('actions/storage');

describe('components/signup/Signup', () => {
    beforeEach(() => {
        mockLocation = {pathname: '', search: '', hash: ''};
        mockHistoryPush.mockClear();
        mockDispatch.mockClear();
        mockCurrentUserId = '';

        mockLicense = {IsLicensed: 'true', Cloud: 'false'};

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
            EnableLdap: 'true',
            EnableSaml: 'true',
            EnableSignInWithEmail: 'true',
            EnableSignInWithUsername: 'true',
            EnableSignUpWithEmail: 'true',
            EnableSignUpWithGitLab: 'true',
            EnableSignUpWithOffice365: 'true',
            EnableSignUpWithGoogle: 'true',
            EnableSignUpWithOpenId: 'true',
            EnableOpenServer: 'true',
            EnableUserCreation: 'true',
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
        };
    });

    it('should match snapshot for all signup options enabled with isLicensed enabled', () => {
        const wrapper = shallow(
            <Signup/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    it('should match snapshot for all signup options enabled with isLicensed disabled', () => {
        mockLicense = {IsLicensed: 'false', Cloud: 'false'};

        const wrapper = shallow(
            <Signup/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    it('should match snapshot for all signup options enabled with EnableUserCreaton disabled', () => {
        mockConfig.EnableUserCreation = 'false';

        const wrapper = shallow(
            <Signup/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    it('should create user, log in and redirect to invite teamname', async () => {
        mockLocation.search = 'd=%7B"name"%3A"teamName"%7D';

        mockDispatch = jest.fn().
            mockResolvedValueOnce({}). // removeGlobalItem
            mockResolvedValueOnce({data: {id: 'userId', password: 'password', email: 'jdoe@mm.com}'}}). // createUser
            mockResolvedValueOnce({error: {server_error_id: 'api.user.login.not_verified.app_error'}}); // loginById

        renderWithContext(
            <Signup/>,
        );

        const emailInput = screen.getByLabelText('Email address');
        const usernameInput = screen.getByLabelText('Choose a Username');
        const passwordInput = screen.getByLabelText('Choose a Password');
        const termsCheckbox = screen.getByRole('checkbox', {name: /terms and privacy policy checkbox/i});
        const submitButton = screen.getByRole('button', {name: 'Create account'});

        await userEvent.type(emailInput, 'jdoe@mm.com');
        await userEvent.type(usernameInput, 'jdoe');
        await userEvent.type(passwordInput, 'password');
        await userEvent.click(termsCheckbox);

        expect(submitButton).not.toBeDisabled();
        await userEvent.click(submitButton);

        expect(emailInput).toBeDisabled();
        expect(usernameInput).toBeDisabled();
        expect(passwordInput).toBeDisabled();

        expect(mockHistoryPush).toHaveBeenCalledWith('/should_verify_email?email=jdoe%40mm.com&teamname=teamName');
    });

    it('should create user, log in and redirect to default team', async () => {
        mockDispatch = jest.fn().
            mockResolvedValueOnce({}). // removeGlobalItem
            mockResolvedValueOnce({data: {id: 'userId', password: 'password', email: 'jdoe@mm.com}'}}). // createUser
            mockResolvedValueOnce({}); // loginById

        renderWithContext(
            <Signup/>,
        );

        const emailInput = screen.getByLabelText('Email address');
        const usernameInput = screen.getByLabelText('Choose a Username');
        const passwordInput = screen.getByLabelText('Choose a Password');
        const termsCheckbox = screen.getByRole('checkbox', {name: /terms and privacy policy checkbox/i});
        const submitButton = screen.getByRole('button', {name: 'Create account'});

        await userEvent.type(emailInput, 'jdoe@mm.com');
        await userEvent.type(usernameInput, 'jdoe');
        await userEvent.type(passwordInput, 'password');
        await userEvent.click(termsCheckbox);

        expect(submitButton).not.toBeDisabled();
        await userEvent.click(submitButton);

        expect(emailInput).toBeDisabled();
        expect(usernameInput).toBeDisabled();
        expect(passwordInput).toBeDisabled();

        expect(redirectUserToDefaultTeam).toHaveBeenCalled();
    });

    it('should focus email input when email validation fails', async () => {
        renderWithContext(<Signup/>, mockState);

        const emailInput = screen.getByLabelText('Email address');
        const usernameInput = screen.getByLabelText('Choose a Username');
        const passwordInput = screen.getByLabelText('Choose a Password');
        const termsCheckbox = screen.getByRole('checkbox', {name: /terms and privacy policy checkbox/i});
        const submitButton = screen.getByRole('button', {name: 'Create account'});

        // Submit with invalid email
        await userEvent.type(emailInput, 'invalid-email');
        await userEvent.type(usernameInput, 'testuser');
        await userEvent.type(passwordInput, '123');
        await userEvent.click(termsCheckbox);

        // The focus should no longer be on the email input before clicking submit
        expect(emailInput).not.toHaveFocus();

        await userEvent.click(submitButton);

        // And now the focus should move back to the email input
        expect(emailInput).toHaveFocus();
    });

    it('should focus password input when password validation fails', async () => {
        renderWithContext(<Signup/>, mockState);

        const emailInput = screen.getByLabelText('Email address');
        const usernameInput = screen.getByLabelText('Choose a Username');
        const passwordInput = screen.getByLabelText('Choose a Password');
        const termsCheckbox = screen.getByRole('checkbox', {name: /terms and privacy policy checkbox/i});
        const submitButton = screen.getByText('Create account');

        // Submit with valid email and username but invalid password
        await userEvent.type(emailInput, 'test@example.com');
        await userEvent.type(usernameInput, 'testuser');
        await userEvent.type(passwordInput, '123');
        await userEvent.click(termsCheckbox);

        // The focus should no longer be on the password input before clicking submit
        expect(emailInput).not.toHaveFocus();

        await userEvent.click(submitButton);

        // And now the focus should move back to the password input
        expect(passwordInput).toHaveFocus();
    });

    it('should focus username input when server returns username exists error', async () => {
        mockDispatch = jest.fn().mockImplementation(() => Promise.resolve({
            data: {},
            error: {
                server_error_id: 'app.user.save.username_exists.app_error',
                message: 'Username already exists',
            },
        }));

        renderWithContext(<Signup/>, mockState);

        const emailInput = screen.getByLabelText('Email address');
        const usernameInput = screen.getByLabelText('Choose a Username');
        const passwordInput = screen.getByLabelText('Choose a Password');
        const termsCheckbox = screen.getByRole('checkbox', {name: /terms and privacy policy checkbox/i});
        const submitButton = screen.getByText('Create account');

        // Submit with valid data that will trigger server error
        await userEvent.type(emailInput, 'test@example.com');
        await userEvent.type(usernameInput, 'existinguser');
        await userEvent.type(passwordInput, 'password123');
        await userEvent.click(termsCheckbox);

        // The focus should no longer be on the email input before clicking submit
        expect(usernameInput).not.toHaveFocus();

        await userEvent.click(submitButton);

        // And now the focus should move back to the username input
        expect(usernameInput).toHaveFocus();
    });

    it('should add user to team and redirect when team invite valid and logged in', async () => {
        mockLocation.search = '?id=ppni7a9t87fn3j4d56rwocdctc';
        mockCurrentUserId = 'user1'; // Simulate logged-in user

        mockDispatch = jest.fn().
            mockResolvedValueOnce({}). // removeGlobalItem in useEffect
            mockResolvedValueOnce({data: {name: 'teamName'}}); // addUserToTeamFromInvite

        renderWithContext(
            <Signup/>,
        );

        await waitFor(() => {
            expect(mockHistoryPush).toHaveBeenCalledWith('/teamName/channels/town-square');
        });
    });

    it('should handle failure adding user to team when team invite and logged in', async () => {
        mockLocation.search = '?id=ppni7a9t87fn3j4d56rwocdctc';
        mockCurrentUserId = 'user1'; // Simulate logged-in user

        mockDispatch = jest.fn().
            mockResolvedValueOnce({}). // removeGlobalItem in useEffect
            mockResolvedValueOnce({
                error: {
                    server_error_id: 'api.team.add_user_to_team_from_invite.invalid.app_error',
                    message: 'Invalid invite',
                },
            }); // addUserToTeamFromInvite with error

        renderWithContext(<Signup/>, mockState);

        await waitFor(() => {
            expect(mockHistoryPush).not.toHaveBeenCalled();
            expect(screen.getByText('This invite link is invalid')).toBeInTheDocument();
        });
    });

    it('should show terms and privacy checkbox', async () => {
        mockConfig.TermsOfServiceLink = 'https://mattermost.com/terms';
        mockConfig.PrivacyPolicyLink = 'https://mattermost.com/privacy';

        const {container: signupContainer} = renderWithContext(
            <Signup/>,
        );

        const checkInput = screen.getByRole('checkbox', {name: /terms and privacy policy checkbox/i});
        expect(checkInput).toHaveAttribute('type', 'checkbox');
        expect(checkInput).not.toBeChecked();

        expect(signupContainer).toHaveTextContent('I agree to the Acceptable Use Policy and the Privacy Policy');
    });

    it('should require terms acceptance before enabling submit button', async () => {
        renderWithContext(<Signup/>, mockState);

        const emailInput = screen.getByLabelText('Email address');
        const usernameInput = screen.getByLabelText('Choose a Username');
        const passwordInput = screen.getByLabelText('Choose a Password');
        const termsCheckbox = screen.getByRole('checkbox', {name: /terms and privacy policy checkbox/i});

        // Fill in all fields but don't check terms
        await userEvent.type(emailInput, 'test@example.com');
        await userEvent.type(usernameInput, 'testuser');
        await userEvent.type(passwordInput, 'ValidPassword123!');

        // Submit button should be disabled (SaveButton uses disabled prop on inner button)
        const submitButton = screen.getByRole('button', {name: /Create account/i});
        expect(submitButton).toBeDisabled();

        // Check terms
        await userEvent.click(termsCheckbox);

        // Now submit button should be enabled
        const enabledButton = screen.getByRole('button', {name: /Create account/i});
        expect(enabledButton).not.toBeDisabled();
    });
});
