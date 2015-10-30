// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const UserStore = require('../../stores/user_store.jsx');
const ChannelStore = require('../../stores/channel_store.jsx');
const TeamStore = require('../../stores/team_store.jsx');
const PreferenceStore = require('../../stores/preference_store.jsx');
const Utils = require('../../utils/utils.jsx');
const AsyncClient = require('../../utils/async_client.jsx');

const Constants = require('../../utils/constants.jsx');
const Preferences = Constants.Preferences;

export default class TutorialIntroScreens extends React.Component {
    constructor(props) {
        super(props);

        this.handleNext = this.handleNext.bind(this);
        this.createScreen = this.createScreen.bind(this);

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
        return (
            <div>
                <h4><strong>{'Welcome to:'}</strong></h4>
                <h2><strong>{'Mattermost'}</strong></h2>
                <br/>
                {'Your team communications all in one place,'}
                <br/>
                {'instantly searchable and available anywhere.'}
                <br/><br/>
                {'Keep your team connected to help them'}
                <br/>
                {'achieve what matters most.'}
                <br/><br/>
                <span>{'[ x ][ ][ ]'}</span>
            </div>
        );
    }
    createScreenTwo() {
        return (
            <div>
                <h4><strong>{'How Mattermost works:'}</strong></h4>
                <br/>
                {'Communication happens in public discussion channels,'}
                <br/>
                {'private groups and direct messages.'}
                <br/><br/>
                {'Everything is archived and searchable from'}
                <br/>
                {'any web-enabled laptop, tablet or phone.'}
                <br/><br/>
                <span>{'[ ][ x ][ ]'}</span>
            </div>
        );
    }
    createScreenThree() {
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

        return (
            <div>
                <h4><strong>{'You’re all set'}</strong></h4>
                <br/>
                {inviteModalLink}
                {' when you’re ready.'}
                <br/><br/>
                {'Need anything, just email us at '}
                <a
                    href='mailto:feedback@mattermost.com'
                    target='_blank'
                >
                    {'feedback@mattermost.com.'}
                </a>
                <br/><br/>
                {'Click “Next” to enter Town Square. This is the first channel'}
                <br/>
                {'teammates see when they sign up - use it for posting updates'}
                <br/>
                {'everyone needs to know.'}
                <br/><br/>
                <span>{'[ ][ ][ x ]'}</span>
            </div>
        );
    }
    render() {
        const screen = this.createScreen();

        return (
            <div>
                {screen}
                <br/><br/>
                <button
                    className='btn btn-primary'
                    tabIndex='1'
                    onClick={this.handleNext}
                >
                    {'Next'}
                </button>
            </div>
        );
    }
}
