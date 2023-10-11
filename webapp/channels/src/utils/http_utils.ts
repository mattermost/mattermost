// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useLocation} from 'react-router-dom';

export function useQuery() {
    return new URLSearchParams(useLocation().search);
}
