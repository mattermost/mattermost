// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as UserAgent from 'utils/user_agent';

export function canUploadFiles() {
    if (window.mm_config.EnableFileAttachments === 'false') {
        return false;
    }

    if (UserAgent.isMobileApp() && window.mm_license.IsLicensed === 'true' && window.mm_license.Compliance === 'true') {
        return window.mm_config.EnableMobileFileUpload !== 'false';
    }

    return true;
}

export function canDownloadFiles() {
    if (UserAgent.isMobileApp() && window.mm_license.IsLicensed === 'true' && window.mm_license.Compliance === 'true') {
        return window.mm_config.EnableMobileFileDownload !== 'false';
    }

    return true;
}
