// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import SelectTextInput, {type SelectTextInputOption} from 'components/common/select_text_input/select_text_input';
import CheckboxSettingItem from 'components/widgets/modals/components/checkbox_setting_item';
import {type SaveChangesPanelState} from 'components/widgets/modals/components/save_changes_panel';

type Props = {
    allowedDomains: string[];
    setAllowedDomains: (domains: string[]) => void;
    setHasChanges: (hasChanges: boolean) => void;
    setSaveChangesPanelState: (state: SaveChangesPanelState) => void;
}

const AllowedDomainsSelect = ({allowedDomains, setAllowedDomains, setHasChanges, setSaveChangesPanelState}: Props) => {
    const [showAllowedDomains, setShowAllowedDomains] = useState<boolean>(allowedDomains.length > 0);
    const {formatMessage} = useIntl();

    const handleEnableAllowedDomains = useCallback((enabled: boolean) => {
        setShowAllowedDomains(enabled);
        if (!enabled) {
            setAllowedDomains([]);
        }
    }, [setAllowedDomains]);

    const updateAllowedDomains = useCallback((domain: string) => {
        setHasChanges(true);
        setSaveChangesPanelState('editing');
        setAllowedDomains([...allowedDomains, domain]);
    }, [allowedDomains, setAllowedDomains, setHasChanges, setSaveChangesPanelState]);

    const handleOnChangeDomains = useCallback((allowedDomainsOptions?: SelectTextInputOption[] | null) => {
        setHasChanges(true);
        setSaveChangesPanelState('editing');
        setAllowedDomains(allowedDomainsOptions?.map((domain) => domain.value) || []);
    }, [setAllowedDomains, setHasChanges, setSaveChangesPanelState]);

    return (
        <>
            <CheckboxSettingItem
                inputFieldTitle={
                    <FormattedMessage
                        id='general_tab.allowedDomains'
                        defaultMessage='Allow only users with a specific email domain to join this team'
                    />
                }
                data-testid='allowedDomainsCheckbox'
                className='access-allowed-domains-section'
                title={formatMessage({
                    id: 'general_tab.AllowedDomainsTitle',
                    defaultMessage: 'Users with a specific email domain',
                })}
                description={formatMessage({
                    id: 'general_tab.AllowedDomainsInfo',
                    defaultMessage: 'When enabled, users can only join the team if their email matches a specific domain (e.g. "mattermost.org")',
                })}
                descriptionAboveContent={true}
                inputFieldData={{name: 'showAllowedDomains'}}
                inputFieldValue={showAllowedDomains}
                handleChange={handleEnableAllowedDomains}
            />
            {showAllowedDomains &&
            <SelectTextInput
                id='allowedDomains'
                placeholder={formatMessage({id: 'general_tab.AllowedDomainsExample', defaultMessage: 'corp.mattermost.com, mattermost.com'})}
                aria-label={formatMessage({id: 'general_tab.allowedDomains.ariaLabel', defaultMessage: 'Allowed Domains'})}
                value={allowedDomains}
                onChange={handleOnChangeDomains}
                handleNewSelection={updateAllowedDomains}
                isClearable={false}
                description={formatMessage({id: 'general_tab.AllowedDomainsTip', defaultMessage: 'Seperate multiple domains with a space, comma, tab or enter.'})}
            />
            }
        </>
    );
};

export default AllowedDomainsSelect;
