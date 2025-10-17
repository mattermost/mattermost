// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import './auto_translation_info.scss';

import SectionNotice from 'components/section_notice';

const AutoTranslationInfo = () => {
    const intl = useIntl();
    return (
        <div className='autoTranslationInfo'>
            <SectionNotice
                title={
                    <FormattedMessage
                        id='admin.site.localization.autoTranslationInfo'
                        defaultMessage="Auto-translation must also be enabled in each channel where it's needed."
                    />
                }
                text={intl.formatMessage({
                    id: 'admin.site.localization.autoTranslationInfoSecondary',
                    defaultMessage: 'When multiple languages are detected, users will be prompted to enable auto-translation. [Learn more](https://docs.mattermost.com/).',
                })}
                type='info'
            />
        </div>
    );
};

export default React.memo(AutoTranslationInfo);
