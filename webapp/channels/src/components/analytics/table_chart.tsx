// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';

import {WithTooltip} from '@mattermost/shared/components/tooltip';

export type TableItem = {
    name: string;
    tip: string;
    value: React.ReactNode;
};
type Props = {
    title: React.ReactNode;
    data: TableItem[];
    id?: string;
};

const TableChart = ({
    title,
    data,
    id,
}: Props) => (
    <div className='col-sm-6'>
        <div
            data-testid={id ? id + 'Chart' : undefined}
            className='total-count recent-active-users'
        >
            <div
                data-testid={id ? id + 'Title' : undefined}
                className='title'
            >
                {title}
            </div>
            <div
                data-testid={id ? id + 'Content' : undefined}
                className='content'
            >
                <table>
                    <tbody>
                        {
                            data.map((item) => (
                                <tr key={'table-entry-' + item.name}>
                                    <td>
                                        <WithTooltip
                                            title={item.tip}
                                        >
                                            <span>{item.name}</span>
                                        </WithTooltip>
                                    </td>
                                    <td>{item.value}</td>
                                </tr>
                            ))
                        }
                    </tbody>
                </table>
            </div>
        </div>
    </div>
);

export default memo(TableChart);
