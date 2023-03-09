// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import FeatureDiscovery from 'components/admin_console/feature_discovery/feature_discovery';

import {LicenseSkus} from 'utils/constants';

import SamlSVG from './features/images/saml_svg';

describe('components/feature_discovery', () => {
    describe('FeatureDiscovery', () => {
        test('should match snapshot', () => {
            const wrapper = shallow(
                <FeatureDiscovery
                    featureName='test'
                    minimumSKURequiredForFeature={LicenseSkus.Professional}
                    contactSalesLink='/sales'
                    titleID='translation.test.title'
                    titleDefault='Foo'
                    copyID='translation.test.copy'
                    copyDefault={'Bar'}
                    learnMoreURL='https://test.mattermost.com/secondary/'
                    featureDiscoveryImage={<SamlSVG/>}
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    stats={{TOTAL_USERS: 20}}
                    prevTrialLicense={{IsLicensed: 'false'}}
                    isCloud={false}
                    isCloudTrial={false}
                    hadPrevCloudTrial={false}
                    isSubscriptionLoaded={true}
                    isPaidSubscription={false}
                    actions={{
                        getPrevTrialLicense: jest.fn(),
                        getCloudSubscription: jest.fn(),
                        openModal: jest.fn(),
                    }}
                />,
            );
            expect(wrapper).toMatchSnapshot();
        });
        test('should match snapshot when is cloud environment', () => {
            const wrapper = shallow(
                <FeatureDiscovery
                    featureName='test'
                    minimumSKURequiredForFeature={LicenseSkus.Professional}
                    contactSalesLink='/sales'
                    titleID='translation.test.title'
                    titleDefault='Foo'
                    copyID='translation.test.copy'
                    copyDefault={'Bar'}
                    learnMoreURL='https://test.mattermost.com/secondary/'
                    featureDiscoveryImage={<SamlSVG/>}
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    stats={{TOTAL_USERS: 20}}
                    prevTrialLicense={{IsLicensed: 'false'}}
                    isCloud={true}
                    isCloudTrial={false}
                    hadPrevCloudTrial={false}
                    isPaidSubscription={false}
                    isSubscriptionLoaded={true}
                    actions={{
                        getPrevTrialLicense: jest.fn(),
                        openModal: jest.fn(),
                        getCloudSubscription: jest.fn(),
                    }}
                />,
            );
            expect(wrapper).toMatchSnapshot();
        });

        test('should match snapshot when is cloud environment and subscription is not loaded yet in redux store', () => {
            const wrapper = shallow(
                <FeatureDiscovery
                    featureName='test'
                    minimumSKURequiredForFeature={LicenseSkus.Professional}
                    contactSalesLink='/sales'
                    titleID='translation.test.title'
                    titleDefault='Foo'
                    copyID='translation.test.copy'
                    copyDefault={'Bar'}
                    learnMoreURL='https://test.mattermost.com/secondary/'
                    featureDiscoveryImage={<SamlSVG/>}
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    stats={{TOTAL_USERS: 20}}
                    prevTrialLicense={{IsLicensed: 'false'}}
                    isCloud={true}
                    isCloudTrial={false}
                    hadPrevCloudTrial={false}
                    isSubscriptionLoaded={false}
                    isPaidSubscription={false}
                    actions={{
                        getPrevTrialLicense: jest.fn(),
                        openModal: jest.fn(),
                        getCloudSubscription: jest.fn(),
                    }}
                />,
            );
            expect(wrapper).toMatchSnapshot();
        });
    });
});
