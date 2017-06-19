import PropTypes from 'prop-types';

// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {FormattedMessage} from 'react-intl';
import * as Utils from 'utils/utils.jsx';

import statusGreen from 'images/status_green.png';
import statusYellow from 'images/status_yellow.png';

export default class ClusterTable extends React.Component {
    static propTypes = {
        clusterInfos: PropTypes.array.isRequired,
        reload: PropTypes.func.isRequired
    }

    render() {
        var versionMismatch = (
            <img
                className='cluster-status'
                src={statusGreen}
            />
        );

        var configMismatch = (
            <img
                className='cluster-status'
                src={statusGreen}
            />
        );

        var version = '';
        var configHash = '';
        var singleItem = false;

        if (this.props.clusterInfos.length) {
            version = this.props.clusterInfos[0].version;
            configHash = this.props.clusterInfos[0].config_hash;
            singleItem = this.props.clusterInfos.length === 1;
        }

        this.props.clusterInfos.map((clusterInfo) => {
            if (clusterInfo.version !== version) {
                versionMismatch = (
                    <img
                        className='cluster-status'
                        src={statusYellow}
                    />
                );
            }

            if (clusterInfo.config_hash !== configHash) {
                configMismatch = (
                    <img
                        className='cluster-status'
                        src={statusYellow}
                    />
                );
            }

            return null;
        });

        var items = this.props.clusterInfos.map((clusterInfo) => {
            var status = null;

            if (clusterInfo.hostname === '') {
                clusterInfo.hostname = Utils.localizeMessage('admin.cluster.unknown', 'unknown');
            }

            if (clusterInfo.version === '') {
                clusterInfo.version = Utils.localizeMessage('admin.cluster.unknown', 'unknown');
            }

            if (clusterInfo.config_hash === '') {
                clusterInfo.config_hash = Utils.localizeMessage('admin.cluster.unknown', 'unknown');
            }

            if (singleItem) {
                status = (
                    <img
                        className='cluster-status'
                        src={statusYellow}
                    />
                );
            } else {
                status = (
                    <img
                        className='cluster-status'
                        src={statusGreen}
                    />
                );
            }

            return (
                <tr key={clusterInfo.ipaddress}>
                    <td style={{whiteSpace: 'nowrap'}}>{status}</td>
                    <td style={{whiteSpace: 'nowrap'}}>{clusterInfo.hostname}</td>
                    <td style={{whiteSpace: 'nowrap'}}>{versionMismatch} {clusterInfo.version}</td>
                    <td style={{whiteSpace: 'nowrap'}}><div className='config-hash'>{configMismatch} {clusterInfo.config_hash}</div></td>
                    <td style={{whiteSpace: 'nowrap'}}>{clusterInfo.ipaddress}</td>
                </tr>
            );
        });

        return (
            <div
                className='cluster-panel__table'
                style={{
                    margin: '10px',
                    marginBottom: '30px'
                }}
            >
                <div className='text-right'>
                    <button
                        type='submit'
                        className='btn btn-link'
                        onClick={this.props.reload}
                    >
                        <i className='fa fa-refresh'/>
                        <FormattedMessage
                            id='admin.cluster.status_table.reload'
                            defaultMessage=' Reload Cluster Status'
                        />
                    </button>
                </div>
                <table className='table'>
                    <thead>
                        <tr>
                            <th>
                                <FormattedMessage
                                    id='admin.cluster.status_table.status'
                                    defaultMessage='Status'
                                />
                            </th>
                            <th>
                                <FormattedMessage
                                    id='admin.cluster.status_table.hostname'
                                    defaultMessage='Hostname'
                                />
                            </th>
                            <th>
                                <FormattedMessage
                                    id='admin.cluster.status_table.version'
                                    defaultMessage='Version'
                                />
                            </th>
                            <th>
                                <FormattedMessage
                                    id='admin.cluster.status_table.config_hash'
                                    defaultMessage='Config File MD5'
                                />
                            </th>
                            <th>
                                <FormattedMessage
                                    id='admin.cluster.status_table.url'
                                    defaultMessage='Gossip Address'
                                />
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {items}
                    </tbody>
                </table>
            </div>
        );
    }
}
