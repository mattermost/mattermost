// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import ClusterTable from './cluster_table.jsx';
import LoadingScreen from '../loading_screen.jsx';
import Client from 'client/web_client.jsx';
import * as AsyncClient from 'utils/async_client.jsx';

export default class ClusterTableContainer extends React.Component {
    constructor(props) {
        super(props);

        this.interval = null;

        this.state = {
            clusterInfos: null
        };
    }

    load = () => {
        Client.getClusterStatus(
            (data) => {
                this.setState({
                    clusterInfos: data
                });
            },
            (err) => {
                AsyncClient.dispatchError(err, 'getClusterStatus');
            }
        );
    }

    componentWillMount() {
        this.load();

        // reload the cluster status every 15 seconds
        this.interval = setInterval(this.load, 15000);
    }

    componentWillUnmount() {
        if (this.interval) {
            clearInterval(this.interval);
        }
    }

    reload = (e) => {
        if (e) {
            e.preventDefault();
        }

        this.setState({
            clusterInfos: null
        });

        this.load();
    }

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