// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */

import classNames from 'classnames';
import React, {PureComponent} from 'react';
import type {ChangeEvent, MouseEvent} from 'react';
import type {IntlShape, WrappedComponentProps} from 'react-intl';
import {FormattedMessage, defineMessage, injectIntl} from 'react-intl';
import type {RouteComponentProps} from 'react-router-dom';
import ReactSelect from 'react-select';

import {SyncIcon} from '@mattermost/compass-icons/components';
import type {ServerError} from '@mattermost/types/errors';
import type {UserPropertyField} from '@mattermost/types/properties';
import type {Team, TeamMembership} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';
import {isEmail, getInputTypeFromValueType} from 'mattermost-redux/utils/helpers';

import AdminUserCard from 'components/admin_console/admin_user_card/admin_user_card';
import BlockableLink from 'components/admin_console/blockable_link';
import ResetPasswordModal from 'components/admin_console/reset_password_modal';
import TeamList from 'components/admin_console/system_user_detail/team_list';
import ConfirmManageUserSettingsModal from 'components/admin_console/system_users/system_users_list_actions/confirm_manage_user_settings_modal';
import ConfirmModal from 'components/confirm_modal';
import FormError from 'components/form_error';
import SaveButton from 'components/save_button';
import TeamSelectorModal from 'components/team_selector_modal';
import UserSettingsModal from 'components/user_settings/modal';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import AdminPanel from 'components/widgets/admin_console/admin_panel';
import AtIcon from 'components/widgets/icons/at_icon';
import SheidOutlineIcon from 'components/widgets/icons/shield_outline_icon';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';
import WithTooltip from 'components/with_tooltip';

import {Constants, ModalIdentifiers} from 'utils/constants';
import {validHttpUrl} from 'utils/url';
import {toTitleCase} from 'utils/utils';

import type {PropsFromRedux} from './index';

import './system_user_detail.scss';

// Private component for CPA multiselect fields
type CPAMultiSelectProps = {
    options: Array<{id: string; name: string}>;
    selectedValues: string[];
    onChange: (values: string[]) => void;
    disabled: boolean;
    placeholder: string;
    noOptionsMessage: string;
};

const CPAMultiSelect: React.FC<CPAMultiSelectProps> = ({
    options,
    selectedValues,
    onChange,
    disabled,
    placeholder,
    noOptionsMessage,
}) => {
    // Transform options to ReactSelect format
    const selectOptions = options.map((option) => ({
        value: option.id,
        label: option.name,
    }));

    // Transform selected values to ReactSelect format
    const selectedOptions = selectedValues.map((selectedId) => {
        const option = options.find((opt) => opt.id === selectedId);
        return option ? {value: option.id, label: option.name} : null;
    }).filter((opt): opt is {value: string; label: string} => opt !== null);

    return (
        <ReactSelect
            isMulti={true}
            options={selectOptions}
            value={selectedOptions}
            onChange={(selectedOptions) => {
                const selectedIds = selectedOptions ? selectedOptions.map((opt) => opt.value) : [];
                onChange(selectedIds);
            }}
            isDisabled={disabled}
            isClearable={false}
            placeholder={placeholder}
            noOptionsMessage={() => noOptionsMessage}
            styles={{
                container: (provided) => ({
                    ...provided,
                    maxWidth: '320px',
                }),
            }}
        />
    );
};

export type Params = {
    user_id?: UserProfile['id'];
};

export type Props = PropsFromRedux & RouteComponentProps<Params> & WrappedComponentProps;

export type State = {
    user?: UserProfile;
    emailField: string;
    customProfileAttributeFields: UserPropertyField[];
    customProfileAttributeValues: Record<string, string | string[]>;
    originalCpaValues: Record<string, string | string[]>;
    isLoading: boolean;
    error?: string | null;
    isSaveNeeded: boolean;
    isSaving: boolean;
    teams: TeamMembership[];
    teamIds: Array<Team['id']>;
    refreshTeams: boolean;
    showResetPasswordModal: boolean;
    showDeactivateMemberModal: boolean;
    showTeamSelectorModal: boolean;
};

