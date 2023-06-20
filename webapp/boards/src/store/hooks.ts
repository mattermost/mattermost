// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TypedUseSelectorHook, useDispatch, useSelector} from 'react-redux'

import type {AppDispatch, RootState} from '.'

export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
