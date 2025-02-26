// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {PureComponent} from 'react';
import type {CSSProperties, MouseEvent} from 'react';
import {FormattedMessage} from 'react-intl';

import ReloadIcon from 'components/widgets/icons/fa_reload_icon';
import WarningIcon from 'components/widgets/icons/fa_warning_icon';

import statusGreen from 'images/status_green.png';
import statusYellow from 'images/status_yellow.png';

type Props = {
    clusterInfos: Array<{
        version: string;
        config_hash: string;
        hostname: string;
        ipaddress: string;
        schema_version: string;
    }>;
    reload: (e: MouseEvent<HTMLButtonElement>) => void;
}

type Style = {
    clusterTable: CSSProperties;
    clusterCell: CSSProperties;
    warning: CSSProperties;
}

export default class ClusterTable extends PureComponent<Props> {
    render() {
        let versionMismatch = (
            <img
                alt='version mismatch'
                className='cluster-status'
                src={statusGreen}
            />
        );
        let configMismatch = (
            <img
                alt='config mismatch'
                className='cluster-status'
                src={statusGreen}
            />
        );
        let versionMismatchWarning = (
            <div/>
        );
        let version = '';
        let configHash = '';
        let singleItem = false;

        if (this.props.clusterInfos.length) {
            version = this.props.clusterInfos[0].version;
            configHash = this.props.clusterInfos[0].config_hash;
            singleItem = this.props.clusterInfos.length === 1;
        }

        this.props.clusterInfos.map((clusterInfo) => {
            if (clusterInfo.version !== version) {
                versionMismatch = (
                    <img
                        alt='version mismatch'
                        className='cluster-status'
                        src={statusYellow}
                    />
                );
                versionMismatchWarning = (
                    <div
                        style={style.warning}
                        className='alert alert-warning'
                    >
                        <WarningIcon/>
                        <FormattedMessage
                            id='admin.cluster.version_mismatch_warning'
                            defaultMessage='WARNING: Multiple versions of Mattermost has been detected in your HA cluster. Unless you are currently performing an upgrade please ensure all nodes in your cluster are running the same Mattermost version to avoid platform disruption.'
                        />
                    </div>
                );
            }

            if (clusterInfo.config_hash !== configHash) {
                configMismatch = (
                    <img
                        alt='config mismatch'
                        className='cluster-status'
                        src={statusYellow}
                    />
                );
            }

            return null;
        });

        const items = this.props.clusterInfos.map((clusterInfo) => {
            let status = null;

            let hostname: React.ReactNode = clusterInfo.hostname;
            if (hostname === '') {
                hostname = (
                    <FormattedMessage
                        id='admin.cluster.unknown'
                        defaultMessage='unknown'
                    />
                );
            }

            let version: React.ReactNode = clusterInfo.version;
            if (version === '') {
                version = (
                    <FormattedMessage
                        id='admin.cluster.unknown'
                        defaultMessage='unknown'
                    />
                );
            }

            let configHash: React.ReactNode = clusterInfo.config_hash;
            if (configHash === '') {
                configHash = (
                    <FormattedMessage
                        id='admin.cluster.unknown'
                        defaultMessage='unknown'
                    />
                );
            }

            if (singleItem) {
                status = (
                    <img
                        alt='Cluster status'
                        className='cluster-status'
                        src={statusYellow}
                    />
                );
            } else {
                status = (
                    <img
                        alt='Cluster status'
                        className='cluster-status'
                        src={statusGreen}
                    />
                );
            }

            return (
                <tr key={clusterInfo.ipaddress}>
                    <td style={style.clusterCell}>{status}</td>
                    <td style={style.clusterCell}>{hostname}</td>
                    <td style={style.clusterCell}>{versionMismatch} {version}</td>
                    <td style={style.clusterCell}><div className='config-hash'>{configMismatch} {configHash}</div></td>
                    <td style={style.clusterCell}>{clusterInfo.ipaddress}</td>
                    <td style={style.clusterCell}>{clusterInfo.schema_version}</td>
                </tr>
            );
        });

        return (
            <div
                className='cluster-panel__table'
                style={style.clusterTable}
            >
                <div className='text-right'>
                    <button
                        type='submit'
                        className='btn btn-tertiary'
                        onClick={this.props.reload}
                    >
                        <ReloadIcon/>
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
                            <th>
                                <FormattedMessage
                                    id='admin.cluster.status_table.schema_version'
                                    defaultMessage='DB Schema Version'
                                />
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {items}
                    </tbody>
                </table>
                {versionMismatchWarning}
            </div>
        );
    }
}

const style: Style = {
    clusterTable: {margin: 10, marginBottom: 30},
    clusterCell: {whiteSpace: 'nowrap'},
    warning: {marginBottom: 10},
};
