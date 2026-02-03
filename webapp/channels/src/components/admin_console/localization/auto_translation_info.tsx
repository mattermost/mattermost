// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import './auto_translation_info.scss';

import SectionNotice from 'components/section_notice';

const AutoTranslationInfo = () => {
    return (
        <div className='autoTranslationInfo'>
            <SectionNotice
                title={
                    <FormattedMessage
                        id='admin.site.localization.autoTranslationInfo'
                        defaultMessage='Channel admins must also enable auto-translation for each channel where they want to use it.'
                    />
                }
                type='info'
            />
        </div>
    );
};

export default React.memo(AutoTranslationInfo);
