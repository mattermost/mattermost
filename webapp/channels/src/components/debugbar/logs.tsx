// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useState} from 'react';
import {useSelector} from 'react-redux';
import cn from 'classnames';
import {FixedSizeList as List} from 'react-window';

import {getLogs} from 'mattermost-redux/selectors/entities/debugbar';

import type {DebugBarLog} from '@mattermost/types/debugbar';
import type {GlobalState} from '@mattermost/types/store';

import {Input, Footer, Empty, Code, Time} from './components';

type Props = {
    height: number;
    width: number;
}

type RowProps = {
    data: DebugBarLog[];
    index: number;
    style: React.CSSProperties;
}

function Row({data, index, style}: RowProps) {
    return (
        <div
            key={data[index].time + '_' + data[index].message}
            className='DebugBarTable__row'
            style={style}
        >
            <div className={cn('time', {error: data[index].level === 'error'})}>
                <Time time={data[index].time}/>
            </div>
            <div
                className='logMessage'
                title={data[index].message}
            >
                {data[index].message}
            </div>
            <div
                className='json'
                title={JSON.stringify(data[index].fields, null, 4)}
            >
                <Code
                    code={JSON.stringify(data[index].fields)}
                    language='json'
                />
            </div>
            <div className='level'>
                <small className={data[index].level}>{data[index].level}</small>
            </div>
        </div>
    );
}

function Logs({height, width}: Props) {
    const [level, setLevel] = useState('info');
    const [regex, setRegex] = useState<RegExp>();

    const logs = useSelector((state) => getLogs(state as GlobalState, level, regex));

    return (
        <div className='DebugBarTable'>
            {logs.length > 0 ? (
                <List
                    itemData={logs}
                    itemCount={logs.length}
                    itemSize={50}
                    height={height - 32}
                    width={width - 2}
                >
                    {Row}
                </List>
            ) : (
                <Empty height={height - 32}/>
            )}
            <Footer>
                <Input
                    onChange={setRegex}
                />
                <div className='Footer--right'>
                    <button
                        className={cn('debug', {active: level === 'debug'})}
                        onClick={() => setLevel('debug')}
                    >
                        {'DEBUG'}
                    </button>
                    <button
                        className={cn('info', {active: level === 'info'})}
                        onClick={() => setLevel('info')}
                    >
                        {'INFO'}
                    </button>
                    <button
                        className={cn('warn', {active: level === 'warn'})}
                        onClick={() => setLevel('warn')}
                    >
                        {'WARN'}
                    </button>
                    <button
                        className={cn('error', {active: level === 'error'})}
                        onClick={() => setLevel('error')}
                    >
                        {'ERROR'}
                    </button>
                </div>
            </Footer>
        </div>
    );
}

export default memo(Logs);
