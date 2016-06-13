// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserStore from 'stores/user_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';
import * as AsyncClient from 'utils/async_client.jsx';

import Constants from 'utils/constants.jsx';

import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';

const Preferences = Constants.Preferences;
import * as Utils from 'utils/utils.jsx';

import {Overlay} from 'react-bootstrap';

import React from 'react';

import tutorialGif from 'images/tutorialTip.gif';
import tutorialGifWhite from 'images/tutorialTipWhite.gif';

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
            const step = PreferenceStore.getInt(Preferences.TUTORIAL_STEP, UserStore.getCurrentId(), 0);

            AsyncClient.savePreference(
                Preferences.TUTORIAL_STEP,
                UserStore.getCurrentId(),
                (step + 1).toString()
            );
        }
    }
    handleNext() {
        if (this.state.currentScreen < this.props.screens.length - 1) {
            this.setState({currentScreen: this.state.currentScreen + 1});
            return;
        }

        this.closeRightSidebar();
        this.toggle();
    }
    closeRightSidebar() {
        if (Utils.isMobile()) {
            setTimeout(() => {
                document.querySelector('.app__body .inner-wrap').classList.remove('move--left-small');
                document.querySelector('.app__body .sidebar--menu').classList.remove('move--left');
            });
        }
    }
    skipTutorial(e) {
        e.preventDefault();

        AsyncClient.savePreference(
            Preferences.TUTORIAL_STEP,
            UserStore.getCurrentId(),
            '999'
        );
    }
    render() {
        const buttonText = this.state.currentScreen === this.props.screens.length - 1 ? (
            <FormattedMessage
                id='tutorial_tip.ok'
                defaultMessage='Okay'
            />
        ) : (
            <FormattedMessage
                id='tutorial_tip.next'
                defaultMessage='Next'
            />
        );

        const dots = [];
        if (this.props.screens.length > 1) {
            for (let i = 0; i < this.props.screens.length; i++) {
                let className = 'circle';
                if (i === this.state.currentScreen) {
                    className += ' active';
                }

                dots.push(
                    <a
                        href='#'
                        key={'dotactive' + i}
                        className={className}
                        onClick={(e) => { //eslint-disable-line no-loop-func
                            e.preventDefault();
                            this.setState({currentScreen: i});
                        }}
                    />
                );
            }
        }

        var tutorialGifImage = tutorialGif;
        if (this.props.overlayClass === 'tip-overlay--header' || this.props.overlayClass === 'tip-overlay--sidebar' || this.props.overlayClass === 'tip-overlay--header--up') {
            tutorialGifImage = tutorialGifWhite;
        }

        return (
            <div className={'tip-div ' + this.props.overlayClass}>
                <img
                    className='tip-button'
                    src={tutorialGifImage}
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
                        <div className='tutorial__footer'>
                            <div className='tutorial__circles'>{dots}</div>
                            <div className='text-right'>
                                <button
                                    className='btn btn-primary'
                                    onClick={this.handleNext}
                                >
                                    {buttonText}
                                </button>
                                <div className='tip-opt'>
                                    <FormattedMessage
                                        id='tutorial_tip.seen'
                                        defaultMessage='Seen this before? '
                                    />
                                    <a
                                        href='#'
                                        onClick={this.skipTutorial}
                                    >
                                        <FormattedMessage
                                            id='tutorial_tip.out'
                                            defaultMessage='Opt out of these tips.'
                                        />
                                    </a>
                                </div>
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

export function createMenuTip(toggleFunc, onBottom) {
    const screens = [];

    screens.push(
        <div>
            <FormattedHTMLMessage
                id='sidebar_header.tutorial'
                defaultMessage='<h4>Main Menu</h4>
                <p>The <strong>Main Menu</strong> is where you can <strong>Invite New Members</strong>, access your <strong>Account Settings</strong> and set your <strong>Theme Color</strong>.</p>
                <p>Team administrators can also access their <strong>Team Settings</strong> from this menu.</p><p>System administrators will find a <strong>System Console</strong> option to administrate the entire system.</p>'
            />
        </div>
    );

    let placement = 'right';
    let arrow = 'left';
    if (onBottom) {
        placement = 'bottom';
        arrow = 'up';
    }

    return (
        <div
            onClick={toggleFunc}
        >
            <TutorialTip
                ref='tip'
                placement={placement}
                screens={screens}
                overlayClass={'tip-overlay--header--' + arrow}
            />
        </div>
    );
}
