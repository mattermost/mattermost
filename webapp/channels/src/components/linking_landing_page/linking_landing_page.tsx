// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useMemo, useEffect, useCallback} from 'react';
import {useSelector} from 'react-redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import BrowserStore from 'stores/browser_store';

import GetAppDesktopSvg from 'components/common/svg_images_components/get-app-desktop_svg';
import GetAppMobileSvg from 'components/common/svg_images_components/get-app-mobile_svg';
import BrandedLanding from 'components/custom_branding/branded_landing';

import {LandingPreferenceTypes} from 'utils/constants';
import * as UserAgent from 'utils/user_agent';
import * as Utils from 'utils/utils';

import DialogBody from './dialog_body';
import Header from './header';

const LinkingLandingPage = () => {
    const [location, setLocation] = useState('');
    const [rememberChecked, setRememberChecked] = useState(false);

    const {
        AppDownloadLink,
        IosAppDownloadLink,
        AndroidAppDownloadLink,
        SiteURL,
    } = useSelector(getConfig);

    const theme = useSelector(getTheme);

    const nativeLocation = useMemo(() => location.replace(/^(https|http)/, 'mattermost'), [location]);

    const isMobile = useMemo(() => UserAgent.isMobile(), []);

    useEffect(() => {
        setLocation(window.location.href.replace('/landing#', ''));
        if (!BrowserStore.hasSeenLandingPage()) {
            BrowserStore.setLandingPageSeen(true);
        }
        Utils.applyTheme(theme);
    }, []);

    const handleChecked = useCallback((value: boolean) => {
        setRememberChecked(value);

        // If it was checked, and now we're unchecking it, clear the preference
        if (!value) {
            BrowserStore.clearLandingPreference(SiteURL);
        }
    }, []);

    const checkLandingPreferenceBrowser = () => {
        const landingPreference = BrowserStore.getLandingPreference(SiteURL);
        return landingPreference && landingPreference === LandingPreferenceTypes.BROWSER;
    };

    const setPreference = (pref: string, clearIfNotChecked?: boolean) => {
        if (!rememberChecked) {
            if (clearIfNotChecked) {
                BrowserStore.clearLandingPreference(SiteURL);
            }
            return;
        }

        switch (pref) {
        case LandingPreferenceTypes.MATTERMOSTAPP:
            BrowserStore.setLandingPreferenceToMattermostApp(SiteURL);
            break;
        case LandingPreferenceTypes.BROWSER:
            BrowserStore.setLandingPreferenceToBrowser(SiteURL);
            break;
        default:
            break;
        }
    };

    const isEmbedded = () => {
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

    const openInBrowser = () => {
        setPreference(LandingPreferenceTypes.BROWSER);
        window.location.href = location;
    };

    const getDownloadLink = () => {
        if (UserAgent.isIosWeb()) {
            return IosAppDownloadLink;
        } else if (UserAgent.isAndroidWeb()) {
            return AndroidAppDownloadLink;
        }

        return AppDownloadLink;
    };

    if (checkLandingPreferenceBrowser() || isEmbedded()) {
        openInBrowser();
        return null;
    }

    return (
        <BrandedLanding className='get-app'>
            <Header/>
            <div className='get-app__dialog'>
                <div
                    className={`get-app__graphic ${isMobile ? 'mobile' : ''}`}
                >
                    {isMobile ? (
                        <GetAppMobileSvg
                            width={362}
                            height={600}
                        />
                    ) : <GetAppDesktopSvg/> }
                </div>
                <DialogBody
                    siteUrl={SiteURL}
                    downloadLink={getDownloadLink() || ''}
                    isMobile={isMobile}
                    nativeLocation={nativeLocation}
                    setPreference={setPreference}
                    location={location}
                    onChecked={handleChecked}
                    rememberChecked={rememberChecked}
                />
            </div>
        </BrandedLanding>
    );
};

export default LinkingLandingPage;
