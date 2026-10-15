// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage} from 'react-intl';

import {LicenseSkus} from 'utils/constants';

import AutoTranslationSVG from './images/auto_translate_svg';

import FeatureDiscovery from '../index';

const AutoTranslationFeatureDiscovery: React.FC = () => {
    return (
        <FeatureDiscovery
            featureName='auto-translation'
            showSkuTag={true}
            minimumSKURequiredForFeature={LicenseSkus.EnterpriseAdvanced}
            title={defineMessage({
                id: 'admin.auto_translation_feature_discovery.title',
                // U+2011 non-breaking hyphen keeps "auto-translation" on one line
                defaultMessage: 'Remove language barriers with auto\u2011translation',
            })}
            copy={defineMessage({
                id: 'admin.auto_translation_feature_discovery.copy',
                // eslint-disable-next-line formatjs/enforce-placeholders -- values spread onto FormattedMessage in FeatureDiscovery
                defaultMessage: 'Effortlessly collaborate across languages with auto\u2011translation. Messages in shared channels are instantly translated based on each user’s language preference—no extra steps required.{br}<strong>Only available in Enterprise Advanced.</strong>',
                values: {
                    strong: (msg: string) => <strong key='auto-translation-strong'>{msg}</strong>,
                    br: <br key='auto-translation-br'/>,
                },
            })}
            learnMoreURL='https://docs.mattermost.com/administration-guide/manage/admin/autotranslation.html'
            featureDiscoveryImage={
                <AutoTranslationSVG
                    width={158}
                    height={149}
                />
            }
        />
    );
};

export default AutoTranslationFeatureDiscovery;
