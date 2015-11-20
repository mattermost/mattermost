// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import TutorialIntroScreens from './tutorial/tutorial_intro_screens.jsx';
import CreatePost from './create_post.jsx';
import PostsViewContainer from './posts_view_container.jsx';
import ChannelHeader from './channel_header.jsx';
import Navbar from './navbar.jsx';
import FileUploadOverlay from './file_upload_overlay.jsx';

import PreferenceStore from '../stores/preference_store.jsx';
import UserStore from '../stores/user_store.jsx';

import Constants from '../utils/constants.jsx';
const TutorialSteps = Constants.TutorialSteps;
const Preferences = Constants.Preferences;

export default class CenterPanel extends React.Component {
    constructor(props) {
        super(props);

        this.onPreferenceChange = this.onPreferenceChange.bind(this);

        const tutorialPref = PreferenceStore.getPreference(Preferences.TUTORIAL_STEP, UserStore.getCurrentId(), {value: '999'});
        this.state = {showTutorialScreens: parseInt(tutorialPref.value, 10) === TutorialSteps.INTRO_SCREENS};
    }
    componentDidMount() {
        PreferenceStore.addChangeListener(this.onPreferenceChange);
    }
    componentWillUnmount() {
        PreferenceStore.removeChangeListener(this.onPreferenceChange);
    }
    onPreferenceChange() {
        const tutorialPref = PreferenceStore.getPreference(Preferences.TUTORIAL_STEP, UserStore.getCurrentId(), {value: '999'});
        this.setState({showTutorialScreens: parseInt(tutorialPref.value, 10) <= TutorialSteps.INTRO_SCREENS});
    }
    render() {
        let postsContainer;
        if (this.state.showTutorialScreens) {
            postsContainer = <TutorialIntroScreens />;
        } else {
            postsContainer = <PostsViewContainer />;
        }

        return (
            <div className='inner__wrap channel__wrap'>
                <div className='row header'>
                    <div id='navbar'>
                        <Navbar/>
                    </div>
                </div>
                <div className='row main'>
                    <FileUploadOverlay
                        id='file_upload_overlay'
                        overlayType='center'
                    />
                    <div
                        id='app-content'
                        className='app__content'
                    >
                        <div id='channel-header'>
                            <ChannelHeader />
                        </div>
                        {postsContainer}
                        <div
                            className='post-create__container'
                            id='post-create'
                        >
                            <CreatePost />
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

CenterPanel.defaultProps = {
};

CenterPanel.propTypes = {
};
