// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {isCurrentLicenseCloud} from 'mattermost-redux/selectors/entities/cloud';
import {getUsage} from 'mattermost-redux/selectors/entities/usage';

import {
    getMessagesUsage,
    getFilesUsage,
    getTeamsUsage,
} from 'actions/cloud';

import {useIsLoggedIn} from 'components/global_header/hooks';

import type {CloudUsage} from '@mattermost/types/cloud';

export default function useGetUsage(): CloudUsage {
    const usage = useSelector(getUsage);
    const isCloud = useSelector(isCurrentLicenseCloud);
    const isLoggedIn = useIsLoggedIn();

    const dispatch = useDispatch();

    const [requestedMessages, setRequestedMessages] = useState(false);
    useEffect(() => {
        if (isLoggedIn && isCloud && !requestedMessages && !usage.messages.historyLoaded) {
            dispatch(getMessagesUsage());
            setRequestedMessages(true);
        }
    }, [isLoggedIn, isCloud, requestedMessages, usage.messages.historyLoaded]);

    const [requestedStorage, setRequestedStorage] = useState(false);
    useEffect(() => {
        if (isLoggedIn && isCloud && !requestedStorage && !usage.files.totalStorageLoaded) {
            dispatch(getFilesUsage());
            setRequestedStorage(true);
        }
    }, [isLoggedIn, isCloud, requestedStorage, usage.files.totalStorageLoaded]);

    const [requestedTeamsUsage, setRequestedTeamsUsage] = useState(false);
    useEffect(() => {
        if (isLoggedIn && isCloud && !requestedTeamsUsage && !usage.teams.teamsLoaded) {
            dispatch(getTeamsUsage());
            setRequestedTeamsUsage(true);
        }
    }, [isLoggedIn, isCloud, requestedTeamsUsage, usage.teams.teamsLoaded]);

    return usage;
}
