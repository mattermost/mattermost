// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState, memo} from 'react';

import {Client4} from 'mattermost-redux/client';

import Code from './components/code';

const SystemInfo = () => {
    const [systemInfo, setSystemInfo] = useState<Record<string, unknown>|null>(null);

    useEffect(() => {
        Client4.getDebugBarSystemInfo().then((result) => {
            setSystemInfo(result);
        });
        const interval = setInterval(() => {
            Client4.getDebugBarSystemInfo().then((result) => {
                setSystemInfo(result);
            });
        }, 1000);
        return () => {
            clearInterval(interval);
        };
    }, []);

    return (
        <div className='p-2'>
            <Code
                code={JSON.stringify(systemInfo, null, 4)}
                language='json'
                inline={false}
            />
        </div>
    );
};

export default memo(SystemInfo);
