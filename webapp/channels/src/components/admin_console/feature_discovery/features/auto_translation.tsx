// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage} from 'react-intl';

import Tag from 'components/widgets/tag/tag';

import {LicenseSkus} from 'utils/constants';

import AutoTranslationSVG from './images/auto_translate_svg';

import FeatureDiscovery from '../index';

import './auto_translation.scss';

const AutoTranslationFeatureDiscovery: React.FC = () => {
    return (
        <div className='AutoTranslationFeatureDiscovery'>
            <Tag
                text='ENTERPRISE ADVANCED'
                icon='mattermost'
                className='AutoTranslationTag'
            />
            <FeatureDiscovery
                featureName='auto-translation'
                minimumSKURequiredForFeature={LicenseSkus.EnterpriseAdvanced}
                title={defineMessage({
                    id: 'admin.auto_translation_feature_discovery.title',
                    defaultMessage: 'Remove language barriers with Auto-Translation',
                })}
                copy={defineMessage({
                    id: 'admin.auto_translation_feature_discovery.copy',
                    defaultMessage: 'Effortlessly collaborate across languages with auto-translation. Messages in shared channels are instantly translated based on each user’s language preference—no extra steps required.{br}<strong>Only available in Enterprise Advanced.</strong>',
                    values: {strong: (msg: string) => <strong>{msg}</strong>, br: <br/>},
                })}
                learnMoreURL='https://docs.mattermost.com'
                featureDiscoveryImage={
                    <AutoTranslationSVG
                        width={158}
                        height={149}
                    />
                }
            />
        </div>
    );
};

export default AutoTranslationFeatureDiscovery;
