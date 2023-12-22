// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useState} from 'react';

export function usePagingMeta(groupType: string): [number, (page: number) => void] {
    const [page, setPage] = useState(0);
    const [myGroupsPage, setMyGroupsPage] = useState(0);
    const [archivedGroupsPage, setArchivedGroupsPage] = useState(0);
    if (groupType === 'all') {
        return [page, setPage];
    } else if (groupType === 'my') {
        return [myGroupsPage, setMyGroupsPage];
    }

    return [
        archivedGroupsPage,
        setArchivedGroupsPage,
    ];
}
