// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import TutorialIntroScreens from './tutorial_intro_screens.jsx';

export default class TutorialView extends React.Component {
    render() {
        return (
            <div
                id='app-content'
                className='app__content'
            >
                <TutorialIntroScreens/>
            </div>
        );
    }
}
