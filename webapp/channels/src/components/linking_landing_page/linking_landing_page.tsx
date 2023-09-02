// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {PureComponent} from 'react';
import {FormattedMessage} from 'react-intl';

import desktopImg from 'images/deep-linking/deeplinking-desktop-img.png';
import mobileImg from 'images/deep-linking/deeplinking-mobile-img.png';
import MattermostLogoSvg from 'images/logo.svg';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import CheckboxCheckedIcon from 'components/widgets/icons/checkbox_checked_icon';
import BrowserStore from 'stores/browser_store';
import {LandingPreferenceTypes} from 'utils/constants';
import * as Utils from 'utils/utils';

import * as UserAgent from 'utils/user_agent';

type Props = {
    defaultTheme: any;
    desktopAppLink?: string;
    iosAppLink?: string;
    androidAppLink?: string;
    siteUrl?: string;
    siteName?: string;
    brandImageUrl?: string;
    enableCustomBrand: boolean;
}

type State = {
    rememberChecked: boolean;
    redirectPage: boolean;
    location: string;
    nativeLocation: string;
    brandImageError: boolean;
    navigating: boolean;
}

export default class LinkingLandingPage extends PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        const location = window.location.href.replace('/landing#', '');

        this.state = {
            rememberChecked: false,
            redirectPage: false,
            location,
            nativeLocation: location.replace(/^(https|http)/, 'mattermost'),
            brandImageError: false,
            navigating: false,
        };

        if (!BrowserStore.hasSeenLandingPage()) {
            BrowserStore.setLandingPageSeen(true);
        }
    }

    componentDidMount() {
        Utils.applyTheme(this.props.defaultTheme);
        if (this.checkLandingPreferenceApp()) {
            this.openMattermostApp();
        }

        window.addEventListener('beforeunload', this.clearLandingPreferenceIfNotChecked);
    }

    componentWillUnmount() {
        window.removeEventListener('beforeunload', this.clearLandingPreferenceIfNotChecked);
    }

    clearLandingPreferenceIfNotChecked = () => {
        if (!this.state.navigating && !this.state.rememberChecked) {
            BrowserStore.clearLandingPreference(this.props.siteUrl);
        }
    };

    checkLandingPreferenceBrowser = () => {
        const landingPreference = BrowserStore.getLandingPreference(this.props.siteUrl);
        return landingPreference && landingPreference === LandingPreferenceTypes.BROWSER;
    };

    isEmbedded = () => {
        // this cookie is set by any plugin that facilitates iframe embedding (e.g. mattermost-plugin-msteams-sync).
        const cookieName = 'MMEMBED';
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.startsWith(cookieName + '=')) {
                const value = cookie.substring(cookieName.length + 1);
                return decodeURIComponent(value) === '1';
            }
        }
        return false;
    };

    checkLandingPreferenceApp = () => {
        const landingPreference = BrowserStore.getLandingPreference(this.props.siteUrl);
        return landingPreference && landingPreference === LandingPreferenceTypes.MATTERMOSTAPP;
    };

    handleChecked = () => {
        // If it was checked, and now we're unchecking it, clear the preference
        if (this.state.rememberChecked) {
            BrowserStore.clearLandingPreference(this.props.siteUrl);
        }
        this.setState({rememberChecked: !this.state.rememberChecked});
    };

    setPreference = (pref: string, clearIfNotChecked?: boolean) => {
        if (!this.state.rememberChecked) {
            if (clearIfNotChecked) {
                BrowserStore.clearLandingPreference(this.props.siteUrl);
            }
            return;
        }

        switch (pref) {
        case LandingPreferenceTypes.MATTERMOSTAPP:
            BrowserStore.setLandingPreferenceToMattermostApp(this.props.siteUrl);
            break;
        case LandingPreferenceTypes.BROWSER:
            BrowserStore.setLandingPreferenceToBrowser(this.props.siteUrl);
            break;
        default:
            break;
        }
    };

    openMattermostApp = () => {
        this.setPreference(LandingPreferenceTypes.MATTERMOSTAPP);
        this.setState({redirectPage: true});
        window.location.href = this.state.nativeLocation;
    };

    openInBrowser = () => {
        this.setPreference(LandingPreferenceTypes.BROWSER);
        window.location.href = this.state.location;
    };

    renderSystemDialogMessage = () => {
        const isMobile = UserAgent.isMobile();

        if (isMobile) {
            return (
                <FormattedMessage
                    id='get_app.systemDialogMessageMobile'
                    defaultMessage='View in App'
                />
            );
        }

        return (
            <FormattedMessage
                id='get_app.systemDialogMessage'
                defaultMessage='View in Desktop App'
            />
        );
    };

    renderGoNativeAppMessage = () => {
        return (
            <a
                href={UserAgent.isMobile() ? '#' : this.state.nativeLocation}
                onMouseDown={() => {
                    this.setPreference(LandingPreferenceTypes.MATTERMOSTAPP, true);
                }}
                onClick={() => {
                    this.setPreference(LandingPreferenceTypes.MATTERMOSTAPP, true);
                    this.setState({redirectPage: true, navigating: true});
                    if (UserAgent.isMobile()) {
                        if (UserAgent.isAndroidWeb()) {
                            const timeout = setTimeout(() => {
                                window.location.replace(this.getDownloadLink()!);
                            }, 2000);
                            window.addEventListener('blur', () => {
                                clearTimeout(timeout);
                            });
                        }
                        window.location.replace(this.state.nativeLocation);
                    }
                }}
                className='btn btn-primary btn-lg get-app__download'
            >
                {this.renderSystemDialogMessage()}
            </a>
        );
    };

    getDownloadLink = () => {
        if (UserAgent.isIosWeb()) {
            return this.props.iosAppLink;
        } else if (UserAgent.isAndroidWeb()) {
            return this.props.androidAppLink;
        }

        return this.props.desktopAppLink;
    };

    handleBrandImageError = () => {
        this.setState({brandImageError: true});
    };

    renderCheckboxIcon = () => {
        if (this.state.rememberChecked) {
            return (
                <CheckboxCheckedIcon/>
            );
        }

        return null;
    };

    renderGraphic = () => {
        const isMobile = UserAgent.isMobile();

        if (isMobile) {
            return (
                <img src={mobileImg}/>
            );
        }

        return (
            <img src={desktopImg}/>
        );
    };

    renderDownloadLinkText = () => {
        const isMobile = UserAgent.isMobile();

        if (isMobile) {
            return (
                <FormattedMessage
                    id='get_app.dontHaveTheMobileApp'
                    defaultMessage={'Don\'t have the Mobile App?'}
                />
            );
        }

        return (
            <FormattedMessage
                id='get_app.dontHaveTheDesktopApp'
                defaultMessage={'Don\'t have the Desktop App?'}
            />
        );
    };

    renderDownloadLinkSection = () => {
        const downloadLink = this.getDownloadLink();

        if (this.state.redirectPage) {
            return (
                <div className='get-app__download-link'>
                    <FormattedMarkdownMessage
                        id='get_app.openLinkInBrowser'
                        defaultMessage='Or, [open this link in your browser.](!{link})'
                        values={{
                            link: this.state.location,
                        }}
                    />
                </div>
            );
        } else if (downloadLink) {
            return (
                <div className='get-app__download-link'>
                    {this.renderDownloadLinkText()}
                    {'\u00A0'}
                    <br/>
                    <a href={downloadLink}>
                        <FormattedMessage
                            id='get_app.downloadTheAppNow'
                            defaultMessage='Download the app now.'
                        />
                    </a>
                </div>
            );
        }

        return null;
    };

    renderDialogHeader = () => {
        const downloadLink = this.getDownloadLink();
        const isMobile = UserAgent.isMobile();

        let openingLink = (
            <FormattedMessage
                id='get_app.openingLink'
                defaultMessage='Opening link in Mattermost...'
            />
        );
        if (this.props.enableCustomBrand) {
            openingLink = (
                <FormattedMessage
                    id='get_app.openingLinkWhiteLabel'
                    defaultMessage='Opening link in {appName}...'
                    values={{
                        appName: this.props.siteName || 'Mattermost',
                    }}
                />
            );
        }

        if (this.state.redirectPage) {
            return (
                <h1 className='get-app__launching'>
                    {openingLink}
                    <div className={`get-app__alternative${this.state.redirectPage ? ' redirect-page' : ''}`}>
                        <FormattedMessage
                            id='get_app.redirectedInMoments'
                            defaultMessage='You will be redirected in a few moments.'
                        />
                        <br/>
                        {this.renderDownloadLinkText()}
                        {'\u00A0'}
                        <br className='mobile-only'/>
                        <a href={downloadLink}>
                            <FormattedMessage
                                id='get_app.downloadTheAppNow'
                                defaultMessage='Download the app now.'
                            />
                        </a>
                    </div>
                </h1>
            );
        }

        let viewApp = (
            <FormattedMessage
                id='get_app.ifNothingPrompts'
                defaultMessage='You can view {siteName} in the desktop app or continue in your web browser.'
                values={{
                    siteName: this.props.enableCustomBrand ? '' : ' Mattermost',
                }}
            />
        );
        if (isMobile) {
            viewApp = (
                <FormattedMessage
                    id='get_app.ifNothingPromptsMobile'
                    defaultMessage='You can view {siteName} in the mobile app or continue in your web browser.'
                    values={{
                        siteName: this.props.enableCustomBrand ? '' : ' Mattermost',
                    }}
                />
            );
        }

        return (
            <div className='get-app__launching'>
                <FormattedMessage
                    id='get_app.launching'
                    tagName='h1'
                    defaultMessage='Where would you like to view this?'
                />
                <div className='get-app__alternative'>
                    {viewApp}
                </div>
            </div>
        );
    };

    renderDialogBody = () => {
        if (this.state.redirectPage) {
            return (
                <div className='get-app__dialog-body'>
                    {this.renderDialogHeader()}
                    {this.renderDownloadLinkSection()}
                </div>
            );
        }

        return (
            <div className='get-app__dialog-body'>
                {this.renderDialogHeader()}
                <div className='get-app__buttons'>
                    <div className='get-app__status'>
                        {this.renderGoNativeAppMessage()}
                    </div>
                    <div className='get-app__status'>
                        <a
                            href={this.state.location}
                            onMouseDown={() => {
                                this.setPreference(LandingPreferenceTypes.BROWSER, true);
                            }}
                            onClick={() => {
                                this.setPreference(LandingPreferenceTypes.BROWSER, true);
                                this.setState({navigating: true});
                            }}
                            className='btn btn-default btn-lg get-app__continue'
                        >
                            <FormattedMessage
                                id='get_app.continueToBrowser'
                                defaultMessage='View in Browser'
                            />
                        </a>
                    </div>
                </div>
                <div className='get-app__preference'>
                    <button
                        className={`get-app__checkbox ${this.state.rememberChecked ? 'checked' : ''}`}
                        onClick={this.handleChecked}
                    >
                        {this.renderCheckboxIcon()}
                    </button>
                    <FormattedMessage
                        id='get_app.rememberMyPreference'
                        defaultMessage='Remember my preference'
                    />
                </div>
                {this.renderDownloadLinkSection()}
            </div>
        );
    };

    renderHeader = () => {
        let header = (
            <div className='get-app__header'>
                <img
                    src={MattermostLogoSvg}
                    className='get-app__logo'
                />
            </div>
        );
        if (this.props.enableCustomBrand && this.props.brandImageUrl) {
            let customLogo;
            if (this.props.brandImageUrl && !this.state.brandImageError) {
                customLogo = (
                    <img
                        src={this.props.brandImageUrl}
                        onError={this.handleBrandImageError}
                        className='get-app__custom-logo'
                    />
                );
            }

            header = (
                <div className='get-app__header'>
                    {customLogo}
                    <div className='get-app__custom-site-name'>
                        <span>{this.props.siteName}</span>
                    </div>
                </div>
            );
        }

        return header;
    };

    render() {
        const isMobile = UserAgent.isMobile();

        if (this.checkLandingPreferenceBrowser() || this.isEmbedded()) {
            this.openInBrowser();
            return null;
        }

        return (
            <div className='get-app'>
                {this.renderHeader()}
                <div className='get-app__dialog'>
                    <div
                        className={`get-app__graphic ${isMobile ? 'mobile' : ''}`}
                    >
                        {this.renderGraphic()}
                    </div>
                    {this.renderDialogBody()}
                </div>
            </div>
        );
    }
}
