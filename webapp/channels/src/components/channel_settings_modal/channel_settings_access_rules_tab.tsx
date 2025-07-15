// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {useIntl} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';
import type {UserPropertyField} from '@mattermost/types/properties';

import TableEditor from 'components/admin_console/access_control/editors/table_editor/table_editor';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';

import './channel_settings_access_rules_tab.scss';

type ChannelSettingsAccessRulesTabProps = {
    channel: Channel;
    setAreThereUnsavedChanges?: (unsaved: boolean) => void;
    showTabSwitchError?: boolean;
};

function ChannelSettingsAccessRulesTab({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    channel,
    setAreThereUnsavedChanges,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    showTabSwitchError,
}: ChannelSettingsAccessRulesTabProps) {
    const {formatMessage} = useIntl();

    // State for the access control expression and user attributes
    const [expression, setExpression] = useState('');
    const [userAttributes, setUserAttributes] = useState<UserPropertyField[]>([]);
    const [attributesLoaded, setAttributesLoaded] = useState(false);

    // Use our hook for ABAC actions (channel context will be added in future)
    const actions = useChannelAccessControlActions();

    // Load user attributes on component mount
    useEffect(() => {
        const loadAttributes = async () => {
            try {
                const result = await actions.getAccessControlFields('', 100);
                if (result.data) {
                    setUserAttributes(result.data);
                }
                setAttributesLoaded(true);
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('Failed to load access control fields:', error);
                setAttributesLoaded(true);
            }
        };

        loadAttributes();
    }, [actions]);

    const handleExpressionChange = (newExpression: string) => {
        setExpression(newExpression);
        if (setAreThereUnsavedChanges) {
            setAreThereUnsavedChanges(true);
        }
    };

    const handleParseError = () => {
        // For now, just log the error. In the future, we might want to show an error message
        // eslint-disable-next-line no-console
        console.warn('Failed to parse expression in table editor');
    };

    return (
        <div className='ChannelSettingsModal__accessRulesTab'>
            <div className='ChannelSettingsModal__accessRulesHeader'>
                <h3 className='ChannelSettingsModal__accessRulesTitle'>
                    {formatMessage({id: 'channel_settings.access_rules.title', defaultMessage: 'Access Rules'})}
                </h3>
                <p className='ChannelSettingsModal__accessRulesSubtitle'>
                    {formatMessage({
                        id: 'channel_settings.access_rules.subtitle',
                        defaultMessage: 'Select user attributes and values as rules to restrict channel membership',
                    })}
                </p>
            </div>

            {/* TableEditor for creating access rules */}
            {attributesLoaded && (
                <div className='ChannelSettingsModal__accessRulesEditor'>
                    <TableEditor
                        value={expression}
                        onChange={handleExpressionChange}
                        onValidate={() => {}}
                        userAttributes={userAttributes}
                        onParseError={handleParseError}
                        actions={actions}
                    />
                </div>
            )}

            <p className='ChannelSettingsModal__accessRulesDescription'>
                {formatMessage({
                    id: 'channel_settings.access_rules.description',
                    defaultMessage: 'Select attributes and values that users must match in addition to access this channel. All selected attributes are required.',
                })}
            </p>

            {/* Placeholder for future auto-add members section */}
            {/* TODO: Add autoadd members based on access rules section */}
        </div>
    );
}

export default ChannelSettingsAccessRulesTab;
