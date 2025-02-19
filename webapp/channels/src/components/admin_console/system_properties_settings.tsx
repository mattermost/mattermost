// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {FormattedMessage, defineMessages} from 'react-intl';

import type {ClientError} from '@mattermost/client';
import type {StatusOK} from '@mattermost/types/client4';
import type {AdminConfig} from '@mattermost/types/config';
import type {UserPropertyField, UserPropertyFieldType} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import OLDAdminSettings from './old_admin_settings';
import type {BaseProps, BaseState} from './old_admin_settings';
import SettingsGroup from './settings_group';

type Props = BaseProps & {
    config: AdminConfig;
};

type State = BaseState & {
    canSave: boolean;
    customAttributeValues: Record<string, string>;
    saveNeeded: boolean;
};

const messages = defineMessages({
    title: {id: 'admin.system_properties.title', defaultMessage: 'System Properties'},
});

// Types
interface BaseFieldProps {
    group_id: 'custom_profile_attributes';
    create_at: number;
    delete_at: number;
    update_at: number;
}

type CPAFieldType = 
    | UserPropertyField 
    | UserBinaryImagePropertyField 
    | UserDatePropertyField 
    | UserSelectPropertyField 
    | UserMultiSelectPropertyField 
    | UserUserReferencePropertyField 
    | UserMultiUserReferencePropertyField;

interface BaseCPAFieldDefinition {
    id: string;
    name: string;
    attrs: {
        ldapAttributeName: string;
    };
}

// Specific field definitions with correct types
interface TextFieldDefinition extends BaseCPAFieldDefinition {
    type: UserPropertyFieldType;
}

interface ImageFieldDefinition extends BaseCPAFieldDefinition {
    type: UserBinaryImagePropertyFieldType;
}

interface DateFieldDefinition extends BaseCPAFieldDefinition {
    type: UserDatePropertyFieldType;
}

interface SelectFieldDefinition extends BaseCPAFieldDefinition {
    type: UserSelectPropertyFieldType;
}

interface MultiSelectFieldDefinition extends BaseCPAFieldDefinition {
    type: UserMultiSelectPropertyFieldType;
}

interface UserReferenceFieldDefinition extends BaseCPAFieldDefinition {
    type: UserUserReferencePropertyFieldType;
}

interface MultiUserReferenceFieldDefinition extends BaseCPAFieldDefinition {
    type: UserMultiUserReferencePropertyFieldType;
}

type CPAFieldDefinition = 
    | TextFieldDefinition 
    | ImageFieldDefinition 
    | DateFieldDefinition 
    | SelectFieldDefinition 
    | MultiSelectFieldDefinition 
    | UserReferenceFieldDefinition 
    | MultiUserReferenceFieldDefinition;

// Constants
const BASE_FIELD_PROPS: BaseFieldProps = {
    group_id: 'custom_profile_attributes',
    create_at: 1736541716295,
    delete_at: 0,
    update_at: 0,
};

const CPA_FIELD_DEFINITIONS: CPAFieldDefinition[] = [
    {
        id: 'abcdefghijklmnopqrstuvwxy0',
        name: 'textCustomProfileProperty',
        attrs: {ldapAttributeName: 'textCustomAttribute'},
        type: 'text',
    },
    {
        id: 'abcdefghijklmnopqrstuvwxy1',
        name: 'binaryImageCustomProfileProperty',
        attrs: {ldapAttributeName: 'binaryImageCustomAttribute'},
        type: 'image',
    },
    {
        id: 'abcdefghijklmnopqrstuvwxy2',
        name: 'dateCustomProfileProperty',
        attrs: {ldapAttributeName: 'dateCustomAttribute'},
        type: 'date',
    },
    {
        id: 'abcdefghijklmnopqrstuvwxy3',
        name: 'selectCustomProfileProperty',
        attrs: {ldapAttributeName: 'selectCustomAttribute'},
        type: 'select',
    },
    {
        id: 'abcdefghijklmnopqrstuvwxy4',
        name: 'multiSelectCustomProfileProperty',
        attrs: {ldapAttributeName: 'multiSelectCustomAttribute'},
        type: 'multiselect',
    },
    {
        id: 'abcdefghijklmnopqrstuvwxy5',
        name: 'userReferenceCustomProfileProperty',
        attrs: {ldapAttributeName: 'userReferenceCustomAttribute'},
        type: 'user',
    },
    {
        id: 'abcdefghijklmnopqrstuvwxy6',
        name: 'multiUserReferenceCustomProfileProperty',
        attrs: {ldapAttributeName: 'multiUserReferenceCustomAttribute'},
        type: 'multiuser',
    },
];

// Utility functions
const createField = (definition: CPAFieldDefinition): UserPropertyField => ({
    ...BASE_FIELD_PROPS,
    ...definition,
});

export default class SystemPropertiesSettings extends OLDAdminSettings<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            saveNeeded: true,
        };
    }

    getConfigFromState = (config: Props['config']) => {
        return config;
    };

    getStateFromConfig(config: Props['config']) {
        return {
            canSave: true,
        };
    }

    handleSettingChanged = (id: string, value: boolean) => {
        this.handleChange(id, value);
    };

    private async handleCustomFieldOperations() {
        try {
            // Get and remove existing fields
            const existingFields = await this.getCustomProfileAttributeFields();
            await Promise.all(existingFields.map((field) => this.deleteCustomProfileAttributeField(field.id)));

            // Create new fields
            const newFields = CPA_FIELD_DEFINITIONS.map(createField);
            await Promise.all(newFields.map((field) => this.createCustomProfileAttributeField(field)));

            // Verify the new fields
            await this.getCustomProfileAttributeFields();
        } catch (error) {
            console.error('Error handling custom field operations:', error);
            // Handle error appropriately
        }
    }

    async deleteCustomProfileAttributeField(fieldId: string): Promise<StatusOK> {
        try {
            const status = await Client4.deleteCustomProfileAttributeField(fieldId);
            console.log(`Field ${fieldId} removed with status: ${status}`);
            return status;
        } catch (error) {
            console.error('Error deleting custom profile field:', error);
            throw error;
        }
    }

    async createCustomProfileAttributeField(field: UserPropertyField): Promise<UserPropertyField> {
        const {name, type, attrs} = field;
        
        try {
            const newField = await Client4.createCustomProfileAttributeField({name, type, attrs});
            console.log(`Created field: ${newField.id}, name: ${newField.name}`);
            return newField;
        } catch (error) {
            console.error('Error creating custom profile field:', error);
            return {
                ...BASE_FIELD_PROPS,
                name: '',
                type: 'text',
                id: '',
            };
        }
    }

    async getCustomProfileAttributeFields(): Promise<UserPropertyField[]> {
        try {
            const fields = await Client4.getCustomProfileAttributeFields();
            fields.forEach(field => {
                console.log(`Retrieved field: ${field.id}, name: ${field.name}`);
            });
            return fields;
        } catch (error) {
            console.error('Error getting custom profile fields:', error);
            return [];
        }
    }

    handleSubmit = () => {
        this.handleCustomFieldOperations();
    };

    canSave = () => {
        return true;
    };

    renderTitle() {
        return (<FormattedMessage {...messages.title}/>);
    }

    renderSettings = () => {
        return (
            <SettingsGroup/>
        );
    };
}