export class SystemUserDetail extends PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            emailField: '',
            customProfileAttributeFields: [],
            customProfileAttributeValues: {},
            originalCpaValues: {},
            isLoading: false,
            error: null,
            isSaveNeeded: false,
            isSaving: false,
            teams: [],
            teamIds: [],
            refreshTeams: true,
            showResetPasswordModal: false,
            showDeactivateMemberModal: false,
            showTeamSelectorModal: false,
        };
    }

    getUser = async (userId: UserProfile['id']) => {
        this.setState({isLoading: true});

        try {
            // Fetch user data and CPA values in parallel
            const [userResult, cpaResult] = await Promise.all([
                this.props.getUser(userId) as ActionResult<UserProfile, ServerError>,
                this.props.getCustomProfileAttributeValues(userId),
            ]);

            if (userResult.data) {
                const cpaValues = (cpaResult as {data?: Record<string, string | string[]>}).data || {};
                this.setState({
                    user: userResult.data,
                    emailField: userResult.data.email, // Set emailField to the email of the user for editing purposes
                    customProfileAttributeValues: cpaValues,
                    originalCpaValues: {...cpaValues}, // Deep copy for change tracking
                    isLoading: false,
                });
            } else {
                throw new Error(userResult.error ? userResult.error.message : this.props.intl.formatMessage({id: 'admin.user_item.unknownError', defaultMessage: 'Unknown error'}));
            }
        } catch (error) {
            console.log('SystemUserDetails-getUser: ', error); // eslint-disable-line no-console

            this.setState({
                isLoading: false,
                error: this.props.intl.formatMessage({id: 'admin.user_item.userNotFound', defaultMessage: 'Cannot load User'}),
            });
        }
    };

    componentDidMount() {
        const userId = this.props.match.params.user_id ?? '';
        if (userId) {
            // We dont have to handle the case of userId being empty here because the redirect will take care of it from the parent components
            this.getUser(userId);
        }

        // Fetch CPA field definitions if not already available
        if (this.props.customProfileAttributeFields.length === 0) {
            this.props.getCustomProfileAttributeFields();
        }
    }

    handleTeamsLoaded = (teams: TeamMembership[]) => {
        const teamIds = teams.map((team) => team.team_id);
        this.setState({teams});
        this.setState({teamIds});
        this.setState({refreshTeams: false});
    };

    handleAddUserToTeams = (teams: Team[]) => {
        if (!this.state.user) {
            return;
        }

        const promises = [];
        for (const team of teams) {
            promises.push(this.props.addUserToTeam(team.id, this.state.user.id));
        }
        Promise.all(promises).finally(() =>
            this.setState({refreshTeams: true}),
        );
    };

    handleActivateUser = async () => {
        if (!this.state.user || this.state.user?.auth_service === Constants.LDAP_SERVICE) {
            return;
        }

        try {
            const {error} = await this.props.updateUserActive(this.state.user.id, true) as ActionResult<boolean, ServerError>;
            if (error) {
                throw new Error(error.message);
            }

            await this.getUser(this.state.user.id);
        } catch (err) {
            console.error('SystemUserDetails-handleActivateUser', err); // eslint-disable-line no-console

            // Show the actual server error message instead of generic message
            const errorMessage = (err as Error).message || this.props.intl.formatMessage({id: 'admin.user_item.userActivateFailed', defaultMessage: 'Failed to activate user'});
            this.setState({error: errorMessage});
        }
    };

    handleDeactivateMember = async () => {
        if (!this.state.user) {
            return;
        }

        try {
            const {error} = await this.props.updateUserActive(this.state.user.id, false) as ActionResult<boolean, ServerError>;
            if (error) {
                throw new Error(error.message);
            }

            await this.getUser(this.state.user.id);
        } catch (err) {
            console.error('SystemUserDetails-handleDeactivateMember', err); // eslint-disable-line no-console

            // Show the actual server error message instead of generic message
            const errorMessage = (err as Error).message || this.props.intl.formatMessage({id: 'admin.user_item.userDeactivateFailed', defaultMessage: 'Failed to deactivate user'});
            this.setState({error: errorMessage});
        }

        this.toggleCloseModalDeactivateMember();
    };

    handleRemoveMFA = async () => {
        if (!this.state.user) {
            return;
        }

        try {
            const {error} = await this.props.updateUserMfa(this.state.user.id, false) as ActionResult<boolean, ServerError>;
            if (error) {
                throw new Error(error.message);
            }

            await this.getUser(this.state.user.id);
        } catch (err) {
            console.error('SystemUserDetails-handleRemoveMFA', err); // eslint-disable-line no-console

            this.setState({error: this.props.intl.formatMessage({id: 'admin.user_item.userMFARemoveFailed', defaultMessage: 'Failed to remove user\'s MFA'})});
        }
    };

    handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (!this.state.user) {
            return;
        }

        const {target: {value}} = event;

        this.setState({
            emailField: value,
            error: null, // Clear any validation errors when user starts editing
        }, () => {
            this.checkForChanges();
        });
    };

    handleCpaValueChange = (fieldId: string, value: string | string[]) => {
        this.setState({
            customProfileAttributeValues: {
                ...this.state.customProfileAttributeValues,
                [fieldId]: value,
            },
            error: null, // Clear any validation errors when user starts editing
        }, () => {
            this.checkForChanges();
        });
    };

    checkForChanges = () => {
        if (!this.state.user) {
            return;
        }

        const emailChanged = this.state.emailField !== this.state.user.email;
        const cpaChanged = this.hasCpaChanges();
        const hasChanges = emailChanged || cpaChanged;

        this.setState({
            isSaveNeeded: hasChanges,
        });

        this.props.setNavigationBlocked(hasChanges);
    };

    hasCpaChanges = (): boolean => {
        const {customProfileAttributeValues, originalCpaValues} = this.state;

        // Check if any CPA value has changed
        const currentFields = new Set([...Object.keys(customProfileAttributeValues), ...Object.keys(originalCpaValues)]);

        for (const fieldId of currentFields) {
            const currentValue = customProfileAttributeValues[fieldId];
            const originalValue = originalCpaValues[fieldId];

            // Handle array comparison for multiselect fields
            if (Array.isArray(currentValue) && Array.isArray(originalValue)) {
                if (currentValue.length !== originalValue.length ||
                    currentValue.some((val, idx) => val !== originalValue[idx])) {
                    return true;
                }
            } else if (currentValue !== originalValue) {
                return true;
            }
        }

        return false;
    };

    renderCpaField = (field: UserPropertyField) => {
        const value = this.state.customProfileAttributeValues[field.id] || '';
        const isSynced = Boolean(field.attrs?.ldap || field.attrs?.saml);
        const isDisabled = this.state.isSaving || this.state.isLoading || isSynced;

        // Render sync indicator if field is synced
        const syncIndicator = isSynced ? (
            <div className='user-property-field-values__sync-indicator'>
                <SyncIcon size={18}/>
                <span>
                    <FormattedMessage
                        id='admin.userManagement.userDetail.syncedWith'
                        defaultMessage='Synced with: {source}'
                        values={{
                            source: field.attrs?.ldap ? this.props.intl.formatMessage({id: 'admin.userManagement.userDetail.ldap', defaultMessage: 'AD/LDAP: {propertyName}'}, {propertyName: field.attrs.ldap}) : this.props.intl.formatMessage({id: 'admin.userManagement.userDetail.saml', defaultMessage: 'SAML: {propertyName}'}, {propertyName: field.attrs?.saml}),
                        }}
                    />
                </span>
            </div>
        ) : null;

        const fieldContent = (() => {
            switch (field.type) {
            case 'select': {
                const options = field.attrs?.options || [];
                return (
                    <select
                        className='form-control'
                        value={Array.isArray(value) ? value[0] || '' : value}
                        onChange={(e) => this.handleCpaValueChange(field.id, e.target.value)}
                        disabled={isDisabled}
                    >
                        <option value=''>
                            {this.props.intl.formatMessage({
                                id: 'admin.userManagement.userDetail.selectOption',
                                defaultMessage: 'Select an option',
                            })}
                        </option>
                        {options.map((option) => (
                            <option
                                key={option.id}
                                value={option.id}
                            >
                                {option.name}
                            </option>
                        ))}
                    </select>
                );
            }
            case 'multiselect': {
                const options = field.attrs?.options || [];
                const selectedValues = Array.isArray(value) ? value : [];

                return (
                    <CPAMultiSelect
                        options={options}
                        selectedValues={selectedValues}
                        onChange={(values) => this.handleCpaValueChange(field.id, values)}
                        disabled={isDisabled}
                        placeholder={this.props.intl.formatMessage({
                            id: 'admin.user.selectOptions',
                            defaultMessage: 'Select options...',
                        })}
                        noOptionsMessage={this.props.intl.formatMessage({
                            id: 'admin.userManagement.userDetail.noOptions',
                            defaultMessage: 'No options available',
                        })}
                    />
                );
            }
            case 'text':
            default: {
                const inputType = getInputTypeFromValueType(field.attrs?.value_type);

                return (
                    <input
                        className='form-control'
                        type={inputType}
                        value={Array.isArray(value) ? value.join(this.props.intl.formatMessage({id: 'admin.userManagement.userDetail.arrayValueSeparator', defaultMessage: ', '})) : value}
                        onChange={(e) => this.handleCpaValueChange(field.id, e.target.value)}
                        disabled={isDisabled}
                    />
                );
            }
            }
        })();

        return (
            <label
                key={field.id}
                className='cpa-field'
            >
                <FormattedMessage
                    id='admin.userManagement.userDetail.cpaField'
                    defaultMessage='{fieldName}'
                    values={{fieldName: field.name}}
                />
                {fieldContent}
                {syncIndicator}
            </label>
        );
    };

    renderTwoColumnLayout = () => {
        const sortedCpaFields = [...this.props.customProfileAttributeFields].
            sort((a, b) => (a.attrs?.sort_order || 0) - (b.attrs?.sort_order || 0));

        const fields: Array<React.ReactNode | null> = [];

        // Add system fields
        fields.push(
            <label key='username'>
                <FormattedMessage
                    id='admin.userManagement.userDetail.username'
                    defaultMessage='Username'
                />
                <AtIcon/>
                <span>{this.state.user?.username}</span>
            </label>,
        );

        fields.push(
            <label key='authMethod'>
                <FormattedMessage
                    id='admin.userManagement.userDetail.authenticationMethod'
                    defaultMessage='Authentication Method'
                />
                <SheidOutlineIcon/>
                <span>{getUserAuthenticationTextField(this.props.intl, this.props.mfaEnabled, this.state.user)}</span>
            </label>,
        );

        fields.push(
            <label key='email'>
                <FormattedMessage
                    id='admin.userManagement.userDetail.email'
                    defaultMessage='Email'
                />
                <input
                    className='form-control'
                    type='text'
                    value={this.state.emailField}
                    onChange={this.handleEmailChange}
                    disabled={this.state.isSaving || this.state.isLoading}
                />
            </label>,
        );

        // Add CPA fields
        for (const field of sortedCpaFields) {
            fields.push(this.renderCpaField(field));
        }

        // Pad for even number
        if (fields.length % 2) {
            fields.push(null);
        }

        return (
            <div className='two-column-layout'>
                {fields.map((field, index) => {
                    if (index % 2 === 0) { // Start of new row
                        return (
                            <div
                                key={`field-row-${Math.trunc(index / 2)}`}
                                className='field-row'
                            >
                                <div className='field-column left'>
                                    {field}
                                </div>
                                <div className='field-column right'>
                                    {fields[index + 1]}
                                </div>
                            </div>
                        );
                    }
                    return null; // Skip odd indices
                }).filter(Boolean)}
            </div>
        );
    };

    handleCancel = () => {
        // Reset all fields to original values
        this.setState({
            emailField: this.state.user?.email || '',
            customProfileAttributeValues: {...this.state.originalCpaValues},
            error: null,
            isSaveNeeded: false,
        });
        this.props.setNavigationBlocked(false);
    };

    handleSubmit = async (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();

        if (this.state.isLoading || this.state.isSaving || !this.state.user) {
            return;
        }

        if (!this.state.isSaveNeeded) {
            return;
        }

        // Validate email if changed
        const emailChanged = this.state.user.email !== this.state.emailField;
        if (emailChanged && !isEmail(this.state.emailField)) {
            this.setState({error: this.props.intl.formatMessage({id: 'admin.user_item.invalidEmail', defaultMessage: 'Invalid email address'})});
            return;
        }

        // Validate CPA values if changed
        const cpaChanged = this.hasCpaChanges();
        if (cpaChanged) {
            const {customProfileAttributeFields} = this.props;
            for (const field of customProfileAttributeFields) {
                const valueType = field.attrs?.value_type;
                const currentValue = this.state.customProfileAttributeValues[field.id];
                const originalValue = this.state.originalCpaValues[field.id];
                if (!currentValue || !valueType || currentValue === originalValue) {
                    continue;
                }
                if (valueType === 'email') {
                    const stringValue = String(currentValue);
                    if (!isEmail(stringValue)) {
                        this.setState({error: this.props.intl.formatMessage({id: 'admin.user_item.invalidEmail', defaultMessage: 'Invalid email address'})});
                        return;
                    }
                } else if (valueType === 'url') {
                    const stringValue = String(currentValue);
                    if (validHttpUrl(stringValue) === null) {
                        this.setState({error: this.props.intl.formatMessage({id: 'admin.user_item.invalidUrl', defaultMessage: 'Invalid URL'})});
                        return;
                    }
                }
            }
        }

        this.setState({
            error: null,
            isSaving: true,
        });

        try {
            const promises = [];

            // Update user profile if email changed
            if (emailChanged) {
                const updatedUser = Object.assign({}, this.state.user, {email: this.state.emailField.trim().toLowerCase()});
                promises.push(this.props.patchUser(updatedUser));
            }

            // Update CPA values if changed
            if (cpaChanged) {
                // Get only changed CPA values and save each one using Redux action
                const {customProfileAttributeFields} = this.props;
                for (const field of customProfileAttributeFields) {
                    const currentValue = this.state.customProfileAttributeValues[field.id];
                    const originalValue = this.state.originalCpaValues[field.id];

                    // Check if this field value has changed
                    let hasChanged = false;
                    if (Array.isArray(currentValue) && Array.isArray(originalValue)) {
                        hasChanged = currentValue.length !== originalValue.length ||
                                   currentValue.some((val, idx) => val !== originalValue[idx]);
                    } else {
                        hasChanged = currentValue !== originalValue;
                    }

                    if (hasChanged) {
                        promises.push(this.props.saveCustomProfileAttribute(this.state.user!.id, field.id, currentValue || ''));
                    }
                }
            }

            // Execute all updates in parallel
            const results = await Promise.all(promises);

            // Handle results
            let updatedUser = this.state.user;
            let resultIndex = 0;

            // Handle user update result if email was changed
            if (emailChanged) {
                const userResult = results[resultIndex] as ActionResult<UserProfile, ServerError>;
                if (userResult.data) {
                    updatedUser = userResult.data;
                } else if (userResult.error) {
                    throw new Error(userResult.error.message);
                }
                resultIndex++;
            }

            // Handle CPA update results if CPA values were changed
            if (cpaChanged) {
                // Check remaining results for any CPA save errors
                for (let i = resultIndex; i < results.length; i++) {
                    const cpaResult = results[i] as ActionResult<Record<string, string | string[]>, ServerError>;
                    if (cpaResult.error) {
                        throw new Error(cpaResult.error.message);
                    }
                }
            }

            // Update state with successful results
            this.setState({
                user: updatedUser,
                emailField: updatedUser.email,
                originalCpaValues: {...this.state.customProfileAttributeValues}, // Update original values
                error: null,
                isSaving: false,
                isSaveNeeded: false,
            });

            // Refresh user data to ensure we have latest CPA values from server
            if (cpaChanged) {
                await this.props.getCustomProfileAttributeValues(this.state.user.id);
            }
        } catch (err) {
            console.error('SystemUserDetails-handleSubmit', err); // eslint-disable-line no-console

            this.setState({
                error: this.props.intl.formatMessage({id: 'admin.user_item.userUpdateFailed', defaultMessage: 'Failed to update user'}),
                isSaving: false,
            });
            return; // Don't unblock navigation on error
        }

        this.props.setNavigationBlocked(false);
    };

    /**
     * Modal close/open handlers
     */

    toggleOpenModalDeactivateMember = () => {
        if (this.state.user?.auth_service === Constants.LDAP_SERVICE) {
            return;
        }
        this.setState({showDeactivateMemberModal: true});
    };

    toggleCloseModalDeactivateMember = () => {
        this.setState({showDeactivateMemberModal: false});
    };

    toggleOpenModalResetPassword = () => {
        this.props.openModal({
            modalId: ModalIdentifiers.RESET_PASSWORD_MODAL,
            dialogType: ResetPasswordModal,
            dialogProps: {user: this.state.user},
        });
    };

    toggleCloseModalResetPassword = () => {
        this.setState({showResetPasswordModal: false});
    };

    toggleOpenTeamSelectorModal = () => {
        this.setState({showTeamSelectorModal: true});
    };

    toggleCloseTeamSelectorModal = () => {
        this.setState({showTeamSelectorModal: false});
    };

    openConfirmEditUserSettingsModal = () => {
        if (!this.state.user) {
            return;
        }

        this.props.openModal({
            modalId: ModalIdentifiers.CONFIRM_MANAGE_USER_SETTINGS_MODAL,
            dialogType: ConfirmManageUserSettingsModal,
            dialogProps: {
                user: this.state.user,
                onConfirm: this.openUserSettingsModal,
                focusOriginElement: 'manageUserSettingsBtn',
            },
        });
    };

    openUserSettingsModal = async () => {
        if (!this.state.user) {
            return;
        }

        this.props.openModal({
            modalId: ModalIdentifiers.USER_SETTINGS,
            dialogType: UserSettingsModal,
            dialogProps: {
                adminMode: true,
                isContentProductSettings: true,
                userID: this.state.user.id,
                focusOriginElement: 'manageUserSettingsBtn',
            },
        });
    };

    getManagedByLdapText = () => {
        if (this.state.user?.auth_service !== Constants.LDAP_SERVICE) {
            return null;
        }
        return (
            <>
                {' '}
                <FormattedMessage
                    id='admin.user_item.managedByLdap'
                    defaultMessage='(Managed By LDAP)'
                />
            </>
        );
    };

    render() {
        return (
            <div className='SystemUserDetail wrapper--fixed'>
                <AdminHeader withBackButton={true}>
                    <div>
                        <BlockableLink
                            to='/admin_console/user_management/users'
                            className='fa fa-angle-left back'
                        />
                        <FormattedMessage
                            id='admin.systemUserDetail.title'
                            defaultMessage='User Configuration'
                        />
                    </div>
                </AdminHeader>
                <div className='admin-console__wrapper'>
                    <div className='admin-console__content'>

                        {/* User details */}
                        <AdminUserCard
                            user={this.state.user}
                            isLoading={this.state.isLoading}
                            body={
                                <>
                                    <span>{this.state.user?.position ?? ''}</span>
                                    {this.renderTwoColumnLayout()}
                                    {Boolean(this.state.user?.auth_data && this.state.user?.auth_service) && (
                                        <label className='auth-data-field'>
                                            <FormattedMessage
                                                id='admin.userManagement.userDetail.authData'
                                                defaultMessage='Auth Data'
                                            />
                                            <SheidOutlineIcon/>
                                            <span>{this.state.user?.auth_data}</span>
                                        </label>
                                    )}
                                </>
                            }
                            footer={
                                <>
                                    <button
                                        className='btn btn-secondary'
                                        onClick={this.toggleOpenModalResetPassword}
                                    >
                                        <FormattedMessage
                                            id='admin.user_item.resetPwd'
                                            defaultMessage='Reset Password'
                                        />
                                    </button>
                                    {this.state.user?.mfa_active && (
                                        <button
                                            className='btn btn-secondary'
                                            onClick={this.handleRemoveMFA}
                                        >
                                            <FormattedMessage
                                                id='admin.user_item.resetMfa'
                                                defaultMessage='Remove MFA'
                                            />
                                        </button>
                                    )}
                                    {this.state.user?.delete_at !== 0 && (
                                        <button
                                            className='btn btn-secondary'
                                            onClick={this.handleActivateUser}
                                            disabled={this.state.user?.auth_service === Constants.LDAP_SERVICE}
                                        >
                                            <FormattedMessage
                                                id='admin.user_item.makeActive'
                                                defaultMessage='Activate'
                                            />
                                            {this.getManagedByLdapText()}
                                        </button>
                                    )}
                                    {this.state.user?.delete_at === 0 && (
                                        <button
                                            className='btn btn-secondary btn-danger'
                                            onClick={this.toggleOpenModalDeactivateMember}
                                            disabled={this.state.user?.auth_service === Constants.LDAP_SERVICE}
                                        >
                                            <FormattedMessage
                                                id='admin.user_item.deactivate'
                                                defaultMessage='Deactivate'
                                            />
                                            {this.getManagedByLdapText()}
                                        </button>
                                    )}

                                    {
                                        this.props.showManageUserSettings &&
                                        <button
                                            className='manageUserSettingsBtn btn btn-tertiary'
                                            onClick={this.openConfirmEditUserSettingsModal}
                                            id='manageUserSettingsBtn'
                                        >
                                            <FormattedMessage
                                                id='admin.user_item.manageSettings'
                                                defaultMessage='Manage User Settings'
                                            />
                                        </button>
                                    }

                                    {
                                        this.props.showLockedManageUserSettings &&
                                        <WithTooltip
                                            title={defineMessage({
                                                id: 'generic.enterprise_feature',
                                                defaultMessage: 'Enterprise feature',
                                            })}
                                            hint={defineMessage({
                                                id: 'admin.user_item.manageSettings.disabled_tooltip',
                                                defaultMessage: 'Please upgrade to Enterprise to manage user settings',
                                            })}
                                        >
                                            <button
                                                className='manageUserSettingsBtn btn disabled'
                                            >
                                                <div className='RestrictedIndicator__content'>
                                                    <i className={classNames('RestrictedIndicator__icon-tooltip', 'icon', 'icon-key-variant')}/>
                                                </div>
                                                <FormattedMessage
                                                    id='admin.user_item.manageSettings'
                                                    defaultMessage='Manage User Settings'
                                                />
                                            </button>
                                        </WithTooltip>
                                    }
                                </>
                            }
                        />

                        {/* User's team details */}
                        <AdminPanel
                            title={defineMessage({
                                id: 'admin.userManagement.userDetail.teamsTitle',
                                defaultMessage: 'Team Membership',
                            })}
                            subtitle={defineMessage({
                                id: 'admin.userManagement.userDetail.teamsSubtitle',
                                defaultMessage: 'Teams to which this user belongs',
                            })}
                            button={
                                <div className='add-team-button'>
                                    <button
                                        type='button'
                                        className='btn btn-primary'
                                        onClick={this.toggleOpenTeamSelectorModal}
                                        disabled={this.state.isLoading || this.state.error !== null}
                                    >
                                        <FormattedMessage
                                            id='admin.userManagement.userDetail.addTeam'
                                            defaultMessage='Add Team'
                                        />
                                    </button>
                                </div>
                            }
                        >
                            {this.state.isLoading && (
                                <div className='teamlistLoading'>
                                    <LoadingSpinner/>
                                </div>
                            )}
                            {!this.state.isLoading && this.state.user?.id && (
                                <TeamList
                                    userId={this.state.user.id}
                                    userDetailCallback={this.handleTeamsLoaded}
                                    refreshTeams={this.state.refreshTeams}
                                />
                            )}
                        </AdminPanel>
                    </div>
                </div>

                {/* Footer */}
                <div className='admin-console-save'>
                    <div className='admin-console-save-buttons'>
                        <SaveButton
                            saving={this.state.isSaving}
                            disabled={!this.state.isSaveNeeded || this.state.isLoading || this.state.isSaving}
                            onClick={this.handleSubmit}
                        />
                        {this.state.isSaveNeeded && (
                            <button
                                type='button'
                                className='btn btn-tertiary'
                                onClick={this.handleCancel}
                                disabled={this.state.isSaving}
                                style={{marginLeft: '12px'}}
                            >
                                <FormattedMessage
                                    id='admin.user_item.cancel'
                                    defaultMessage='Cancel'
                                />
                            </button>
                        )}
                    </div>
                    <div className='error-message'>
                        <FormError error={this.state.error}/>
                    </div>
                </div>
                {/* mounting of Modals */}
                <ConfirmModal
                    show={this.state.showDeactivateMemberModal}
                    title={
                        <FormattedMessage
                            id='deactivate_member_modal.title'
                            defaultMessage='Deactivate {username}'
                            values={{
                                username: this.state.user?.username ?? '',
                            }}
                        />
                    }
                    message={
                        <div>
                            <FormattedMessage
                                id='deactivate_member_modal.desc'
                                defaultMessage='This action deactivates {username}. They will be logged out and not have access to any teams or channels on this system. Are you sure you want to deactivate {username}?'
                                values={{
                                    username: this.state.user?.username ?? '',
                                }}
                            />
                            {this.state.user?.auth_service !== '' && this.state.user?.auth_service !== Constants.EMAIL_SERVICE && (
                                <strong>
                                    <br/>
                                    <br/>
                                    <FormattedMessage
                                        id='deactivate_member_modal.sso_warning'
                                        defaultMessage='You must also deactivate this user in the SSO provider or they will be reactivated on next login or sync.'
                                    />
                                </strong>
                            )}
                        </div>
                    }
                    confirmButtonClass='btn btn-danger'
                    confirmButtonText={
                        <FormattedMessage
                            id='deactivate_member_modal.deactivate'
                            defaultMessage='Deactivate'
                        />
                    }
                    onConfirm={this.handleDeactivateMember}
                    onCancel={this.toggleCloseModalDeactivateMember}
                />

                {this.state.showTeamSelectorModal && (
                    <TeamSelectorModal
                        onModalDismissed={this.toggleCloseTeamSelectorModal}
                        onTeamsSelected={this.handleAddUserToTeams}
                        alreadySelected={this.state.teamIds}
                        excludeGroupConstrained={true}
                    />
                )}
            </div>
        );
    }
}

