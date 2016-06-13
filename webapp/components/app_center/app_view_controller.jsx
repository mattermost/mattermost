// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import LoadingScreen from '../loading_screen.jsx';

export default class AppView extends React.Component {
    constructor(props) {
        super(props);

        const config = global.window.mm_config;

        this.state = {
            name: config.SampleAppAppName,
            url: config.SampleAppAppUrl
        };
    }
    componentDidMount() {
        const iframe = this.refs.appframe;
        iframe.onload = () => {
            iframe.contentWindow.postMessage({type: 'origin'}, '*');
        };
    }
    render() {
        if (!this.state.url || !this.state.name) {
            return <LoadingScreen/>;
        }

        const name = this.state.name;
        const url = this.state.url;

        return (
            <div className='appcenter-content'>
                <iframe
                    ref='appframe'
                    id={name}
                    name={name}
                    allowFullscreen={true}
                    seamless={true}
                    src={url}
                    sandbox='allow-forms allow-popups allow-scripts allow-popups-to-escape-sandbox allow-same-origin'
                />
            </div>
        );
    }
}

AppView.propTypes = {
    params: React.PropTypes.object
};