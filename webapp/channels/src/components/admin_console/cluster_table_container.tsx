// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import type {MouseEvent} from 'react';

import type {ClusterInfo} from '@mattermost/types/admin';

import {getClusterStatus} from 'actions/admin_actions.jsx';

import ClusterTable from './cluster_table';

import LoadingScreen from '../loading_screen';

const ClusterTableContainer = () => {
    const interval = useRef<NodeJS.Timeout>();
    const [clusterInfos, setClusterInfos] = useState<ClusterInfo[] | null>(null);

    const load = useCallback(() => {
        setClusterInfos(null);
        getClusterStatus(setClusterInfos, null);
    }, []);

    useEffect(() => {
        load();
        interval.current = setInterval(load, 15000);
        return () => {
            if (interval.current) {
                clearInterval(interval.current);
            }
        };
    }, []);

    const reload = useCallback((e: MouseEvent<HTMLButtonElement>) => {
        if (e) {
            e.preventDefault();
        }

        setClusterInfos(null);

        load();
    }, [load]);

    if (clusterInfos == null) {
        return (<LoadingScreen/>);
    }

    return (
        <ClusterTable
            clusterInfos={clusterInfos}
            reload={reload}
        />
    );
};

export default React.memo(ClusterTableContainer);
