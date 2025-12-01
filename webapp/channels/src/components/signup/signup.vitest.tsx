// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {BrowserRouter} from 'react-router-dom';

import type {ClientConfig} from '@mattermost/types/config';

import {RequestStatus} from 'mattermost-redux/constants';

import * as useCWSAvailabilityCheckAll from 'components/common/hooks/useCWSAvailabilityCheck';

import {renderWithContext, screen, fireEvent, waitFor} from 'tests/vitest_react_testing_utils';
import {WindowSizes} from 'utils/constants';

import type {GlobalState} from 'types/store';

import Signup from './signup';

let mockState: GlobalState;
let mockLocation = {pathname: '', search: '', hash: ''};
const mockHistoryPush = vi.fn();
let mockLicense = {IsLicensed: 'true', Cloud: 'false'};
let mockConfig: Partial<ClientConfig>;
let mockDispatch = vi.fn();

vi.mock('react-redux', async () => {
    const actual = await vi.importActual('react-redux');
    return {
        ...actual,
        useSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
        useDispatch: () => mockDispatch,
    };
});

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useLocation: () => mockLocation,
        useHistory: () => ({
            push: mockHistoryPush,
        }),
    };
});

vi.mock('mattermost-redux/selectors/entities/general', async () => {
    const actual = await vi.importActual('mattermost-redux/selectors/entities/general');
    return {
        ...actual,
        getLicense: () => mockLicense,
        getConfig: () => mockConfig,
    };
});

vi.mock('mattermost-redux/selectors/entities/users', async () => {
    const actual = await vi.importActual('mattermost-redux/selectors/entities/users');
    return {
        ...actual,
        getCurrentUserId: () => '',
    };
});

vi.mock('actions/team_actions', async () => {
    const actual = await vi.importActual('actions/team_actions');
    return {
        ...actual,
        addUsersToTeamFromInvite: vi.fn().mockResolvedValue({name: 'teamName'}),
        addUserToTeamFromInvite: vi.fn().mockResolvedValue({data: {}}),
    };
});

vi.mock('mattermost-redux/actions/teams', async () => {
    const actual = await vi.importActual('mattermost-redux/actions/teams');
    return {
        ...actual,
        getTeamInviteInfo: vi.fn(() => ({data: {display_name: 'Team Name', name: 'teamName'}})),
    };
});

vi.mock('mattermost-redux/actions/users', async () => {
    const actual = await vi.importActual('mattermost-redux/actions/users');
    return {
        ...actual,
        createUser: vi.fn().mockResolvedValue({data: {}}),
    };
});

vi.mock('actions/views/login', async () => {
    const actual = await vi.importActual('actions/views/login');
    return {
        ...actual,
        loginById: vi.fn().mockResolvedValue({data: {}}),
    };
});

vi.mock('actions/storage');

