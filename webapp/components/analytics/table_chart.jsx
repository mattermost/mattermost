// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Constants from 'utils/constants.jsx';

import {Tooltip, OverlayTrigger} from 'react-bootstrap';

import PropTypes from 'prop-types';

import React from 'react';

export default function TableChart(props) {
    return (
        <div className='col-sm-6'>
            <div className='total-count recent-active-users'>
                <div className='title'>
                    {props.title}
                </div>
                <div className='content'>
                    <table>
                        <tbody>
                            {
                                props.data.map((item) => {
                                    const tooltip = (
                                        <Tooltip id={'tip-table-entry-' + item.name}>
                                            {item.tip}
                                        </Tooltip>
                                    );

                                    return (
                                        <tr key={'table-entry-' + item.name}>
                                            <td>
                                                <OverlayTrigger
                                                    trigger={['hover', 'focus']}
                                                    delayShow={Constants.OVERLAY_TIME_DELAY}
                                                    placement='top'
                                                    overlay={tooltip}
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
                                    );
                                })
                            }
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

TableChart.propTypes = {
    title: PropTypes.node,
    data: PropTypes.array
};
