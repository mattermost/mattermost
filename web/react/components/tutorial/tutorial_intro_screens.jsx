// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, FormattedHTMLMessage, defineMessages} from 'react-intl';
import UserStore from '../../stores/user_store.jsx';
import ChannelStore from '../../stores/channel_store.jsx';
import TeamStore from '../../stores/team_store.jsx';
import PreferenceStore from '../../stores/preference_store.jsx';
import * as Utils from '../../utils/utils.jsx';
import * as AsyncClient from '../../utils/async_client.jsx';

import Constants from '../../utils/constants.jsx';
const Preferences = Constants.Preferences;

const NUM_SCREENS = 3;

const messages = defineMessages({
    next: {
        id: 'tutoria_intro.next',
        defaultMessage: 'Next'
    },
    skip: {
        id: 'tutorial_intro.skip',
        defaultMessage: 'Skip tutorial'
    },
    screenOne: {
        id: 'tutorial_intro.screenOne',
        defaultMessage: '<h3>Welcome to:</h3> <h1>ZBox Chat</h1> <p>Your team communication all in one place, instantly searchable and available anywhere.</p> <p>Keep your team connected to help them achieve what matters most.</p>'
    },
    screenTwo: {
        id: 'tutorial_intro.screenTwo',
        defaultMessage: '<h3>How ZBox Chat works:</h3> <p>Communication happens in public discussion channels, private groups and direct messages.</p> <p>Everything is archived and searchable from any web-enabled desktop, laptop or phone.</p>'
    },
    invite: {
        id: 'tutorial_intro.invite',
        defaultMessage: 'Invite teammates'
    },
    teamInvite: {
        id: 'tutorial_intro.teamInvite',
        defaultMessage: 'Team Invite'
    },
    allSet: {
        id: 'tutorial_intro.allSet',
        defaultMessage: 'You’re all set'
    },
    end: {
        id: 'tutorial_intro.end',
        defaultMessage: 'Click “Next” to enter to General Channel. This is the first channel teammates see when they sign up. Use it for posting updates everyone needs to know.'
    }
});

class TutorialIntroScreens extends React.Component {
    constructor(props) {
        super(props);

        this.handleNext = this.handleNext.bind(this);
        this.createScreen = this.createScreen.bind(this);
        this.createCircles = this.createCircles.bind(this);

        this.state = {currentScreen: 0};
    }
    handleNext() {
        if (this.state.currentScreen < 2) {
            this.setState({currentScreen: this.state.currentScreen + 1});
            return;
        }

        Utils.switchChannel(ChannelStore.getByName(Constants.DEFAULT_CHANNEL));

        let preference = PreferenceStore.getPreference(Preferences.TUTORIAL_STEP, UserStore.getCurrentId(), {value: '0'});

        const newValue = (parseInt(preference.value, 10) + 1).toString();

        preference = PreferenceStore.setPreference(Preferences.TUTORIAL_STEP, UserStore.getCurrentId(), newValue);
        AsyncClient.savePreferences([preference]);
    }
    componentDidMount() {
        $('.tutorials__scroll').perfectScrollbar();
    }
    skipTutorial(e) {
        e.preventDefault();
        const preference = PreferenceStore.setPreference(Preferences.TUTORIAL_STEP, UserStore.getCurrentId(), '999');
        AsyncClient.savePreferences([preference]);
    }
    createScreen() {
        switch (this.state.currentScreen) {
        case 0:
            return this.createScreenOne();
        case 1:
            return this.createScreenTwo();
        case 2:
            return this.createScreenThree();
        }
    }
    createScreenOne() {
        const circles = this.createCircles();

        return (
            <div>
                <FormattedHTMLMessage id='tutorial_intro.screenOne' />
                {circles}
            </div>
        );
    }
    createScreenTwo() {
        const circles = this.createCircles();

        return (
            <div>
                <FormattedHTMLMessage id='tutorial_intro.screenTwo' />
                {circles}
            </div>
        );
    }
    createScreenThree() {
        const {formatMessage} = this.props.intl;
        const team = TeamStore.getCurrent();
        let inviteModalLink;
        if (team.type === Constants.INVITE_TEAM) {
            inviteModalLink = (
                <a
                    className='intro-links'
                    href='#'
                    data-toggle='modal'
                    data-target='#invite_member'
                >
                    {'Invite teammates'}
                </a>
            );
        } else {
            inviteModalLink = (
                <a
                    className='intro-links'
                    href='#'
                    data-toggle='modal'
                    data-target='#get_link'
                    data-title='Team Invite'
                    data-value={Utils.getWindowLocationOrigin() + '/signup_user_complete/?id=' + team.id}
                >
                    {'Invite teammates'}
                </a>
            );
        }

        const circles = this.createCircles();

        return (
            <div>
                <h3>{formatMessage(messages.allSet)}</h3>
                <p>
                    {inviteModalLink}
                    {' when you’re ready.'}
                </p>
                <p>
                    {'Need anything, just email us at '}
                    <a
                        href='mailto:feedback@mattermost.com'
                        target='_blank'
                    >
                        {'feedback@mattermost.com'}
                    </a>
                    {'.'}
                </p>
                {formatMessage(messages.end)}
                {circles}
            </div>
        );
    }
    createCircles() {
        const circles = [];
        for (let i = 0; i < NUM_SCREENS; i++) {
            let className = 'circle';
            if (i === this.state.currentScreen) {
                className += ' active';
            }

            circles.push(
                <a
                    href='#'
                    key={'circle' + i}
                    className={className}
                    onClick={(e) => { //eslint-disable-line no-loop-func
                        e.preventDefault();
                        this.setState({currentScreen: i});
                    }}
                />
            );
        }

        return (
            <div className='tutorial__circles'>
                {circles}
            </div>
        );
    }
    render() {
        const {formatMessage} = this.props.intl;
        const height = Utils.windowHeight() - 100;
        const screen = this.createScreen();

        return (
            <div
                className='tutorials__scroll'
                style={{height}}
            >
                <div className='tutorial-steps__container'>
                    <div className='tutorial__content'>
                        <div className='tutorial__steps'>
                            {screen}
                            <button
                                className='btn btn-primary'
                                tabIndex='1'
                                onClick={this.handleNext}
                            >
                                {formatMessage(messages.next)}
                            </button>
                            <a
                                className='tutorial-skip'
                                href='#'
                                onClick={this.skipTutorial}
                            >
                                {formatMessage(messages.skip)}
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

TutorialIntroScreens.propTypes = {
    intl: intlShape.isRequired
};

export default injectIntl(TutorialIntroScreens);