// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import Setting from 'components/admin_console/setting';

import {getHistory} from 'utils/browser_history';

import {AdminSection, SectionHeader, SectionHeading} from '../../system_properties/controls';
import {GlobalBannerSectionContent, GlobalBannerSectionSetting} from '../classification_markings_styled';

const MEMBERSHIP_POLICIES_URL = '/admin_console/system_attributes/membership_policies';

const msg = defineMessages({
    sectionTitle: {id: 'admin.classification_markings.enforcement.section_title', defaultMessage: 'Classification Enforcement'},
    sectionDescription: {id: 'admin.classification_markings.enforcement.section_description', defaultMessage: "Restrict access to classified resources based on a user's clearance. When enforced, users must hold a ranked clearance attribute that meets each resource's classification level."},
    enforceTitle: {id: 'admin.classification_markings.enforcement.enforce.title', defaultMessage: 'Enforce classification markings'},
    enforceHelp: {id: 'admin.classification_markings.enforcement.enforce.help', defaultMessage: "When enabled, access can be gated by a user's clearance attribute. This is managed by a corresponding <link>membership policy</link>."},
    clearanceTitle: {id: 'admin.classification_markings.enforcement.clearance.title', defaultMessage: 'Clearance attribute'},
    clearanceCheckbox: {id: 'admin.classification_markings.enforcement.clearance.checkbox', defaultMessage: 'Enable clearance attribute'},
    clearanceHelp: {id: 'admin.classification_markings.enforcement.clearance.help', defaultMessage: 'Creates a ranked "Clearance" user attribute linked to these classification levels on save, so a membership policy can reference user.attributes.Clearance. Unchecking removes it on save.'},
});

type Props = {
    clearanceEnabled: boolean;
    onClearanceEnabledChange: (value: boolean) => void;
    disabled?: boolean;
};

export default function ClassificationEnforcement({clearanceEnabled, onClearanceEnabledChange, disabled}: Props) {
    const membershipPolicyLink = useCallback((chunks: React.ReactNode) => (
        <a
            href={MEMBERSHIP_POLICIES_URL}
            onClick={(e) => {
                e.preventDefault();
                getHistory().push(MEMBERSHIP_POLICIES_URL);
            }}
        >
            {chunks}
        </a>
    ), []);

    const handleClearanceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onClearanceEnabledChange(e.target.checked);
    }, [onClearanceEnabledChange]);

    return (
        <AdminSection>
            <SectionHeader>
                <hgroup>
                    <FormattedMessage
                        tagName={SectionHeading}
                        {...msg.sectionTitle}
                    />
                    <FormattedMessage {...msg.sectionDescription}/>
                </hgroup>
            </SectionHeader>
            <GlobalBannerSectionContent>
                <form
                    className='form-horizontal'
                    onSubmit={(e) => e.preventDefault()}
                >
                    <GlobalBannerSectionSetting>
                        <Setting
                            inputId='classificationEnforce'
                            label={<FormattedMessage {...msg.enforceTitle}/>}
                            helpText={
                                <FormattedMessage
                                    {...msg.enforceHelp}
                                    values={{link: membershipPolicyLink}}
                                />
                            }
                            setByEnv={false}
                        />
                    </GlobalBannerSectionSetting>
                    <GlobalBannerSectionSetting>
                        <Setting
                            inputId='clearanceAttribute'
                            label={<FormattedMessage {...msg.clearanceTitle}/>}
                            helpText={<FormattedMessage {...msg.clearanceHelp}/>}
                            setByEnv={false}
                        >
                            <label className='checkbox-inline'>
                                <input
                                    data-testid='clearanceAttributeCheckbox'
                                    type='checkbox'
                                    checked={clearanceEnabled}
                                    onChange={handleClearanceChange}
                                    disabled={disabled}
                                />
                                <FormattedMessage {...msg.clearanceCheckbox}/>
                            </label>
                        </Setting>
                    </GlobalBannerSectionSetting>
                </form>
            </GlobalBannerSectionContent>
        </AdminSection>
    );
}
