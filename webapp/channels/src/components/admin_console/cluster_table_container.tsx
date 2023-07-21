// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ClusterInfo} from '@mattermost/types/admin';
import React, {MouseEvent, PureComponent} from 'react';

import {getClusterStatus} from 'actions/admin_actions.jsx';

import LoadingScreen from '../loading_screen';

import ClusterTable from './cluster_table';

interface State {
    clusterInfos: ClusterInfo[] | null;
}

export default class ClusterTableContainer extends PureComponent<null, State> {
    interval: NodeJS.Timeout | null;

    constructor(props: null) {
        super(props);

        this.interval = null;

        this.state = {
            clusterInfos: null,
        };
    }

    load = () => {
        getClusterStatus(
            (data: ClusterInfo[]) => {
                this.setState({
                    clusterInfos: data,
                });
            },
            null,
        );
    };

    componentDidMount() {
        this.load();

        // reload the cluster status every 15 seconds
        this.interval = setInterval(this.load, 15000);
    }

    componentWillUnmount() {
        if (this.interval) {
            clearInterval(this.interval);
        }
    }

    reload = (e: MouseEvent<HTMLButtonElement>) => {
        if (e) {
            e.preventDefault();
        }

        this.setState({
            clusterInfos: null,
        });

        this.load();
    };

    render() {
        if (this.state.clusterInfos == null) {
            return (<LoadingScreen/>);
        }

        return (
            <ClusterTable
                clusterInfos={this.state.clusterInfos}
                reload={this.reload}
            />
        );
    }
}
