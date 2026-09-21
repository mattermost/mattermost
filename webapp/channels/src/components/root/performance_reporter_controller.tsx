// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect} from 'react';
import {useStore} from 'react-redux';

import {Client4} from 'mattermost-redux/client';

import DesktopAppAPI from 'utils/desktop_api';
import PerformanceReporter from 'utils/performance_telemetry/reporter';

import type {GlobalState} from 'types/store';

export default function PerformanceReporterController() {
    const store = useStore<GlobalState>();

    useEffect(() => {
        const reporter = new PerformanceReporter(Client4, store, DesktopAppAPI);
        reporter.observe();

        return () => {
            reporter.disconnect();
        };
    }, [store]);

    return null;
}
