// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useState} from 'react';
import {useSelector} from 'react-redux';

import {isAnyModalOpen} from 'selectors/views/modals';

export default function useShouldClose(): boolean {
    const [shouldClose, setShouldClose] = useState(false);
    const [initialHasOpenModals, setInitialHasOpenModals] = useState(false);
    const hasOpenModals = useSelector(isAnyModalOpen);

    useEffect(() => {
        setInitialHasOpenModals(hasOpenModals);
    }, []);

    useEffect(() => {
        if (initialHasOpenModals !== hasOpenModals) {
            setShouldClose(true);
        }
    }, [initialHasOpenModals, hasOpenModals]);

    return shouldClose;
}
