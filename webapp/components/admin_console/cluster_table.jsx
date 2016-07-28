// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {FormattedMessage} from 'react-intl';
import * as Utils from 'utils/utils.jsx';

import statusGreen from 'images/status_green.png';
import statusRed from 'images/status_red.png';

export default class ClusterTable extends React.Component {
    static propTypes = {
        clusterInfos: React.PropTypes.array.isRequired,
        reload: React.PropTypes.func.isRequired
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

        if (this.props.clusterInfos.length) {
            version = this.props.clusterInfos[0].version;
            configHash = this.props.clusterInfos[0].config_hash;
        }

        this.props.clusterInfos.map((clusterInfo) => {
            if (clusterInfo.version !== version) {
                versionMismatch = (
                    <img
                        className='cluster-status'
                        src={statusRed}
                    />
                );
            }

            if (clusterInfo.config_hash !== configHash) {
                configMismatch = (
                    <img
                        className='cluster-status'
                        src={statusRed}
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

            if (clusterInfo.id === '') {
                clusterInfo.id = Utils.localizeMessage('admin.cluster.unknown', 'unknown');
            }

            if (clusterInfo.is_alive) {
                status = (
                    <img
                        className='cluster-status'
                        src={statusGreen}
                    />
                );
            } else {
                status = (
                    <img
                        className='cluster-status'
                        src={statusRed}
                    />
                );
            }

            return (
                <tr key={clusterInfo.id}>
                    <td style={{whiteSpace: 'nowrap'}}>{status}</td>
                    <td style={{whiteSpace: 'nowrap'}}>{clusterInfo.hostname}</td>
                    <td style={{whiteSpace: 'nowrap'}}>{versionMismatch} {clusterInfo.version}</td>
                    <td style={{whiteSpace: 'nowrap'}}><div className='config-hash'>{configMismatch} {clusterInfo.config_hash}</div></td>
                    <td style={{whiteSpace: 'nowrap'}}>{clusterInfo.internode_url}</td>
                    <td style={{whiteSpace: 'nowrap'}}><div className='config-hash'>{clusterInfo.id}</div></td>
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
                        <i className='fa fa-refresh'></i>
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
                                    defaultMessage='Inter-Node URL'
                                />
                            </th>
                            <th>
                                <FormattedMessage
                                    id='admin.cluster.status_table.id'
                                    defaultMessage='Node ID'
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