// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {RefObject} from 'react';
import {FormattedMessage} from 'react-intl';
import {components, FormatOptionLabelMeta, InputActionMeta, InputProps, OptionsType, Styles, ValueType} from 'react-select';
import AsyncCreatable from 'react-select/async-creatable';
import classNames from 'classnames';

import {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';
import {isEmail} from 'mattermost-redux/utils/helpers';
import {isGuest} from 'mattermost-redux/utils/user_utils';

import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import CloseCircleSolidIcon from 'components/widgets/icons/close_circle_solid_icon';
import MailIcon from 'components/widgets/icons/mail_icon';
import MailPlusIcon from 'components/widgets/icons/mail_plus_icon';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';
import Avatar from 'components/widgets/users/avatar';
import BotTag from 'components/widgets/tag/bot_tag';
import GuestTag from 'components/widgets/tag/guest_tag';

import {t} from 'utils/i18n';
import {getDisplayName, getLongDisplayNameParts, imageURLForUser} from 'utils/utils';

import './users_emails_input.scss';

type Props = {
    placeholder: string;
    ariaLabel: string;
    usersLoader: (search: string, callback: (users: UserProfile[]) => void) => Promise<UserProfile[]> | undefined;
    onUsersLoad?: (users: UserProfile[]) => void;
    onBlur?: () => void;
    onChange: (change: Array<UserProfile | string>) => void;
    showError?: boolean;
    errorMessageId: string;
    errorMessageDefault: string;
    errorMessageValues?: Record<string, React.ReactNode>;
    value: Array<UserProfile | string>;
    onInputChange: (change: string) => void;
    inputValue: string;
    noMatchMessageId?: string;
    noMatchMessageDefault?: string;
    validAddressMessageId?: string;
    validAddressMessageDefault?: string;
    loadingMessageId?: string;
    loadingMessageDefault?: string;
    emailInvitationsEnabled: boolean;
    extraErrorText?: React.ReactNode;
    autoFocus?: boolean;
    suppressNoOptionsMessage?: boolean;
    onPaste?: (e: ClipboardEvent) => void;
}

export type EmailInvite = {
    value: string;
    label: string;
}

type State = {
    options: UserProfile[];
}

const multipleValuesDelimiter = /[\s,;]+/;

export default class UsersEmailsInput extends React.PureComponent<Props, State> {
    static defaultProps = {
        noMatchMessageId: t('widgets.users_emails_input.no_user_found_matching'),
        noMatchMessageDefault: 'No one found matching **{text}**. Enter their email to invite them.',
        validAddressMessageId: t('widgets.users_emails_input.valid_email'),
        validAddressMessageDefault: 'Add **{email}**',
        loadingMessageId: t('widgets.users_emails_input.loading'),
        loadingMessageDefault: 'Loading',
        showError: false,
    };
    private selectRef: RefObject<AsyncCreatable<UserProfile | EmailInvite> & { handleInputChange: (newValue: string, actionMeta: InputActionMeta | { action: 'custom' }) => string }>;

    constructor(props: Props) {
        super(props);
        this.selectRef = React.createRef();
        this.state = {
            options: [],
        };
    }

    renderUserName = (user: UserProfile) => {
        const parts = getLongDisplayNameParts(user);
        let fullName = null;
        if (parts.fullName) {
            fullName = (<span className='fullname'>{parts.fullName}</span>);
        }
        let nickname = null;
        if (parts.nickname) {
            nickname = (<span className='nickname'>{parts.nickname}</span>);
        }

        return (
            <>
                {parts.displayName}
                {fullName}
                {nickname}
            </>
        );
    }

    loadingMessage = (): string => {
        const text = (
            <FormattedMessage
                id={this.props.loadingMessageId}
                defaultMessage={this.props.loadingMessageDefault}
            />
        );

        // faking types to satisfy the interface for the version of react-select we are on.
        return (<LoadingSpinner text={text}/>) as unknown as string;
    }

    getOptionValue = (obj: UserProfile | EmailInvite): string => {
        if (this.isUserProfile(obj)) {
            return obj.id;
        }
        return obj.value;
    }

    formatOptionLabel = (user: UserProfile | EmailInvite, options: FormatOptionLabelMeta<UserProfile | EmailInvite>) => {
        const profileImg = imageURLForUser((user as UserProfile).id, (user as UserProfile).last_picture_update);
        let guestBadge = null;
        let botBadge = null;

        if ((user as UserProfile).is_bot) {
            botBadge = <BotTag/>;
        }

        if (!isEmail((user as EmailInvite).value) && isGuest((user as UserProfile).roles)) {
            guestBadge = <GuestTag/>;
        }

        if (options.context === 'menu') {
            if ((user as EmailInvite).value && isEmail((user as EmailInvite).value)) {
                return this.getCreateLabel((user as EmailInvite).value);
            }
            return (
                <React.Fragment>
                    <Avatar
                        size='lg'
                        username={(user as UserProfile).username}
                        url={profileImg}
                    />
                    {this.renderUserName(user as UserProfile)}
                    {botBadge}
                    {guestBadge}
                </React.Fragment>
            );
        }

        if ((user as EmailInvite).value && isEmail((user as EmailInvite).value)) {
            return (
                <React.Fragment>
                    <MailIcon className='mail-icon'/>
                    <span>{(user as EmailInvite).value}</span>
                </React.Fragment>
            );
        }

        return (
            <React.Fragment>
                <Avatar
                    size='sm'
                    username={(user as UserProfile).username}
                    url={profileImg}
                />
                {getDisplayName(user as UserProfile)}
                {botBadge}
                {guestBadge}
            </React.Fragment>
        );
    }

    onChange = (value: ValueType<UserProfile | EmailInvite>) => {
        if (this.props.onChange) {
            if (value) {
                this.props.onChange((value as Array<UserProfile | EmailInvite>).map((v) => {
                    if (this.isUserProfile(v)) {
                        return v;
                    }
                    return v.value;
                }));
            } else {
                this.props.onChange([]);
            }
        }
    }

    getCreateLabel = (value: string) => (
        <React.Fragment>
            <MailPlusIcon className='mail-plus-icon'/>
            <FormattedMarkdownMessage
                key='widgets.users_emails_input.valid_email'
                id={this.props.validAddressMessageId}
                defaultMessage={this.props.validAddressMessageDefault}
                values={{email: value}}
                disableLinks={true}
            />
        </React.Fragment>
    );

    Input = (props: InputProps) => {
        const handlePaste = (e: ClipboardEvent) => {
            e.preventDefault();
            const clipboardText = e.clipboardData?.getData('Text') || '';
            this.appendDelimitedValues(clipboardText);

            if (this.props.onPaste) {
                this.props.onPaste(e);
            }
        };

        return (
            <components.Input
                {...props}

                // The onPaste is not part of the InputProps type definition. It's fixed in v5 of react-select.
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore - The type definition for the Input component is incorrect.
                onPaste={handlePaste}
            />
        );
    };

    NoOptionsMessage = (props: Record<string, any>) => {
        const inputValue = props.selectProps.inputValue;
        if (!inputValue) {
            return null;
        }

        const Msg: any = components.NoOptionsMessage;
        return (
            <div className='users-emails-input__option users-emails-input__option--no-matches'>
                <Msg {...props}>
                    <FormattedMarkdownMessage
                        id={this.props.noMatchMessageId}
                        defaultMessage={this.props.noMatchMessageDefault}
                        values={{text: inputValue}}
                        disableLinks={true}
                    />
                </Msg>
            </div>
        );
    };

    MultiValueRemove = ({children, innerProps}: {children: React.ReactNode | React.ReactNodeArray; innerProps: Record<string, any>}) => (
        <div {...innerProps}>
            {children || <CloseCircleSolidIcon/>}
        </div>
    );

    components = {
        NoOptionsMessage: this.props.suppressNoOptionsMessage ? () => null : this.NoOptionsMessage,
        MultiValueRemove: this.MultiValueRemove,
        IndicatorsContainer: () => null,
        Input: this.Input,
    };

    handleInputChange = async (inputValue: string, action: InputActionMeta) => {
        if (action.action === 'input-blur' && inputValue !== '') {
            const values = this.formatValuesForCreatable();

            // Check if the input is an existing user by username or email.
            const option = this.state.options.find((o) =>
                this.props.inputValue === o.username || this.props.inputValue === ('@' + o.username) ||
                this.props.inputValue === o.email,
            );

            if (option) {
                this.onChange([...values, option]);
                this.props.onInputChange('');
                return;
            }

            // Check if the input is a valid new email, if the email invitations are enabled.
            if (this.props.emailInvitationsEnabled && isEmail(this.props.inputValue)) {
                const email = this.props.inputValue;
                this.onChange([...values, {value: email, label: email}]);
                this.props.onInputChange('');
            }
        } else if (action.action === 'input-change' && inputValue !== '' && inputValue?.[inputValue.length - 1].match(multipleValuesDelimiter)) {
            const newValuesCount = await this.appendDelimitedValues(inputValue);
            if (newValuesCount === 0) {
                return;
            }
        }
        if (action.action !== 'input-blur' && action.action !== 'menu-close') {
            this.props.onInputChange(inputValue);
        }
    }

    formatValuesForCreatable = () => {
        return this.props.value.map((v) => {
            if ((v as UserProfile).id) {
                return v as UserProfile;
            }
            return {label: v, value: v} as EmailInvite;
        });
    }

    optionsLoader = (_input: string, callback: (options: UserProfile[]) => void) => {
        const customCallback = (options: UserProfile[]) => {
            this.setState({options});
            const accessibleProfiles = options.map((user: UserProfile) => ({...user, label: user.username}));
            callback(accessibleProfiles);
            if (this.props.onUsersLoad) {
                this.props.onUsersLoad(options);
            }
        };
        const result = this.props.usersLoader(this.props.inputValue, customCallback);
        if (result && result.then) {
            result.then(customCallback);
        }
    }

    showAddEmail = (inputValue: string, value: ValueType<UserProfile | EmailInvite>, options: OptionsType<UserProfile | EmailInvite>): boolean => {
        return this.props.emailInvitationsEnabled && options.length === 0 && isEmail(inputValue);
    }

    onFocus = () => {
        this.selectRef.current?.handleInputChange(this.props.inputValue, {action: 'custom'});
    }

    onBlur = () => {
        this.selectRef.current?.handleInputChange(this.props.inputValue, {action: 'input-blur'});
        if (this.props.onBlur) {
            this.props.onBlur();
        }
    }

    appendDelimitedValues = async (values: string): Promise<number> => {
        const existingValues = this.formatValuesForCreatable();
        const entries = [...new Set(values.split(multipleValuesDelimiter))];

        if (entries.length === 0) {
            return 0;
        }

        const isUniqueEmail = (values: Array<UserProfile | EmailInvite>, email: string): boolean => {
            return values.findIndex((v) => (
                this.isEmailInvite(v) && v.value === email) || (this.isUserProfile(v) && v.email === email),
            ) === -1;
        };

        const handleEmail = async (email: string): Promise<UserProfile | string | null> => {
            if (!isUniqueEmail(existingValues, email)) {
                return null;
            }
            const resp = await this.searchByEmail(email);
            return resp || email;
        };

        const isUniqueUsername = (values: Array<UserProfile | EmailInvite>, username: string): boolean => {
            return values.findIndex((v) => this.isUserProfile(v) && v.username === username) === -1;
        };

        const handleUsername = async (username: string): Promise<UserProfile | null> => {
            if (!isUniqueUsername(existingValues, username)) {
                return null;
            }
            return this.searchByUsername(username);
        };

        const promises = entries.map(async (entry) => {
            if (entry === '') {
                return Promise.resolve(null);
            }

            let res;
            if (this.props.emailInvitationsEnabled && isEmail(entry)) {
                res = await handleEmail(entry);
            } else {
                res = await handleUsername(entry);
            }

            if (typeof res === 'string') {
                return Promise.resolve({value: res, label: res});
            } else if (this.isUserProfile(res as UserProfile)) {
                return Promise.resolve(res);
            }
            return Promise.resolve(null);
        });

        const newValues: Array<UserProfile | EmailInvite> = [];

        (await Promise.allSettled(promises)).reduce((acc, v) => {
            if (v.status === 'fulfilled') {
                acc.push(v.value);
            }
            return acc;
        }, [] as Array<UserProfile | EmailInvite | null>).forEach((v) => {
            if (!v) {
                return;
            }

            if (this.isEmailInvite(v) && (!isUniqueEmail(existingValues, v.value) || !isUniqueEmail(newValues, v.value))) {
                return;
            }

            if (this.isUserProfile(v) && (
                !isUniqueUsername(existingValues, v.username) || !isUniqueEmail(existingValues, v.email) ||
                !isUniqueUsername(newValues, v.username) || !isUniqueEmail(newValues, v.email)
            )) {
                return;
            }

            newValues.push(v);
        });

        this.onChange([...existingValues, ...newValues]);
        this.props.onInputChange('');

        return newValues.length;
    }

    isUserProfile = (obj: UserProfile | EmailInvite): obj is UserProfile => {
        return (obj as UserProfile).id !== undefined;
    }

    isEmailInvite = (obj: UserProfile | EmailInvite): obj is EmailInvite => {
        return (obj as EmailInvite).value !== undefined;
    }

    searchByEmail = async (value: string): Promise<UserProfile | null> => {
        let data;
        try {
            data = await Client4.getUserByEmail(value);
        } catch (error) {
            return null;
        }
        return data?.delete_at === 0 ? data : null;
    }

    searchByUsername = async (value: string): Promise<UserProfile | null> => {
        let data;
        try {
            data = await Client4.getUserByUsername(value);
        } catch (error) {
            return null;
        }
        return data?.delete_at === 0 ? data : null;
    }

    render() {
        const values = this.formatValuesForCreatable();

        const Msg: any = components.NoOptionsMessage;

        const styles: Partial<Styles> = {
            placeholder: (css) => ({
                ...css,

                pointerEvents: 'none',
                userSelect: 'none',
            }),
            input: (css) => ({
                ...css,

                display: 'flex',
                flex: '1 1 auto',

                '> div': {
                    width: '100%',
                },

                input: {
                    width: '100% !important',
                    textAlign: 'left',
                },
            }),
        };

        return (
            <>
                <AsyncCreatable
                    ref={this.selectRef}
                    onChange={this.onChange}
                    loadOptions={this.optionsLoader}
                    isValidNewOption={this.showAddEmail}
                    isMulti={true}
                    isClearable={false}
                    className={classNames(
                        'UsersEmailsInput',
                        this.props.showError ? 'error' : '',
                        {empty: this.props.inputValue === ''},
                        {'no-selections': values.length === 0},
                    )}
                    classNamePrefix='users-emails-input'
                    placeholder={this.props.placeholder}
                    components={this.components}
                    getOptionValue={this.getOptionValue}
                    formatOptionLabel={this.formatOptionLabel}
                    defaultOptions={false}
                    defaultMenuIsOpen={false}
                    openMenuOnClick={false}
                    loadingMessage={this.loadingMessage}
                    onInputChange={this.handleInputChange}
                    inputValue={this.props.inputValue}
                    openMenuOnFocus={true}
                    onFocus={this.onFocus}
                    onBlur={this.onBlur}
                    tabSelectsValue={true}
                    value={values}
                    aria-label={this.props.ariaLabel}
                    autoFocus={this.props.autoFocus}
                    styles={styles}
                />
                {this.props.showError && (
                    <div className='InputErrorBox'>
                        <Msg>
                            <FormattedMarkdownMessage
                                id={this.props.errorMessageId}
                                defaultMessage={this.props.errorMessageDefault}
                                values={this.props.errorMessageValues}
                                disableLinks={true}
                            />
                        </Msg>
                        {this.props.extraErrorText || null}
                    </div>
                )}
            </>
        );
    }
}
