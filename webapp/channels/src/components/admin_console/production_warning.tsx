// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {AdminConfig, ClientLicense} from '@mattermost/types/config';

import SectionNotice from 'components/section_notice';

import type {AdminDefinitionSetting} from './types';

type Props = {
    setting: AdminDefinitionSetting;
    config: Partial<AdminConfig>;
    state: {[x: string]: any};
    license?: ClientLicense;
    isDisabled?: boolean;
};

const ProductionWarning = ({setting, config, state, license, isDisabled}: Props) => {
    const intl = useIntl();

    const warning = setting.production_warning;
    if (!warning || isDisabled) {
        return null;
    }

    const isEnabled = typeof warning.isEnabled === 'function' ? warning.isEnabled(config, state, license) : Boolean(warning.isEnabled);
    if (!isEnabled) {
        return null;
    }

    return (
        <div className='admin-console__production-warning'>
            <SectionNotice
                type='danger'
                title={intl.formatMessage(warning.title)}
                text={intl.formatMessage(warning.text)}
            />
        </div>
    );
};

export default ProductionWarning;
