// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import useShowAdminLimitReached from 'hooks/useShowAdminLimitReached';

export default function AdminCloudEffects() {
    useShowAdminLimitReached();

    return null;
}
