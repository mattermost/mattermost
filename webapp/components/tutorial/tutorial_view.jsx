// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import TutorialIntroScreens from './tutorial_intro_screens.jsx';

import ChannelStore from 'stores/channel_store.jsx';
import Constants from 'utils/constants.jsx';

import $ from 'jquery';
import React from 'react';

export default class TutorialView extends React.Component {
    constructor(props) {
        super(props);

        this.handleChannelChange = this.handleChannelChange.bind(this);

        this.state = {
            townSquare: ChannelStore.getByName(Constants.DEFAULT_CHANNEL)
        };
    }
    componentDidMount() {
        ChannelStore.addChangeListener(this.handleChannelChange);

        $('body').addClass('app__body');
    }
    componentWillUnmount() {
        ChannelStore.removeChangeListener(this.handleChannelChange);

        $('body').removeClass('app__body');
    }
    handleChannelChange() {
        this.setState({
            townSquare: ChannelStore.getByName(Constants.DEFAULT_CHANNEL)
        });
    }
    render() {
        return (
            <div
                id='app-content'
                className='app__content'
            >
                <TutorialIntroScreens
                    townSquare={this.state.townSquare}
                />
            </div>
        );
    }
}
