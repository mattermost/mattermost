// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages} from 'react-intl';

export const messages = defineMessages({
    termsOfServiceTitle: {id: 'admin.support.termsOfServiceTitle', defaultMessage: 'Custom Terms of Service'},
    enableTermsOfServiceTitle: {id: 'admin.support.enableTermsOfServiceTitle', defaultMessage: 'Enable Custom Terms of Service'},
    termsOfServiceTextTitle: {id: 'admin.support.termsOfServiceTextTitle', defaultMessage: 'Custom Terms of Service Text'},
    termsOfServiceTextHelp: {id: 'admin.support.termsOfServiceTextHelp', defaultMessage: 'Text that will appear in your custom Terms of Service. Supports Markdown-formatted text.'},
    termsOfServiceReAcceptanceTitle: {id: 'admin.support.termsOfServiceReAcceptanceTitle', defaultMessage: 'Re-Acceptance Period:'},
    termsOfServiceReAcceptanceHelp: {id: 'admin.support.termsOfServiceReAcceptanceHelp', defaultMessage: 'The number of days before Terms of Service acceptance expires, and the terms must be re-accepted.'},
    enableTermsOfServiceHelp: {id: 'admin.support.enableTermsOfServiceHelp', defaultMessage: 'When true, new users must accept the terms of service before accessing any Mattermost teams on desktop, web or mobile. Existing users must accept them after login or a page refresh. To update terms of service link displayed in account creation and login pages, go to <a>Site Configuration > Customization</a>'},
});

export const searchableStrings = [
    messages.termsOfServiceTitle,
    messages.enableTermsOfServiceTitle,
    messages.enableTermsOfServiceHelp,
    messages.termsOfServiceTextTitle,
    messages.termsOfServiceTextHelp,
    messages.termsOfServiceReAcceptanceTitle,
    messages.termsOfServiceReAcceptanceHelp,
];
