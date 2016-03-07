// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Constants from '../../utils/constants.jsx';

const Tooltip = ReactBootstrap.Tooltip;
const OverlayTrigger = ReactBootstrap.OverlayTrigger;

export default class TableChart extends React.Component {
    render() {
        return (
            <div className='col-sm-6'>
                <div className='total-count recent-active-users'>
                    <div className='title'>
                        {this.props.title}
                    </div>
                    <div className='content'>
                        <table>
                            <tbody>
                                {
                                    this.props.data.map((item) => {
                                        const tooltip = (
                                            <Tooltip id={'tip-table-entry-' + item.name}>
                                                {item.tip}
                                            </Tooltip>
                                        );

                                        return (
                                            <tr key={'table-entry-' + item.name}>
                                                <td>
                                                    <OverlayTrigger
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
}

TableChart.propTypes = {
    title: React.PropTypes.node,
    data: React.PropTypes.array
};
