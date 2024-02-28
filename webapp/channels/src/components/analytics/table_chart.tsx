// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';

import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

import Constants from 'utils/constants';

export type TableItem = {
    name: string;
    tip: string;
    value: React.ReactNode;
}
type Props = {
    title: React.ReactNode;
    data: TableItem[];
}

const TableChart = ({
    title,
    data,
}: Props) => (
    <div className='col-sm-6'>
        <div className='total-count recent-active-users'>
            <div className='title'>
                {title}
            </div>
            <div className='content'>
                <table>
                    <tbody>
                        {
                            data.map((item) => (
                                <tr key={'table-entry-' + item.name}>
                                    <td>
                                        <OverlayTrigger
                                            delayShow={Constants.OVERLAY_TIME_DELAY}
                                            placement='top'
                                            overlay={(
                                                <Tooltip id={'tip-table-entry-' + item.name}>
                                                    {item.tip}
                                                </Tooltip>
                                            )}
                                        >
                                            <time>
                                                {item.name}
                                            </time>
                                        </OverlayTrigger>
                                    </td>
                                    <td>
                                        {item.value}
                                    </td>
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
