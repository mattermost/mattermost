// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage} from 'react-intl';

import {
    AdminSection,
    SectionContent,
} from 'components/admin_console/system_properties/controls';

import {LicenseSkus} from 'utils/constants';

import './auto_translation.scss';
import AutoTranslationSVG from './images/auto_translate_svg';

import FeatureDiscovery from '../index';

const AutoTranslationFeatureDiscovery: React.FC = () => {
    return (
        <AdminSection>
            <SectionContent>
                <div className='AutoTranslationFeatureDiscovery'>
                    <FeatureDiscovery
                        featureName='auto-translation'
                        showSkuTag={true}
                        minimumSKURequiredForFeature={LicenseSkus.EnterpriseAdvanced}
                        title={defineMessage({
                            id: 'admin.auto_translation_feature_discovery.title',
                            defaultMessage: 'Remove language barriers with auto-translation',
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
            </SectionContent>
        </AdminSection>
    );
};

export default AutoTranslationFeatureDiscovery;
