// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useState} from 'react';
import {useSelector} from 'react-redux';
import cn from 'classnames';
import {FixedSizeList as List} from 'react-window';

import {getApiCalls} from 'mattermost-redux/selectors/entities/debugbar';

import {DebugBarAPICall} from '@mattermost/types/debugbar';
import {GlobalState} from '@mattermost/types/store';

import {Empty, Footer, Time, Input} from './components';

type Props = {
    height: number;
    width: number;
}

type RowProps = {
    data: DebugBarAPICall[];
    index: number;
    style: React.CSSProperties;
}

function Row({data, index, style}: RowProps) {
    function getStatusClassName(status: number): string {
        switch (true) {
        case status >= 400:
            return 'error';
        case status >= 300:
            return 'warn';
        default:
            return 'success';
        }
    }

    return (
        <div
            key={data[index].time + '_' + data[index].duration}
            className='DebugBarTable__row'
            style={style}
        >
            <div className={cn('time', getStatusClassName(Number(data[index].statusCode)))}>
                <Time time={data[index].time}/>
            </div>
            <div className='method'>{data[index].method}</div>
            <div>{data[index].endpoint}</div>
            <div className='duration'>
                <small className='duration mr-1'>{(data[index].duration * 1000).toFixed(4) + 'ms'}</small>
                <small className={getStatusClassName(Number(data[index].statusCode))}>
                    {data[index].statusCode}
                </small>
            </div>
        </div>
    );
}

function ApiCalls({height, width}: Props) {
    const [regex, setRegex] = useState<RegExp>();
    const calls = useSelector((state) => getApiCalls(state as GlobalState, regex));

    return (
        <div className='DebugBarTable'>
            {calls.length > 0 ? (
                <List
                    itemData={calls}
                    itemCount={calls.length}
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
                <Input onChange={setRegex}/>
            </Footer>
        </div>
    );
}

export default memo(ApiCalls);
