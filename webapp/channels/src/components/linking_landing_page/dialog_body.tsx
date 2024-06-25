// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import BrowserStore from 'stores/browser_store';

import {LandingPreferenceTypes} from 'utils/constants';
import * as UserAgent from 'utils/user_agent';

import DialogHeader from './dialog_header';
import DownloadLink from './download_link';
import GoNativeAppMessage from './go_native_app_message';

type Props = {
    siteUrl?: string;
    downloadLink: string;
    isMobile: boolean;
    nativeLocation: string;
    setPreference: (preference: string, value?: boolean) => void;
    location: string;
    onChecked: (value: boolean) => void;
    rememberChecked: boolean;
}
const DialogBody = ({siteUrl, rememberChecked, onChecked, location, downloadLink, isMobile, nativeLocation, setPreference}: Props) => {
    const [redirectPage, setRedirectPage] = useState(false);
    const [navigating, setNavigating] = useState(false);

    const checkLandingPreferenceApp = () => {
        const landingPreference = BrowserStore.getLandingPreference(siteUrl);
        return landingPreference && landingPreference === LandingPreferenceTypes.MATTERMOSTAPP;
    };

    const clearLandingPreferenceIfNotChecked = () => {
        if (!navigating && !rememberChecked) {
            BrowserStore.clearLandingPreference(siteUrl);
        }
    };

    const handleChecked = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onChecked(e.target.checked);

        // If it was checked, and now we're unchecking it, clear the preference
        if (!e.target.checked) {
            BrowserStore.clearLandingPreference(siteUrl);
        }
    }, [siteUrl]);

    const openMattermostApp = () => {
        setPreference(LandingPreferenceTypes.MATTERMOSTAPP);
        setRedirectPage(true);
        window.location.href = nativeLocation;
    };

    useEffect(() => {
        window.addEventListener('beforeunload', clearLandingPreferenceIfNotChecked);
        if (checkLandingPreferenceApp()) {
            openMattermostApp();
        }
        return () => {
            window.removeEventListener('beforeunload', clearLandingPreferenceIfNotChecked);
        };
    }, []);

    if (redirectPage) {
        return (
            <div className='get-app__dialog-body'>
                <DialogHeader
                    downloadLink={downloadLink || ''}
                    redirectPage={redirectPage}
                    isMobile={isMobile}
                />
                <DownloadLink
                    downloadLink={downloadLink || ''}
                    redirectPage={redirectPage}
                    location={location}
                    isMobile={isMobile}
                />
            </div>
        );
    }

    return (
        <div className='get-app__dialog-body'>
            <DialogHeader
                downloadLink={downloadLink || ''}
                redirectPage={redirectPage}
                isMobile={isMobile}
            />
            <div className='get-app__buttons'>
                <GoNativeAppMessage
                    isMobile={isMobile}
                    nativeLocation={nativeLocation}
                    setPreference={setPreference}
                    onClick={() => {
                        setPreference(LandingPreferenceTypes.MATTERMOSTAPP, true);
                        setRedirectPage(true);
                        setNavigating(true);
                        if (isMobile) {
                            if (UserAgent.isAndroidWeb()) {
                                const timeout = setTimeout(() => {
                                    window.location.replace(downloadLink!);
                                }, 2000);
                                window.addEventListener('blur', () => {
                                    clearTimeout(timeout);
                                });
                            }
                            window.location.replace(nativeLocation);
                        }
                    }}
                />
                <a
                    href={location}
                    onMouseDown={() => {
                        setPreference(LandingPreferenceTypes.BROWSER, true);
                    }}
                    onClick={() => {
                        setPreference(LandingPreferenceTypes.BROWSER, true);
                        setNavigating(true);
                    }}
                    className='btn btn-tertiary btn-lg'
                >
                    <FormattedMessage
                        id='get_app.continueToBrowser'
                        defaultMessage='View in Browser'
                    />
                </a>
            </div>
            <label className='get-app__preference'>
                <input
                    type='checkbox'
                    checked={rememberChecked}
                    className='get-app__checkbox'
                    onChange={handleChecked}
                />
                <FormattedMessage
                    id='get_app.rememberMyPreference'
                    defaultMessage='Remember my preference'
                />
            </label>
            <DownloadLink
                downloadLink={downloadLink || ''}
                redirectPage={redirectPage}
                location={location}
                isMobile={isMobile}
            />
        </div>
    );
};

export default DialogBody;
