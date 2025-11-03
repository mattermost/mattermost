// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getPrevTrialLicense} from "mattermost-redux/actions/admin";
import {getConfig as getGeneralConfig} from "mattermost-redux/selectors/entities/general";
import {ThunkActionFunc} from "types/store";

// Attempts to get the previous trial license only if the server is Enterprise Edition, preventing unnecessary fetches.
export function tryGetPrevTrialLicense(): ThunkActionFunc<void> {
    return (dispatch, getState) => {
        const state = getState();
        const generalConfig = getGeneralConfig(state);
        const enterpriseReady = generalConfig.BuildEnterpriseReady === 'true';
        if(enterpriseReady) {
            dispatch(getPrevTrialLicense());
        }
    } 
}