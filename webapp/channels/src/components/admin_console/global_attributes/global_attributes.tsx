// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import AdminHeader from 'components/widgets/admin_console/admin_header';

import GlobalAttributesTable from './global_attributes_table';

import {AdminSection, AdminWrapper, SectionContent, SectionHeader, SectionHeading} from '../system_properties/controls';

const messages = defineMessages({
    title: {id: 'admin.global_attributes.title', defaultMessage: 'Manage Attributes'},
    sectionTitle: {id: 'admin.global_attributes.section_title', defaultMessage: 'Manage Attributes'},
    sectionSubtitle: {id: 'admin.global_attributes.section_subtitle', defaultMessage: 'Define an attribute once, then choose which resources can use it.'},
});

export const searchableStrings = [
    messages.title,
];

const GlobalAttributes: React.FC = () => {
    return (
        <div
            className='wrapper--fixed'
            data-testid='globalAttributes'
        >
            <AdminHeader>
                <FormattedMessage {...messages.title}/>
            </AdminHeader>
            <AdminWrapper>
                <AdminSection data-testid='global_attributes'>
                    <SectionHeader>
                        <hgroup>
                            <FormattedMessage
                                tagName={SectionHeading}
                                {...messages.sectionTitle}
                            />
                            <FormattedMessage {...messages.sectionSubtitle}/>
                        </hgroup>
                    </SectionHeader>
                    <SectionContent $compact={true}>
                        <GlobalAttributesTable/>
                    </SectionContent>
                </AdminSection>
            </AdminWrapper>
        </div>
    );
};

export default GlobalAttributes;
