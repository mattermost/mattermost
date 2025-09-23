// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage} from 'react-intl';

import {LicenseSkus} from 'utils/constants';

import GroupsSVG from './images/groups_svg';

import FeatureDiscovery from '../index';

const UserAttributesFeatureDiscovery: React.FC = () => {
    return (
        <FeatureDiscovery
            featureName='user_attributes'
            minimumSKURequiredForFeature={LicenseSkus.Enterprise}
            title={defineMessage({
                id: 'admin.user_attributes_feature_discovery.title',
                defaultMessage: 'Add critical metadata to user profiles using custom user attributes with Mattermost Enterprise',
            })}
            copy={defineMessage({
                id: 'admin.user_attributes_feature_discovery.desc',
                defaultMessage: 'Define and manage organization-specific user profile attributes as that can synchronize with your AD/LDAP or SAML identity provider.',
            })}
            learnMoreURL='https://docs.mattermost.com/manage/admin/user-attributes.html'
            featureDiscoveryImage={
                <GroupsSVG
                    width={294}
                    height={180}
                />
            }
        />
    );
};

export default UserAttributesFeatureDiscovery;
