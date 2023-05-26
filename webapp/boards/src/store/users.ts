// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    PayloadAction,
    createAsyncThunk,
    createSelector,
    createSlice,
} from '@reduxjs/toolkit'

import {default as client} from 'src/octoClient'
import {IUser, UserPreference, parseUserProps} from 'src/user'

import {Subscription} from 'src/wsclient'

import {initialLoad} from './initialLoad'

import {RootState} from './index'

export const fetchMe = createAsyncThunk(
    'users/fetchMe',
    async () => {
        const [me, myConfig] = await Promise.all([
            client.getMe(),
            client.getMyConfig(),
        ])

        return {me, myConfig}
    },
)

export const versionProperty = 'version72MessageCanceled'

type UsersStatus = {
    me: IUser|null
    boardUsers: {[key: string]: IUser}
    loggedIn: boolean|null
    blockSubscriptions: Subscription[]
    myConfig: Record<string, UserPreference>
}

export const fetchUserBlockSubscriptions = createAsyncThunk(
    'user/blockSubscriptions',
    async (userId: string) => client.getUserBlockSubscriptions(userId),
)

const initialState = {
    me: null,
    boardUsers: {},
    loggedIn: null,
    userWorkspaces: [],
    blockSubscriptions: [],
    myConfig: {},
} as UsersStatus

const usersSlice = createSlice({
    name: 'users',
    initialState,
    reducers: {
        setMe: (state, action: PayloadAction<IUser|null>) => {
            state.me = action.payload
            state.loggedIn = Boolean(state.me)
        },
        setBoardUsers: (state, action: PayloadAction<IUser[]>) => {
            state.boardUsers = action.payload.reduce((acc: {[key: string]: IUser}, user: IUser) => {
                acc[user.id] = user

                return acc
            }, {})
        },
        addBoardUsers: (state, action: PayloadAction<IUser[]>) => {
            action.payload.forEach((user: IUser) => {
                state.boardUsers[user.id] = user
            })
        },
        removeBoardUsersById: (state, action: PayloadAction<string[]>) => {
            action.payload.forEach((userId: string) => {
                delete state.boardUsers[userId]
            })
        },
        followBlock: (state, action: PayloadAction<Subscription>) => {
            state.blockSubscriptions.push(action.payload)
        },
        unfollowBlock: (state, action: PayloadAction<Subscription>) => {
            const oldSubscriptions = state.blockSubscriptions
            state.blockSubscriptions = oldSubscriptions.filter((subscription) => subscription.blockId !== action.payload.blockId)
        },
        patchProps: (state, action: PayloadAction<UserPreference[]>) => {
            state.myConfig = parseUserProps(action.payload)
        },
    },
    extraReducers: (builder) => {
        builder.addCase(fetchMe.fulfilled, (state, action) => {
            state.me = action.payload.me || null
            state.loggedIn = Boolean(state.me)
            if (action.payload.myConfig) {
                state.myConfig = parseUserProps(action.payload.myConfig)
            }
        })
        builder.addCase(fetchMe.rejected, (state) => {
            state.me = null
            state.loggedIn = false
            state.myConfig = {}
        })

        // TODO: change this when the initial load is complete
        // builder.addCase(initialLoad.fulfilled, (state, action) => {
        //     state.boardUsers = action.payload.boardUsers.reduce((acc: {[key: string]: IUser}, user: IUser) => {
        //         acc[user.id] = user
        //         return acc
        //     }, {})
        // })

        builder.addCase(fetchUserBlockSubscriptions.fulfilled, (state, action) => {
            state.blockSubscriptions = action.payload
        })

        builder.addCase(initialLoad.fulfilled, (state, action) => {
            if (action.payload.myConfig) {
                state.myConfig = parseUserProps(action.payload.myConfig)
            }
        })
    },
})

export const {setMe, setBoardUsers, removeBoardUsersById, addBoardUsers, followBlock, unfollowBlock, patchProps} = usersSlice.actions
export const {reducer} = usersSlice

export const getMe = (state: RootState): IUser|null => state.users.me
export const getLoggedIn = (state: RootState): boolean|null => state.users.loggedIn
export const getBoardUsers = (state: RootState): {[key: string]: IUser} => state.users.boardUsers
export const getMyConfig = (state: RootState): Record<string, UserPreference> => state.users.myConfig || {} as Record<string, UserPreference>

export const getBoardUsersList = createSelector(
    getBoardUsers,
    (boardUsers) => Object.values(boardUsers).sort((a, b) => a.username.localeCompare(b.username)),
)

export const getUser = (userId: string): (state: RootState) => IUser|undefined => {
    return (state: RootState): IUser|undefined => {
        const users = getBoardUsers(state)

        return users[userId]
    }
}

export const getOnboardingTourStarted = createSelector(
    getMyConfig,
    (myConfig): boolean => {
        if (!myConfig) {
            return false
        }

        return Boolean(myConfig.onboardingTourStarted?.value)
    },
)

export const getOnboardingTourStep = createSelector(
    getMyConfig,
    (myConfig): string => {
        if (!myConfig) {
            return ''
        }

        return myConfig.onboardingTourStep?.value
    },
)

export const getOnboardingTourCategory = createSelector(
    getMyConfig,
    (myConfig): string => (myConfig.tourCategory ? myConfig.tourCategory.value : ''),
)

export const getVersionMessageCanceled = createSelector(
    getMe,
    getMyConfig,
    (me, myConfig): boolean => {
        if (versionProperty && me) {
            if (me.id === 'single-user') {
                return true
            }

            return Boolean(myConfig[versionProperty]?.value)
        }

        return true
    },
)

export const getCardLimitSnoozeUntil = createSelector(
    getMyConfig,
    (myConfig): number => {
        if (!myConfig) {
            return 0
        }
        try {
            return parseInt(myConfig.cardLimitSnoozeUntil?.value || '0', 10)
        } catch (_) {
            return 0
        }
    },
)

export const getCardHiddenWarningSnoozeUntil = createSelector(
    getMyConfig,
    (myConfig): number => {
        if (!myConfig) {
            return 0
        }
        try {
            return parseInt(myConfig.cardHiddenWarningSnoozeUntil?.value || 0, 10)
        } catch (_) {
            return 0
        }
    },
)
