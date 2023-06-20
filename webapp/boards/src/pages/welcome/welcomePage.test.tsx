// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import {render, screen, waitFor} from '@testing-library/react'

import {createMemoryHistory} from 'history'

import {Router} from 'react-router-dom'

import {Provider as ReduxProvider} from 'react-redux'

import userEvent from '@testing-library/user-event'

import configureStore from 'redux-mock-store'

import {mocked} from 'jest-mock'

import thunk from 'redux-thunk'

import {wrapIntl} from 'src/testUtils'

import mutator from 'src/mutator'

import octoClient from 'src/octoClient'

import {IUser} from 'src/user'

import WelcomePage from './welcomePage'

const w = (window as any)
const oldBaseURL = w.baseURL

jest.mock('src/mutator')
const mockedMutator = mocked(mutator)

jest.mock('src/octoClient')
const mockedOctoClient = mocked(octoClient)

beforeEach(() => {
    jest.resetAllMocks()
    mockedMutator.patchUserConfig.mockImplementation(() => Promise.resolve([
        {
            user_id: '',
            category: 'focalboard',
            name: 'welcomePageViewed',
            value: '1',
        },
    ]))
    mockedOctoClient.prepareOnboarding.mockResolvedValue({
        teamID: 'team_id_1',
        boardID: 'board_id_1',
    })
})

afterEach(() => {
    w.baseURL = oldBaseURL
})

describe('pages/welcome', () => {
    let history = createMemoryHistory()
    const mockStore = configureStore([thunk])
    const store = mockStore({
        teams: {
            current: {id: 'team_id_1'},
        },
        users: {
            me: {
                props: {},
            },
            myConfig: {
                onboardingTourStep: {value: '0'},
                tourCategory: {value: 'onboarding'},
            },
        },
    })

    beforeEach(() => {
        history = createMemoryHistory()
    })

    test('Welcome Page shows Explore Page', () => {
        const component = (
            <ReduxProvider store={store}>
                {
                    wrapIntl(
                        <Router history={history}>
                            <WelcomePage/>
                        </Router>,
                    )
                }
            </ReduxProvider>
        )

        const {container} = render(component)
        expect(screen.getByText('Take a tour')).toBeDefined()
        expect(container).toMatchSnapshot()
    })

    test('Welcome Page shows Explore Page with subpath', () => {
        w.baseURL = '/subpath'
        const component = (
            <ReduxProvider store={store}>
                {
                    wrapIntl(
                        <Router history={history}>
                            <WelcomePage/>
                        </Router>,
                    )
                }
            </ReduxProvider>
        )

        const {container} = render(component)
        expect(screen.getByText('Take a tour')).toBeDefined()
        expect(container).toMatchSnapshot()
    })

    test('Welcome Page shows Explore Page And Then Proceeds after Clicking Explore', async () => {
        history.replace = jest.fn()

        const component = (
            <ReduxProvider store={store}>
                {
                    wrapIntl(
                        <Router history={history}>
                            <WelcomePage/>
                        </Router>,
                    )
                }
            </ReduxProvider>
        )

        render(component)
        const exploreButton = screen.getByText('No thanks, I\'ll figure it out myself')
        expect(exploreButton).toBeDefined()
        await userEvent.click(exploreButton)
        await waitFor(() => {
            expect(history.replace).toBeCalledWith('/team/team_id_1')
            expect(mockedMutator.patchUserConfig).toBeCalledTimes(1)
        })
    })

    test('Welcome Page does not render explore page the second time we visit it', async () => {
        history.replace = jest.fn()
        const customStore = mockStore({
            teams: {
                current: {id: 'team_id_1'},
            },
            users: {
                me: {},
                myConfig: {
                    welcomePageViewed: {value: '1'},
                },
            },
        })

        const component = (
            <ReduxProvider store={customStore}>
                {
                    wrapIntl(
                        <Router history={history}>
                            <WelcomePage/>
                        </Router>,
                    )
                }
            </ReduxProvider>
        )

        render(component)
        await waitFor(() => {
            expect(history.replace).toBeCalledWith('/team/team_id_1')
        })
    })

    test('Welcome Page redirects us when we have a r query parameter with welcomePageViewed set to true', async () => {
        history.replace = jest.fn()
        history.location.search = 'r=123'

        const customStore = mockStore({
            teams: {
                current: {id: 'team_id_1'},
            },
            users: {
                me: {},
                myConfig: {
                    welcomePageViewed: {value: '1'},
                },
            },
        })
        const component = (
            <ReduxProvider store={customStore}>
                {
                    wrapIntl(
                        <Router history={history}>
                            <WelcomePage/>
                        </Router>,
                    )
                }
            </ReduxProvider>
        )

        render(component)
        await waitFor(() => {
            expect(history.replace).toBeCalledWith('123')
        })
    })

    test('Welcome Page redirects us when we have a r query parameter with welcomePageViewed set to null', async () => {
        history.replace = jest.fn()
        history.location.search = 'r=123'

        const localStore = mockStore({
            teams: {
                current: {id: 'team_id_1'},
            },
            users: {
                me: {
                    props: {},
                },
            },
        })

        const component = (
            <ReduxProvider store={localStore}>
                {
                    wrapIntl(
                        <Router history={history}>
                            <WelcomePage/>
                        </Router>,
                    )
                }
            </ReduxProvider>
        )
        render(component)
        const exploreButton = screen.getByText('No thanks, I\'ll figure it out myself')
        expect(exploreButton).toBeDefined()
        await userEvent.click(exploreButton)
        await waitFor(() => {
            expect(history.replace).toBeCalledWith('123')
            expect(mockedMutator.patchUserConfig).toBeCalledTimes(1)
        })
    })

    test('Welcome page starts tour on clicking Take a tour button', async () => {
        history.replace = jest.fn()
        const user = {} as unknown as IUser
        mockedOctoClient.getMe.mockResolvedValue(user)

        const component = (
            <ReduxProvider store={store}>
                {
                    wrapIntl(
                        <Router history={history}>
                            <WelcomePage/>
                        </Router>,
                    )
                }
            </ReduxProvider>
        )
        render(component)
        const exploreButton = screen.getByText('Take a tour')
        expect(exploreButton).toBeDefined()
        await userEvent.click(exploreButton)
        await waitFor(() => expect(mockedOctoClient.prepareOnboarding).toBeCalledTimes(1))
        await waitFor(() => expect(history.replace).toBeCalledWith('/team/team_id_1/board_id_1'))
    })

    test('Welcome page skips tour on clicking no thanks option', async () => {
        history.replace = jest.fn()
        const user = {} as unknown as IUser
        mockedOctoClient.getMe.mockResolvedValue(user)

        const component = (
            <ReduxProvider store={store}>
                {
                    wrapIntl(
                        <Router history={history}>
                            <WelcomePage/>
                        </Router>,
                    )
                }
            </ReduxProvider>
        )
        render(component)
        const exploreButton = screen.getByText('No thanks, I\'ll figure it out myself')
        expect(exploreButton).toBeDefined()
        await userEvent.click(exploreButton)
        await waitFor(() => expect(history.replace).toBeCalledWith('/team/team_id_1'))
    })
})
