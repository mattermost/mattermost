// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';
import {useLocation} from 'react-router-dom';

export function useQuery() {
    const {search} = useLocation();

    const params = useMemo(() => {
        return new URLSearchParams(search);
    }, [search]);

    return params;
}
