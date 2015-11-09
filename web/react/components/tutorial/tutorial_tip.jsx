// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const UserStore = require('../../stores/user_store.jsx');
const PreferenceStore = require('../../stores/preference_store.jsx');
const AsyncClient = require('../../utils/async_client.jsx');

const Constants = require('../../utils/constants.jsx');
const Preferences = Constants.Preferences;

const Overlay = ReactBootstrap.Overlay;

export default class TutorialTip extends React.Component {
    constructor(props) {
        super(props);

        this.handleNext = this.handleNext.bind(this);
        this.toggle = this.toggle.bind(this);

        this.state = {currentScreen: 0, show: false};
    }
    toggle() {
        const show = !this.state.show;
        this.setState({show});

        if (!show && this.state.currentScreen >= this.props.screens.length - 1) {
            let preference = PreferenceStore.getPreference(Preferences.TUTORIAL_STEP, UserStore.getCurrentId(), {value: '0'});

            const newValue = (parseInt(preference.value, 10) + 1).toString();

            preference = PreferenceStore.setPreference(Preferences.TUTORIAL_STEP, UserStore.getCurrentId(), newValue);
            AsyncClient.savePreferences([preference]);
        }
    }
    handleNext() {
        if (this.state.currentScreen < this.props.screens.length - 1) {
            this.setState({currentScreen: this.state.currentScreen + 1});
            return;
        }

        this.toggle();
    }
    skipTutorial(e) {
        e.preventDefault();
        const preference = PreferenceStore.setPreference(Preferences.TUTORIAL_STEP, UserStore.getCurrentId(), '999');
        AsyncClient.savePreferences([preference]);
    }
    render() {
        const buttonText = this.state.currentScreen === this.props.screens.length - 1 ? 'Okay' : 'Next';

        const dots = [];
        if (this.props.screens.length > 1) {
            for (let i = 0; i < this.props.screens.length; i++) {
                if (i === this.state.currentScreen) {
                    dots.push(
                        <div
                            className='circle active'
                            key={'dotactive' + i}
                        />
                    );
                } else {
                    dots.push(
                        <div
                            className='circle'
                            key={'dotinactive' + i}
                        />
                    );
                }
            }
        }

        var tipColor = '';
        if (this.props.overlayClass === 'tip-overlay--header') {
            tipColor = 'white';
        }

        return (
            <div className={'tip-div ' + this.props.overlayClass}>
                <img
                    className='tip-button'
                    src={'/static/images/tutorialTip' + tipColor + '.gif'}
                    width='35'
                    onClick={this.toggle}
                    ref='target'
                />

                <Overlay
                    show={this.state.show}
                >
                    <div className='tip-backdrop'/>
                </Overlay>

                <Overlay
                    placement={this.props.placement}
                    show={this.state.show}
                    rootClose={true}
                    onHide={this.toggle}
                    target={() => this.refs.target}
                >
                    <div className={'tip-overlay ' + this.props.overlayClass}>
                        <div className='arrow'></div>
                        {this.props.screens[this.state.currentScreen]}
                        <div className='tutorial__circles'>{dots}</div>
                        <div className='text-right'>
                            <button
                                className='btn btn-primary'
                                onClick={this.handleNext}
                            >
                                {buttonText}
                            </button>
                            <div className='tip-opt'>
                                {'Seen this before? '}
                                <a
                                    href='#'
                                    onClick={this.skipTutorial}
                                >
                                    {'Opt out of these tips.'}
                                </a>
                            </div>
                        </div>
                    </div>
                </Overlay>
            </div>
        );
    }
}

TutorialTip.defaultProps = {
    overlayClass: ''
};

TutorialTip.propTypes = {
    screens: React.PropTypes.array.isRequired,
    placement: React.PropTypes.string.isRequired,
    overlayClass: React.PropTypes.string
};