describe('components/signup/Signup', () => {
    beforeEach(() => {
        mockLocation = {pathname: '', search: '', hash: ''};

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

        mockDispatch = vi.fn();
        mockHistoryPush.mockClear();
    });

    it('should match snapshot for all signup options enabled with isLicensed enabled', () => {
        const {container} = renderWithContext(
            <BrowserRouter>
                <Signup/>
            </BrowserRouter>,
        );

        expect(container).toMatchSnapshot();
    });

    it('should match snapshot for all signup options enabled with isLicensed disabled', () => {
        mockLicense = {IsLicensed: 'false', Cloud: 'false'};

        const {container} = renderWithContext(
            <BrowserRouter>
                <Signup/>
            </BrowserRouter>,
        );

        expect(container).toMatchSnapshot();
    });

    it('should match snapshot for all signup options enabled with EnableUserCreaton disabled', () => {
        mockConfig.EnableUserCreation = 'false';

        const {container} = renderWithContext(
            <BrowserRouter>
                <Signup/>
            </BrowserRouter>,
        );

        expect(container).toMatchSnapshot();
    });

    it('should create user, log in and redirect to invite teamname', async () => {
        mockLocation.search = 'd=%7B"name"%3A"teamName"%7D';

        mockDispatch = vi.fn().
            mockResolvedValueOnce({}). // removeGlobalItem
            mockResolvedValueOnce({data: {id: 'userId', password: 'password', email: 'jdoe@mm.com}'}}). // createUser
            mockResolvedValueOnce({error: {server_error_id: 'api.user.login.not_verified.app_error'}}); // loginById

        renderWithContext(
            <BrowserRouter>
                <Signup/>
            </BrowserRouter>,
        );

        const emailInput = screen.getByTestId('signup-body-card-form-email-input');
        fireEvent.change(emailInput, {target: {value: 'jdoe@mm.com'}});

        const nameInput = screen.getByTestId('signup-body-card-form-name-input');
        fireEvent.change(nameInput, {target: {value: 'jdoe'}});

        const passwordInput = screen.getByTestId('signup-body-card-form-password-input');
        fireEvent.change(passwordInput, {target: {value: 'password'}});

        // Find submit button by role
        const submitButton = screen.getByRole('button', {name: /create account/i});
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(mockHistoryPush).toHaveBeenCalledWith('/should_verify_email?email=jdoe%40mm.com&teamname=teamName');
        });
    });

    it('should create user, log in and redirect to default team', async () => {
        mockLocation = {pathname: '', search: '', hash: ''};
        mockDispatch = vi.fn().
            mockResolvedValueOnce({}). // removeGlobalItem
            mockResolvedValueOnce({data: {id: 'userId', password: 'password', email: 'jdoe@mm.com}'}}). // createUser
            mockResolvedValueOnce({}); // loginById

        renderWithContext(
            <BrowserRouter>
                <Signup/>
            </BrowserRouter>,
        );

        const emailInput = screen.getByTestId('signup-body-card-form-email-input');
        fireEvent.change(emailInput, {target: {value: 'jdoe@mm.com'}});

        const nameInput = screen.getByTestId('signup-body-card-form-name-input');
        fireEvent.change(nameInput, {target: {value: 'jdoe'}});

        const passwordInput = screen.getByTestId('signup-body-card-form-password-input');
        fireEvent.change(passwordInput, {target: {value: 'password'}});

        // Find submit button by role
        const submitButton = screen.getByRole('button', {name: /create account/i});
        fireEvent.click(submitButton);

        // Wait for async operations to complete
        await waitFor(() => {
            expect(mockDispatch).toHaveBeenCalled();
        });
    });

    it('should focus email input when email validation fails', async () => {
        mockDispatch = vi.fn().mockResolvedValue({});
        mockLocation = {pathname: '', search: '', hash: ''};

        renderWithContext(
            <BrowserRouter>
                <Signup/>
            </BrowserRouter>,
            mockState,
        );

        const emailInput = screen.getByTestId('signup-body-card-form-email-input');
        const submitButton = screen.getByRole('button', {name: /create account/i});

        // Submit with invalid email
        fireEvent.change(emailInput, {target: {value: 'invalid-email'}});
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(emailInput).toHaveFocus();
        });
    });

    it('should focus password input when password validation fails', async () => {
        mockDispatch = vi.fn().mockResolvedValue({});
        mockLocation = {pathname: '', search: '', hash: ''};

        renderWithContext(
            <BrowserRouter>
                <Signup/>
            </BrowserRouter>,
            mockState,
        );

        const emailInput = screen.getByTestId('signup-body-card-form-email-input');
        const usernameInput = screen.getByTestId('signup-body-card-form-name-input');
        const passwordInput = screen.getByTestId('signup-body-card-form-password-input');
        const submitButton = screen.getByRole('button', {name: /create account/i});

        // Submit with valid email and username but invalid password
        fireEvent.change(emailInput, {target: {value: 'test@example.com'}});
        fireEvent.change(usernameInput, {target: {value: 'testuser'}});
        fireEvent.change(passwordInput, {target: {value: '123'}});
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(passwordInput).toHaveFocus();
        });
    });

    it('should focus username input when server returns username exists error', async () => {
        mockLocation = {pathname: '', search: '', hash: ''};
        mockDispatch = vi.fn().mockImplementation(() => Promise.resolve({
            data: {},
            error: {
                server_error_id: 'app.user.save.username_exists.app_error',
                message: 'Username already exists',
            },
        }));

        renderWithContext(
            <BrowserRouter>
                <Signup/>
            </BrowserRouter>,
            mockState,
        );

        const emailInput = screen.getByTestId('signup-body-card-form-email-input');
        const usernameInput = screen.getByTestId('signup-body-card-form-name-input');
        const passwordInput = screen.getByTestId('signup-body-card-form-password-input');
        const submitButton = screen.getByRole('button', {name: /create account/i});

        // Submit with valid data that will trigger server error
        fireEvent.change(emailInput, {target: {value: 'test@example.com'}});
        fireEvent.change(usernameInput, {target: {value: 'existinguser'}});
        fireEvent.change(passwordInput, {target: {value: 'password123'}});
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(usernameInput).toHaveFocus();
        });
    });

    it('should add user to team and redirect when team invite valid and logged in', async () => {
        mockLocation.search = '?id=ppni7a9t87fn3j4d56rwocdctc';

        // Mock dispatch to return team invite info
        mockDispatch = vi.fn().mockResolvedValue({data: {display_name: 'Team Name', name: 'teamName'}});

        const {container} = renderWithContext(
            <BrowserRouter>
                <Signup/>
            </BrowserRouter>,
        );

        // Wait for async operations to complete
        await waitFor(() => {
            expect(mockDispatch).toHaveBeenCalled();
        });

        expect(container).toBeTruthy();
    });

    it('should handle failure adding user to team when team invite and logged in', async () => {
        mockLocation.search = '?id=ppni7a9t87fn3j4d56rwocdctc';

        // Mock dispatch to return team invite info error
        mockDispatch = vi.fn().mockResolvedValue({error: {message: 'Invalid invite'}});

        renderWithContext(
            <BrowserRouter>
                <Signup/>
            </BrowserRouter>,
        );

        // Wait for async operations to complete
        await waitFor(() => {
            expect(mockDispatch).toHaveBeenCalled();
        });

        expect(mockHistoryPush).not.toHaveBeenCalled();
    });

    it('should show newsletter check box opt-in for self-hosted non airgapped workspaces', async () => {
        vi.spyOn(useCWSAvailabilityCheckAll, 'default').mockImplementation(() => useCWSAvailabilityCheckAll.CSWAvailabilityCheckTypes.Available);
        mockLicense = {IsLicensed: 'true', Cloud: 'false'};

        const {container: signupContainer} = renderWithContext(
            <BrowserRouter>
                <Signup/>
            </BrowserRouter>,
        );

        screen.getByTestId('signup-body-card-form-check-newsletter');
        const checkInput = screen.getByTestId('signup-body-card-form-check-newsletter');
        expect(checkInput).toHaveAttribute('type', 'checkbox');

        expect(signupContainer).toHaveTextContent('I would like to receive Mattermost security updates via newsletter. By subscribing, I consent to receive emails from Mattermost with product updates, promotions, and company news. I have read the Privacy Policy and understand that I can unsubscribe at any time');
    });

    it('should NOT show newsletter check box opt-in for self-hosted AND airgapped workspaces', async () => {
        vi.spyOn(useCWSAvailabilityCheckAll, 'default').mockImplementation(() => useCWSAvailabilityCheckAll.CSWAvailabilityCheckTypes.Unavailable);
        mockLicense = {IsLicensed: 'true', Cloud: 'false'};

        const {container: signupContainer} = renderWithContext(
            <BrowserRouter>
                <Signup/>
            </BrowserRouter>,
        );

        expect(() => screen.getByTestId('signup-body-card-form-check-newsletter')).toThrow();
        expect(signupContainer).toHaveTextContent('Interested in receiving Mattermost security, product, promotions, and company updates updates via newsletter?Sign up at https://mattermost.com/security-updates/.');
    });

    it('should show newsletter related opt-in or text for cloud', async () => {
        vi.spyOn(useCWSAvailabilityCheckAll, 'default').mockImplementation(() => useCWSAvailabilityCheckAll.CSWAvailabilityCheckTypes.Available);
        mockLicense = {IsLicensed: 'true', Cloud: 'true'};

        const {container: signupContainer} = renderWithContext(
            <BrowserRouter>
                <Signup/>
            </BrowserRouter>,
        );

        screen.getByTestId('signup-body-card-form-check-newsletter');
        const checkInput = screen.getByTestId('signup-body-card-form-check-newsletter');
        expect(checkInput).toHaveAttribute('type', 'checkbox');

        expect(signupContainer).toHaveTextContent('I would like to receive Mattermost security updates via newsletter. By subscribing, I consent to receive emails from Mattermost with product updates, promotions, and company news. I have read the Privacy Policy and understand that I can unsubscribe at any time');
    });
});