export default injectIntl(SystemUserDetail);

export function getUserAuthenticationTextField(intl: IntlShape, mfaEnabled: Props['mfaEnabled'], user?: UserProfile): string {
    if (!user) {
        return '';
    }

    let authenticationTextField;

    if (user.auth_service) {
        let service;
        if (user.auth_service === Constants.LDAP_SERVICE || user.auth_service === Constants.SAML_SERVICE) {
            service = user.auth_service.toUpperCase();
        } else if (user.auth_service === Constants.OFFICE365_SERVICE) {
            // override service name office365 to text Entra ID
            service = intl.formatMessage({
                id: 'admin.oauth.office365',
                defaultMessage: 'Entra ID',
            });
        } else {
            service = toTitleCase(user.auth_service);
        }
        authenticationTextField = service;
    } else {
        authenticationTextField = intl.formatMessage({
            id: 'admin.userManagement.userDetail.email',
            defaultMessage: 'Email',
        });
    }

    if (mfaEnabled) {
        if (user.mfa_active) {
            authenticationTextField += intl.formatMessage({
                id: 'admin.userManagement.userDetail.separator',
                defaultMessage: ', ',
            });
            authenticationTextField += intl.formatMessage({id: 'admin.userManagement.userDetail.mfa', defaultMessage: 'MFA'});
        }
    }

    return authenticationTextField;
}
