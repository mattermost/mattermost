// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useState} from 'react';
import {useDispatch} from 'react-redux';

import {getFilteredUsersStats} from 'mattermost-redux/actions/users';

const useGetTotalUsersNoBots = (includeInactive = false): number => {
    const dispatch = useDispatch();
    const [userCount, setUserCount] = useState<number>(0);

    useEffect(() => {
        const getTotalUsers = async () => {
            const {data} = await dispatch(getFilteredUsersStats({include_bots: false, include_deleted: includeInactive}, false));
            setUserCount(data?.total_users_count ?? 0);
        };

        getTotalUsers();
    }, []);

    return userCount;
};

export default useGetTotalUsersNoBots;
