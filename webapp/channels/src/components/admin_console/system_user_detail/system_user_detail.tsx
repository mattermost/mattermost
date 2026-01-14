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
import EmailIcon from 'components/widgets/icons/email_icon';
import ShieldOutlineIcon from 'components/widgets/icons/shield_outline_icon';
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
    usernameField: string;
    usernameError: string | null;
    emailField: string;
    emailError: string | null;
    authDataField: string;
    authDataError: string | null;
    confirmPassword: string;
    confirmPasswordError: string | null;
    customProfileAttributeFields: UserPropertyField[];
    customProfileAttributeValues: Record<string, string | string[]>;
    customProfileAttributeErrors: Record<string, string | undefined>;
    originalCpaValues: Record<string, string | string[]>;
    isLoading: boolean;
    error: string | null;
    isSaving: boolean;
    teams: TeamMembership[];
    teamIds: Array<Team['id']>;
    refreshTeams: boolean;
    showResetPasswordModal: boolean;
    showDeactivateMemberModal: boolean;
    showTeamSelectorModal: boolean;
    showSaveConfirmationModal: boolean;
};

export class SystemUserDetail extends PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            usernameField: '',
            usernameError: null,
            emailField: '',
            emailError: null,
            authDataField: '',
            authDataError: null,
            confirmPassword: '',
            confirmPasswordError: null,
            customProfileAttributeFields: [],
            customProfileAttributeValues: {},
            customProfileAttributeErrors: {},
            originalCpaValues: {},
            isLoading: false,
            error: null,
            isSaving: false,
            teams: [],
            teamIds: [],
            refreshTeams: true,
            showResetPasswordModal: false,
            showDeactivateMemberModal: false,
            showTeamSelectorModal: false,
            showSaveConfirmationModal: false,
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
                    usernameField: userResult.data.username,
                    authDataField: userResult.data.auth_data || '',
                    customProfileAttributeValues: cpaValues,
                    originalCpaValues: {...cpaValues}, // Deep copy for change tracking
                    isLoading: false,
                    emailError: null,
                    usernameError: null,
                });
            } else {
                throw new Error(userResult.error ? userResult.error.message : this.props.intl.formatMessage({id: 'admin.user_item.unknownError', defaultMessage: 'Unknown error'}));
            }
        } catch (error) {
            console.error('SystemUserDetails-getUser: ', error); // eslint-disable-line no-console

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

    componentDidUpdate(prevProps: Props, prevState: State) {
        // Update navigation blocking whenever relevant state changes
        const hasChanges = this.hasUnsavedChanges();
        const hadChanges = this.hasUnsavedChanges(prevState);

        if (hasChanges !== hadChanges) {
            this.props.setNavigationBlocked(hasChanges);
        }
    }

    private hasUnsavedChanges = (state: State = this.state): boolean => {
        if (!state.user) {
            return false;
        }

        const emailChanged = state.emailField !== state.user.email;
        const usernameChanged = state.usernameField !== state.user.username;
        const authDataChanged = state.authDataField !== (state.user.auth_data || '');
        const cpaChanged = this.hasCpaChanges(state);

        return emailChanged || usernameChanged || authDataChanged || cpaChanged;
    };

    private hasCpaChanges = (state: State = this.state): boolean => {
        const {customProfileAttributeFields} = this.props;
        for (const field of customProfileAttributeFields) {
            const currentValue = state.customProfileAttributeValues[field.id];
            const originalValue = state.originalCpaValues[field.id];

            if (this.isCpaValueChanged(currentValue, originalValue)) {
                return true;
            }
        }
        return false;
    };

    private isEditingOwnEmail = (state: State = this.state): boolean => {
        return Boolean(
            state.user &&
            this.props.currentUserId === state.user.id &&
            state.emailField !== state.user.email,
        );
    };

    private isCpaValueChanged = (currentValue: string | string[] | undefined, originalValue: string | string[] | undefined): boolean => {
        if (Array.isArray(currentValue) && Array.isArray(originalValue)) {
            return currentValue.length !== originalValue.length ||
                   currentValue.some((val, idx) => val !== originalValue[idx]);
        }
        return currentValue !== originalValue;
    };

    // Resolves option IDs to display names for select/multiselect CPA fields.
    private resolveOptionNames = (field: UserPropertyField, value: string | string[] | undefined): string => {
        if (!value) {
            return '(empty)';
        }

        const options = field.attrs?.options || [];
        if (field.type === 'select' || field.type === 'multiselect') {
            if (!Array.isArray(value)) {
                // Select: resolve single ID to its name
                const option = options.find((opt) => opt.id === value);
                return option ? option.name : value;
            }

            // Multiselect: resolve each ID to its name
            if (value.length === 0) {
                return '(empty)';
            }

            const names = value.map((id) => {
                const option = options.find((opt) => opt.id === id);
                return option ? option.name : id;
            });
            return names.join(this.props.intl.formatMessage({id: 'admin.userManagement.userDetail.arrayValueSeparator', defaultMessage: ', '}));
        }

        // For non-select fields, display as-is
        return Array.isArray(value) ? value.join(this.props.intl.formatMessage({id: 'admin.userManagement.userDetail.arrayValueSeparator', defaultMessage: ', '})) : value;
    };

    handleTeamsLoaded = (teams: TeamMembership[]) => {
        const teamIds = teams.map((team) => team.team_id);
        this.setState({
            teams,
            teamIds,
            refreshTeams: false,
        });
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
            const {error} = await this.props.updateUserActive(this.state.user.id, true);
            if (error) {
                throw new Error(error.message);
            }

            await this.getUser(this.state.user.id);
        } catch (err) {
            console.error('SystemUserDetails-handleActivateUser', err); // eslint-disable-line no-console

            // Show the actual server error message instead of generic message
            const errorMessage = err instanceof Error ? err.message : this.props.intl.formatMessage({id: 'admin.user_item.userActivateFailed', defaultMessage: 'Failed to activate user'});
            this.setState({error: errorMessage});
        }
    };

    handleDeactivateMember = async () => {
        if (!this.state.user) {
            return;
        }

        try {
            const {error} = await this.props.updateUserActive(this.state.user.id, false);
            if (error) {
                throw new Error(error.message);
            }

            await this.getUser(this.state.user.id);
        } catch (err) {
            console.error('SystemUserDetails-handleDeactivateMember', err); // eslint-disable-line no-console

            // Show the actual server error message instead of generic message
            const errorMessage = err instanceof Error ? err.message : this.props.intl.formatMessage({id: 'admin.user_item.userDeactivateFailed', defaultMessage: 'Failed to deactivate user'});
            this.setState({error: errorMessage});
        }

        this.toggleCloseModalDeactivateMember();
    };

    handleRemoveMFA = async () => {
        if (!this.state.user) {
            return;
        }

        try {
            const {error} = await this.props.updateUserMfa(this.state.user.id, false);
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
        if (!this.state.user || this.state.user.auth_service) {
            return;
        }

        const {target: {value}} = event;

        // Validate email
        let emailError = null;
        if (!value.trim()) {
            emailError = this.props.intl.formatMessage({id: 'admin.user_item.emptyEmail', defaultMessage: 'Email cannot be empty'});
        } else if (!isEmail(value)) {
            emailError = this.props.intl.formatMessage({id: 'admin.user_item.invalidEmail', defaultMessage: 'Invalid email address'});
        }

        this.setState({
            emailField: value,
            emailError,
            error: null, // Clear any errors when user starts editing
        });
    };

    handleCpaValueChange = (fieldId: string, value: string | string[]) => {
        // Validate CPA values if changed
        let cpaError;
        const field = this.props.customProfileAttributeFields.find((f) => f.id === fieldId);

        if (field) {
            const valueType = field.attrs?.value_type;
            const originalValue = this.state.originalCpaValues[fieldId];
            if (valueType && value !== originalValue) {
                if (valueType === 'email') {
                    const stringValue = String(value);
                    if (!isEmail(stringValue)) {
                        cpaError = this.props.intl.formatMessage({id: 'admin.user_item.invalidEmail', defaultMessage: 'Invalid email address'});
                    }
                } else if (valueType === 'url') {
                    const stringValue = String(value);
                    if (validHttpUrl(stringValue) === null) {
                        cpaError = this.props.intl.formatMessage({id: 'admin.user_item.invalidUrl', defaultMessage: 'Invalid URL'});
                    }
                }
            }
        }

        this.setState({
            customProfileAttributeValues: {
                ...this.state.customProfileAttributeValues,
                [fieldId]: value,
            },
            customProfileAttributeErrors: {
                ...this.state.customProfileAttributeErrors,
                [fieldId]: cpaError,
            },
            error: null, // Clear any errors when user starts editing
        });
    };

    handleUsernameChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (!this.state.user || this.state.user.auth_service) {
            return;
        }

        const {target: {value}} = event;

        // Validate username
        let usernameError = null;
        if (!value.trim()) {
            usernameError = this.props.intl.formatMessage({id: 'admin.user_item.invalidUsername', defaultMessage: 'Username cannot be empty'});
        }

        this.setState({
            usernameField: value,
            usernameError,
        });
    };

    handleAuthDataChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (!this.state.user) {
            return;
        }

        const {target: {value}} = event;

        // Validate auth data
        let authDataError = null;
        if (!value.trim()) {
            authDataError = this.props.intl.formatMessage({id: 'admin.user_item.invalidAuthData', defaultMessage: 'Auth Data cannot be empty'});
        } else if (value.length > 128) {
            authDataError = this.props.intl.formatMessage({id: 'admin.user_item.authDataTooLong', defaultMessage: 'Auth Data must be 128 characters or less'});
        }

        this.setState({
            authDataField: value,
            authDataError,
        });
    };

    getChangedCpaFields = (): Record<string, string | string[]> => {
        const res: Record<string, string | string[]> = {};
        const {customProfileAttributeFields} = this.props;
        for (const field of customProfileAttributeFields) {
            const currentValue = this.state.customProfileAttributeValues[field.id];
            const originalValue = this.state.originalCpaValues[field.id];

            if (this.isCpaValueChanged(currentValue, originalValue)) {
                res[field.id] = currentValue || '';
            }
        }
        return res;
    };

    renderCpaField = (field: UserPropertyField, error: string | undefined) => {
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

            // Only text elements can have errors
            case 'text':
            default: {
                const inputType = getInputTypeFromValueType(field.attrs?.value_type);

                return (
                    <>
                        <input
                            className={classNames('form-control', {
                                error,
                            })}
                            type={inputType}
                            value={Array.isArray(value) ? value.join(this.props.intl.formatMessage({id: 'admin.userManagement.userDetail.arrayValueSeparator', defaultMessage: ', '})) : value}
                            onChange={(e) => this.handleCpaValueChange(field.id, e.target.value)}
                            disabled={isDisabled}
                            aria-describedby={field.id + '-error'}
                            aria-invalid={error ? 'true' : 'false'}
                        />
                        {error && (
                            <div
                                id={field.id + '-error'}
                                className='field-error'
                                role='alert'
                                aria-live='polite'
                            >
                                {error}
                            </div>
                        )}
                    </>
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
        const fields: Array<React.ReactNode | null> = [];

        // Add system fields
        fields.push(
            <label key='username'>
                <FormattedMessage
                    id='admin.userManagement.userDetail.username'
                    defaultMessage='Username'
                />
                <AtIcon/>
                {this.state.user?.auth_service ? (
                    <WithTooltip
                        title={this.props.intl.formatMessage({
                            id: 'admin.userManagement.userDetail.managedByProvider.title',
                            defaultMessage: 'Managed by login provider',
                        })}
                        hint={this.props.intl.formatMessage({
                            id: 'admin.userManagement.userDetail.managedByProvider.username',
                            defaultMessage: 'This username is managed by the {authService} login provider and cannot be changed here.',
                        }, {
                            authService: this.state.user.auth_service.toUpperCase(),
                        })}
                    >
                        <input
                            className='form-control'
                            type='text'
                            value={this.state.usernameField}
                            disabled={true}
                            readOnly={true}
                            style={{cursor: 'not-allowed'}}
                            placeholder={this.props.intl.formatMessage({
                                id: 'admin.userManagement.userDetail.username.input',
                                defaultMessage: 'Enter username',
                            })}
                        />
                    </WithTooltip>
                ) : (
                    <>
                        <input
                            className={classNames('form-control', {
                                error: this.state.usernameError,
                            })}
                            type='text'
                            value={this.state.usernameField}
                            onChange={this.handleUsernameChange}
                            disabled={this.state.isSaving}
                            placeholder={this.props.intl.formatMessage({
                                id: 'admin.userManagement.userDetail.username.input',
                                defaultMessage: 'Enter username',
                            })}
                            aria-describedby='username-error'
                            aria-invalid={this.state.usernameError ? 'true' : 'false'}
                        />
                        {this.state.usernameError && (
                            <div
                                id='username-error'
                                className='field-error'
                                role='alert'
                                aria-live='polite'
                            >
                                {this.state.usernameError}
                            </div>
                        )}
                    </>
                )}
            </label>,
        );

        fields.push(
            <label key='email'>
                <FormattedMessage
                    id='admin.userManagement.userDetail.email'
                    defaultMessage='Email'
                />
                <EmailIcon/>
                {this.state.user?.auth_service ? (
                    <WithTooltip
                        title={this.props.intl.formatMessage({
                            id: 'admin.userManagement.userDetail.managedByProvider.title',
                            defaultMessage: 'Managed by login provider',
                        })}
                        hint={this.props.intl.formatMessage({
                            id: 'admin.userManagement.userDetail.managedByProvider.email',
                            defaultMessage: 'This email is managed by the {authService} login provider and cannot be changed here.',
                        }, {
                            authService: this.state.user.auth_service.toUpperCase(),
                        })}
                    >
                        <input
                            className='form-control'
                            type='text'
                            value={this.state.emailField}
                            disabled={true}
                            readOnly={true}
                            style={{cursor: 'not-allowed'}}
                        />
                    </WithTooltip>
                ) : (
                    <>
                        <input
                            className={classNames('form-control', {
                                error: this.state.emailError,
                            })}
                            type='text'
                            value={this.state.emailField}
                            onChange={this.handleEmailChange}
                            disabled={this.state.isSaving}
                            aria-describedby='email-error'
                            aria-invalid={this.state.emailError ? 'true' : 'false'}
                        />
                        {this.state.emailError && (
                            <div
                                id='email-error'
                                className='field-error'
                                role='alert'
                                aria-live='polite'
                            >
                                {this.state.emailError}
                            </div>
                        )}
                    </>
                )}
            </label>,
        );

        fields.push(
            <label key='authMethod'>
                <FormattedMessage
                    id='admin.userManagement.userDetail.authenticationMethod'
                    defaultMessage='Authentication Method'
                />
                <ShieldOutlineIcon/>
                <span>{getUserAuthenticationTextField(this.props.intl, this.props.mfaEnabled, this.state.user)}</span>
            </label>,
        );

        if (this.state.user?.auth_service) {
            fields.push(
                <label key='authData'>
                    <FormattedMessage
                        id='admin.userManagement.userDetail.authData'
                        defaultMessage='Auth Data'
                    />
                    <ShieldOutlineIcon/>
                    <input
                        className={classNames('form-control', {
                            error: this.state.authDataError,
                        })}
                        type='text'
                        value={this.state.authDataField}
                        onChange={this.handleAuthDataChange}
                        disabled={this.state.isSaving}
                        placeholder={this.props.intl.formatMessage({
                            id: 'admin.userManagement.userDetail.authData.input',
                            defaultMessage: 'Enter auth data',
                        })}
                        aria-describedby='authdata-error'
                        aria-invalid={this.state.authDataError ? 'true' : 'false'}
                    />
                    {this.state.authDataError && (
                        <div
                            id='authdata-error'
                            className='field-error'
                            role='alert'
                            aria-live='polite'
                        >
                            {this.state.authDataError}
                        </div>
                    )}
                </label>,
            );
        }

        // Add CPA fields
        const sortedCpaFields = [...this.props.customProfileAttributeFields].
            sort((a, b) => (a.attrs?.sort_order || 0) - (b.attrs?.sort_order || 0));

        const cpaErrors = this.state.customProfileAttributeErrors;
        for (const field of sortedCpaFields) {
            fields.push(this.renderCpaField(field, cpaErrors[field.id]));
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

    handleConfirmPasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
        const {target: {value}} = event;
        this.setState({
            confirmPassword: value,
            confirmPasswordError: null,
        });
    };

    renderConfirmModal = () => {
        const fields: Array<React.ReactNode | null> = [];
        const isEditingOwnEmail = this.isEditingOwnEmail();

        if (this.state.user && this.state.usernameField !== this.state.user.username) {
            fields.push(
                <FormattedMessage
                    id='admin.userDetail.saveChangesModal.usernameChange'
                    defaultMessage='Username: {oldUsername} → {newUsername}'
                    values={{
                        oldUsername: this.state.user.username,
                        newUsername: this.state.usernameField,
                    }}
                />,
            );
        }

        if (this.state.user && this.state.emailField !== this.state.user.email) {
            fields.push(
                <FormattedMessage
                    id='admin.userDetail.saveChangesModal.emailChange'
                    defaultMessage='Email: {oldEmail} → {newEmail}'
                    values={{
                        oldEmail: this.state.user.email,
                        newEmail: this.state.emailField,
                    }}
                />,
            );
        }

        if (this.state.user && this.state.authDataField !== (this.state.user.auth_data || '')) {
            fields.push(
                <FormattedMessage
                    id='admin.userDetail.saveChangesModal.authDataChange'
                    defaultMessage='Auth Data: {oldAuthData} → {newAuthData}'
                    values={{
                        oldAuthData: this.state.user.auth_data || '(empty)',
                        newAuthData: this.state.authDataField || '(empty)',
                    }}
                />,
            );
        }

        for (const changes of Object.entries(this.getChangedCpaFields())) {
            const fieldId = changes[0];

            for (const field of this.props.customProfileAttributeFields) {
                if (field.id === fieldId) {
                    const fieldName = field.name;
                    const originalValue = this.state.originalCpaValues[fieldId];

                    const oldValue = this.resolveOptionNames(field, originalValue);
                    const newValue = this.resolveOptionNames(field, changes[1]);

                    fields.push(
                        <FormattedMessage
                            id='admin.userDetail.saveChangesModal.cpaFieldChange'
                            defaultMessage='{fieldName}: {oldValue} → {newValue}'
                            values={{
                                fieldName,
                                oldValue,
                                newValue,
                            }}
                        />,
                    );
                }
            }
        }

        return (
            <div>
                <FormattedMessage
                    id='admin.userDetail.saveChangesModal.message'
                    defaultMessage='You are about to save the following changes to {username}:'
                    values={{
                        username: this.state.user?.username ?? '',
                    }}
                />
                <ul className='changes-list'>
                    {fields.map((field, index) => {
                        return (
                            <li key={index}>
                                {field}
                            </li>
                        );
                    })}
                </ul>
                {isEditingOwnEmail && (
                    <div className='password-confirmation-section'>
                        <FormattedMessage
                            id='admin.userDetail.saveChangesModal.passwordRequired'
                            defaultMessage='For security reasons, please confirm your current password to change your email address:'
                        />
                        <div className='password-input-wrapper'>
                            <input
                                type='password'
                                className={classNames('form-control', {
                                    error: this.state.confirmPasswordError,
                                })}
                                value={this.state.confirmPassword}
                                onChange={this.handleConfirmPasswordChange}
                                placeholder={this.props.intl.formatMessage({
                                    id: 'admin.userDetail.saveChangesModal.passwordPlaceholder',
                                    defaultMessage: 'Enter your password',
                                })}
                                aria-describedby='confirm-password-error'
                                aria-invalid={this.state.confirmPasswordError ? 'true' : 'false'}
                                autoFocus={true}
                            />
                            {this.state.confirmPasswordError && (
                                <div
                                    id='confirm-password-error'
                                    className='field-error'
                                    role='alert'
                                    aria-live='polite'
                                >
                                    {this.state.confirmPasswordError}
                                </div>
                            )}
                        </div>
                    </div>
                )}
                <FormattedMessage
                    id='admin.userDetail.saveChangesModal.warning'
                    defaultMessage='Are you sure you want to proceed with these changes?'
                />
            </div>
        );
    };

    handleCancel = () => {
        // Reset all fields to original values
        this.setState({
            usernameField: this.state?.user?.username || '',
            usernameError: null,
            emailField: this.state.user?.email || '',
            emailError: null,
            authDataField: this.state.user?.auth_data || '',
            authDataError: null,
            customProfileAttributeValues: {...this.state.originalCpaValues},
            customProfileAttributeErrors: {},
            error: null, // Clear any errors when user starts editing
        });
    };

    handleSubmit = async (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();

        if (this.state.isLoading || this.state.isSaving || !this.state.user) {
            return;
        }

        // Check for validation errors before proceeding
        if (this.state.usernameError || this.state.emailError || this.state.authDataError) {
            return;
        }

        if (!this.hasUnsavedChanges()) {
            return;
        }

        // Show confirmation dialog first
        this.setState({showSaveConfirmationModal: true});
    };

    handleConfirmSave = async () => {
        if (!this.state.user) {
            return;
        }
        if (!this.hasUnsavedChanges()) {
            return;
        }
        if (this.state.isSaving) {
            return;
        }

        this.setState({
            error: null,
            isSaving: true,
            showSaveConfirmationModal: false,
        });

        try {
            const promises = [];

            let updatedUser: UserProfile = {...this.state.user};

            // Track what changes are being made
            const emailChanged = !this.state.user.auth_service && this.state.emailField !== this.state.user.email;
            const usernameChanged = !this.state.user.auth_service && this.state.usernameField !== this.state.user.username;
            const authDataChanged = this.state.authDataField !== (this.state.user.auth_data || '');
            const cpaChanged = this.hasCpaChanges();

            // Update user profile if email or username changed
            if (usernameChanged || emailChanged) {
                if (emailChanged) {
                    updatedUser.email = this.state.emailField.trim().toLowerCase();
                }

                if (usernameChanged) {
                    updatedUser.username = this.state.usernameField.trim();
                }

                // If editing own email, include password for verification
                if (this.isEditingOwnEmail()) {
                    if (!this.state.confirmPassword) {
                        this.setState({
                            confirmPasswordError: this.props.intl.formatMessage({
                                id: 'admin.userDetail.saveChangesModal.passwordRequired',
                                defaultMessage: 'Password is required to change your email address',
                            }),
                            isSaving: false,
                            showSaveConfirmationModal: true,
                        });
                        return;
                    }
                    updatedUser.password = this.state.confirmPassword;
                }

                promises.push(this.props.patchUser(updatedUser));
            }

            // Update auth_data if changed
            if (authDataChanged) {
                promises.push(this.props.updateUserAuth(this.state.user.id, {
                    auth_data: this.state.authDataField.trim(),
                    auth_service: this.state.user.auth_service,
                }));
            }

            // Update CPA values if changed
            for (const changes of Object.entries(this.getChangedCpaFields())) {
                promises.push(this.props.saveCustomProfileAttribute(this.state.user!.id, changes[0], changes[1] || ''));
            }

            // Execute all updates in parallel
            const results = await Promise.all(promises);

            // Handle results
            let resultIndex = 0;

            // Handle user update result if email or username changed
            if (emailChanged || usernameChanged) {
                const userResult = results[resultIndex] as ActionResult<UserProfile, ServerError>;
                if (userResult.data) {
                    updatedUser = userResult.data;
                } else if (userResult.error) {
                    // Check if error is related to password verification
                    if (this.isEditingOwnEmail() && (userResult.error.status_code === 400)) {
                        this.setState({
                            confirmPasswordError: this.props.intl.formatMessage({
                                id: 'admin.userDetail.saveChangesModal.incorrectPassword',
                                defaultMessage: 'Incorrect password. Please try again.',
                            }),
                            isSaving: false,
                            showSaveConfirmationModal: true,
                        });
                        return;
                    }
                    throw new Error(userResult.error.message);
                }
                resultIndex++;
            }

            // Handle auth_data update result
            if (authDataChanged) {
                const authResult = results[resultIndex] as ActionResult<{auth_data: string; auth_service: string}, ServerError>;
                if (authResult.data) {
                    // Update the user data with the new auth information
                    updatedUser = {
                        ...updatedUser,
                        auth_data: authResult.data.auth_data,
                        auth_service: authResult.data.auth_service || '',
                    };
                } else if (authResult.error) {
                    throw new Error(authResult.error.message);
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

            // Refresh CPA values from server to ensure we have the normalized/validated values
            let freshCpaValues = this.state.customProfileAttributeValues;
            if (cpaChanged) {
                const cpaResult = await this.props.getCustomProfileAttributeValues(this.state.user.id);
                freshCpaValues = (cpaResult as {data?: Record<string, string | string[]>}).data || this.state.customProfileAttributeValues;
            }

            // Update state with successful results
            this.setState({
                user: updatedUser,
                usernameField: updatedUser.username,
                usernameError: null,
                emailField: updatedUser.email,
                emailError: null,
                authDataField: updatedUser.auth_data || '',
                authDataError: null,
                customProfileAttributeValues: freshCpaValues,
                originalCpaValues: {...freshCpaValues},
                error: null,
                isSaving: false,
                confirmPassword: '',
                confirmPasswordError: null,
            });
        } catch (err) {
            console.error('SystemUserDetails-handleConfirmSave', err); // eslint-disable-line no-console

            this.setState({
                error: this.props.intl.formatMessage({id: 'admin.user_item.userUpdateFailed', defaultMessage: 'Failed to update user'}),
                isSaving: false,
            });
        }
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

    closeSaveConfirmationModal = () => {
        this.setState({
            showSaveConfirmationModal: false,
            confirmPassword: '',
            confirmPasswordError: null,
        });
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
                                </>
                            }
                            footer={
                                <>
                                    <WithTooltip
                                        title={defineMessage({
                                            id: 'admin.user_item.resetPassword.magicLink.tooltip',
                                            defaultMessage: 'Cannot reset password for Magic Link accounts.',
                                        })}
                                        disabled={this.state.user?.auth_service !== Constants.MAGIC_LINK_SERVICE}
                                    >
                                        <button
                                            className='btn btn-secondary'
                                            onClick={this.toggleOpenModalResetPassword}
                                            disabled={this.state.user?.auth_service === Constants.MAGIC_LINK_SERVICE}
                                        >
                                            <FormattedMessage
                                                id='admin.user_item.resetPwd'
                                                defaultMessage='Reset Password'
                                            />
                                        </button>
                                    </WithTooltip>
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
                                                defaultMessage: 'Enterprise Feature',
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
                                        disabled={this.state.isLoading}
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
                            disabled={!this.hasUnsavedChanges() || this.state.isLoading || this.state.isSaving ||
                                this.state.emailError !== null ||
                                this.state.usernameError !== null ||
                                this.state.authDataError !== null ||
                                Object.values(this.state.customProfileAttributeErrors).some((error) => error !== undefined)
                            }
                            onClick={this.handleSubmit}
                        />
                        {this.hasUnsavedChanges() && (
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
                    <div
                        className='error-message'
                        role='alert'
                        aria-live='polite'
                    >
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
                                id='deactivate_member_modal.desc_with_confirmation'
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

                <ConfirmModal
                    id='admin-userDetail-saveChangesModal'
                    show={this.state.showSaveConfirmationModal}
                    title={
                        <FormattedMessage
                            id='admin.userDetail.saveChangesModal.title'
                            defaultMessage='Confirm Changes'
                        />
                    }
                    message={
                        this.renderConfirmModal()
                    }
                    confirmButtonClass='btn btn-primary'
                    confirmButtonText={
                        <FormattedMessage
                            id='admin.userDetail.saveChangesModal.save'
                            defaultMessage='Save Changes'
                        />
                    }

                    // Disable if editing own email and password is empty
                    confirmDisabled={this.isEditingOwnEmail() && !this.state.confirmPassword}
                    onConfirm={this.handleConfirmSave}
                    onCancel={this.closeSaveConfirmationModal}
                />
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
        } else if (user.auth_service === Constants.MAGIC_LINK_SERVICE) {
            service = intl.formatMessage({
                id: 'admin.userManagement.userDetail.magicLink',
                defaultMessage: 'Magic Link',
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
