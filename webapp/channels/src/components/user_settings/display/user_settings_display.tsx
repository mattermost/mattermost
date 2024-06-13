// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */

import deepEqual from 'fast-deep-equal';
import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage, defineMessage} from 'react-intl';
import type {Timezone} from 'timezones.json';

import type {PreferenceType} from '@mattermost/types/preferences';
import type {UserProfile, UserTimezone} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {trackEvent} from 'actions/telemetry_actions';

import SettingItem from 'components/setting_item';
import SettingItemMax from 'components/setting_item_max';
import ThemeSetting from 'components/user_settings/display/user_settings_theme';

import type {Language} from 'i18n/i18n';
import {getLanguageInfo} from 'i18n/i18n';
import Constants from 'utils/constants';
import {getBrowserTimezone} from 'utils/timezone';
import {a11yFocus} from 'utils/utils';

import ManageLanguages from './manage_languages';
import ManageTimezones from './manage_timezones';

import SettingDesktopHeader from '../headers/setting_desktop_header';
import SettingMobileHeader from '../headers/setting_mobile_header';

const Preferences = Constants.Preferences;

function getDisplayStateFromProps(props: Props) {
    return {
        militaryTime: props.militaryTime,
        teammateNameDisplay: props.teammateNameDisplay,
        availabilityStatusOnPosts: props.availabilityStatusOnPosts,
        channelDisplayMode: props.channelDisplayMode,
        messageDisplay: props.messageDisplay,
        colorizeUsernames: props.colorizeUsernames,
        collapseDisplay: props.collapseDisplay,
        collapsedReplyThreads: props.collapsedReplyThreads,
        linkPreviewDisplay: props.linkPreviewDisplay,
        lastActiveDisplay: props.lastActiveDisplay.toString(),
        oneClickReactionsOnPosts: props.oneClickReactionsOnPosts,
        clickToReply: props.clickToReply,
    };
}

type ChildOption = {
    label: MessageDescriptor;
    value: string;
    display: string;
    more: MessageDescriptor;
};

type Option = {
    value: string;
    radionButtonText: {
        label: MessageDescriptor;
        more?: MessageDescriptor;
    };
    childOption?: ChildOption;
}

type SectionProps ={
    section: string;
    display: string;
    defaultDisplay: string;
    value: string;
    title: MessageDescriptor;
    firstOption: Option;
    secondOption: Option;
    thirdOption?: Option;
    description: MessageDescriptor;
    disabled?: boolean;
    onSubmit?: () => void;
}

type Props = {
    user: UserProfile;
    updateSection: (section: string) => void;
    activeSection?: string;
    closeModal: () => void;
    collapseModal: () => void;
    setRequireConfirm?: () => void;
    setEnforceFocus?: () => void;
    timezones: Timezone[];
    userTimezone: UserTimezone;
    allowCustomThemes: boolean;
    enableLinkPreviews: boolean;
    locales: Record<string, Language>;
    userLocale: string;
    enableThemeSelection: boolean;
    configTeammateNameDisplay: string;
    currentUserTimezone: string;
    shouldAutoUpdateTimezone: boolean | string;
    lockTeammateNameDisplay: boolean;
    militaryTime: string;
    teammateNameDisplay: string;
    availabilityStatusOnPosts: string;
    channelDisplayMode: string;
    messageDisplay: string;
    colorizeUsernames: string;
    collapseDisplay: string;
    collapsedReplyThreads: string;
    collapsedReplyThreadsAllowUserPreference: boolean;
    clickToReply: string;
    linkPreviewDisplay: string;
    oneClickReactionsOnPosts: string;
    emojiPickerEnabled: boolean;
    timezoneLabel: string;
    lastActiveDisplay: boolean;
    lastActiveTimeEnabled: boolean;
    actions: {
        savePreferences: (userId: string, preferences: PreferenceType[]) => void;
        autoUpdateTimezone: (deviceTimezone: string) => void;
        updateMe: (user: UserProfile) => Promise<ActionResult>;
    };
}

type State = {
    [key: string]: any;
    isSaving: boolean;
    militaryTime: string;
    teammateNameDisplay: string;
    availabilityStatusOnPosts: string;
    channelDisplayMode: string;
    messageDisplay: string;
    colorizeUsernames: string;
    collapseDisplay: string;
    collapsedReplyThreads: string;
    linkPreviewDisplay: string;
    lastActiveDisplay: string;
    oneClickReactionsOnPosts: string;
    clickToReply: string;
    handleSubmit?: () => void;
    serverError?: string;
}

export default class UserSettingsDisplay extends React.PureComponent<Props, State> {
    public prevSections: {
        theme: string;

        clock: string;
        linkpreview: string;
        message_display: string;
        channel_display_mode: string;
        languages: string;
    };

    constructor(props: Props) {
        super(props);

        this.state = {
            ...getDisplayStateFromProps(props),
            isSaving: false,
        };

        this.prevSections = {
            theme: 'dummySectionName', // dummy value that should never match any section name
            clock: 'theme',
            linkpreview: 'clock',
            message_display: 'linkpreview',
            channel_display_mode: 'message_display',
            languages: 'channel_display_mode',
        };
    }

    componentDidMount() {
        const {actions, shouldAutoUpdateTimezone} = this.props;

        if (shouldAutoUpdateTimezone) {
            actions.autoUpdateTimezone(getBrowserTimezone());
        }
    }

    componentDidUpdate(prevProps: Props) {
        if (this.props.teammateNameDisplay !== prevProps.teammateNameDisplay) {
            this.updateState();
        }
    }

    trackChangeIfNecessary(preference: PreferenceType, oldValue: any): void {
        const props = {
            field: 'display.' + preference.name,
            value: preference.value,
        };

        if (preference.value !== oldValue) {
            trackEvent('settings', 'user_settings_update', props);
        }
    }

    submitLastActive = () => {
        const {user, actions} = this.props;
        const {lastActiveDisplay} = this.state;

        const updatedUser = {
            ...user,
            props: {
                ...user.props,
                show_last_active: lastActiveDisplay,
            },
        };

        actions.updateMe(updatedUser).
            then((res) => {
                if ('data' in res) {
                    this.props.updateSection('');
                } else if ('error' in res) {
                    const {error} = res;
                    let serverError;
                    if (error instanceof Error) {
                        serverError = error.message;
                    } else {
                        serverError = error as string;
                    }
                    this.setState({serverError, isSaving: false});
                }
            });
    };

    handleSubmit = async () => {
        const userId = this.props.user.id;

        const timePreference = {
            user_id: userId,
            category: Preferences.CATEGORY_DISPLAY_SETTINGS,
            name: Preferences.USE_MILITARY_TIME,
            value: this.state.militaryTime,
        };
        const availabilityStatusOnPostsPreference = {
            user_id: userId,
            category: Preferences.CATEGORY_DISPLAY_SETTINGS,
            name: Preferences.AVAILABILITY_STATUS_ON_POSTS,
            value: this.state.availabilityStatusOnPosts,
        };
        const teammateNameDisplayPreference = {
            user_id: userId,
            category: Preferences.CATEGORY_DISPLAY_SETTINGS,
            name: Preferences.NAME_NAME_FORMAT,
            value: this.state.teammateNameDisplay,
        };
        const channelDisplayModePreference = {
            user_id: userId,
            category: Preferences.CATEGORY_DISPLAY_SETTINGS,
            name: Preferences.CHANNEL_DISPLAY_MODE,
            value: this.state.channelDisplayMode,
        };
        const messageDisplayPreference = {
            user_id: userId,
            category: Preferences.CATEGORY_DISPLAY_SETTINGS,
            name: Preferences.MESSAGE_DISPLAY,
            value: this.state.messageDisplay,
        };
        const colorizeUsernamesPreference = {
            user_id: userId,
            category: Preferences.CATEGORY_DISPLAY_SETTINGS,
            name: Preferences.COLORIZE_USERNAMES,
            value: this.state.colorizeUsernames,
        };
        const collapseDisplayPreference = {
            user_id: userId,
            category: Preferences.CATEGORY_DISPLAY_SETTINGS,
            name: Preferences.COLLAPSE_DISPLAY,
            value: this.state.collapseDisplay,
        };
        const collapsedReplyThreadsPreference = {
            user_id: userId,
            category: Preferences.CATEGORY_DISPLAY_SETTINGS,
            name: Preferences.COLLAPSED_REPLY_THREADS,
            value: this.state.collapsedReplyThreads,
        };
        const linkPreviewDisplayPreference = {
            user_id: userId,
            category: Preferences.CATEGORY_DISPLAY_SETTINGS,
            name: Preferences.LINK_PREVIEW_DISPLAY,
            value: this.state.linkPreviewDisplay,
        };
        const oneClickReactionsOnPostsPreference = {
            user_id: userId,
            category: Preferences.CATEGORY_DISPLAY_SETTINGS,
            name: Preferences.ONE_CLICK_REACTIONS_ENABLED,
            value: this.state.oneClickReactionsOnPosts,
        };
        const clickToReplyPreference = {
            user_id: userId,
            category: Preferences.CATEGORY_DISPLAY_SETTINGS,
            name: Preferences.CLICK_TO_REPLY,
            value: this.state.clickToReply,
        };

        this.setState({isSaving: true});

        const preferences = [
            timePreference,
            channelDisplayModePreference,
            messageDisplayPreference,
            collapsedReplyThreadsPreference,
            clickToReplyPreference,
            collapseDisplayPreference,
            linkPreviewDisplayPreference,
            teammateNameDisplayPreference,
            availabilityStatusOnPostsPreference,
            oneClickReactionsOnPostsPreference,
            colorizeUsernamesPreference,
        ];

        this.trackChangeIfNecessary(collapsedReplyThreadsPreference, this.props.collapsedReplyThreads);

        await this.props.actions.savePreferences(userId, preferences);

        this.updateSection('');
    };

    handleClockRadio = (militaryTime: string) => {
        this.setState({militaryTime});
    };

    handleTeammateNameDisplayRadio = (teammateNameDisplay: string) => {
        this.setState({teammateNameDisplay});
    };

    handleAvailabilityStatusRadio = (availabilityStatusOnPosts: string) => {
        this.setState({availabilityStatusOnPosts});
    };

    handleChannelDisplayModeRadio(channelDisplayMode: string) {
        this.setState({channelDisplayMode});
    }

    handlemessageDisplayRadio(messageDisplay: string) {
        this.setState({messageDisplay});
    }

    handleCollapseRadio(collapseDisplay: string) {
        this.setState({collapseDisplay});
    }

    handleCollapseReplyThreadsRadio(collapsedReplyThreads: string) {
        this.setState({collapsedReplyThreads});
    }

    handleLastActiveRadio(lastActiveDisplay: string) {
        this.setState({lastActiveDisplay});
    }

    handleLinkPreviewRadio(linkPreviewDisplay: string) {
        this.setState({linkPreviewDisplay});
    }

    handleOneClickReactionsRadio = (oneClickReactionsOnPosts: string) => {
        this.setState({oneClickReactionsOnPosts});
    };

    handleClickToReplyRadio = (clickToReply: string) => {
        this.setState({clickToReply});
    };

    handleOnChange(e: React.ChangeEvent, display: {[key: string]: any}) {
        this.setState({...display});
        a11yFocus(e.currentTarget as HTMLElement);
    }

    updateSection = (section: string) => {
        this.updateState();
        this.props.updateSection(section);
    };

    updateState = () => {
        const newState = getDisplayStateFromProps(this.props);
        if (!deepEqual(newState, this.state)) {
            this.setState(newState);
        }

        this.setState({isSaving: false});
    };

    createSection(props: SectionProps) {
        const {
            section,
            display,
            value,
            title,
            firstOption,
            secondOption,
            thirdOption,
            description,
            disabled,
            onSubmit,
        } = props;
        let extraInfo = null;
        let submit: (() => Promise<void>) | (() => void) | null = onSubmit || this.handleSubmit;

        const firstMessage = (
            <FormattedMessage
                id={firstOption.radionButtonText.label.id}
                defaultMessage={firstOption.radionButtonText.label.defaultMessage}
            />
        );

        let moreColon;
        let firstMessageMore;
        if (firstOption.radionButtonText.more?.id) {
            moreColon = ': ';
            firstMessageMore = (
                <span className='font-weight--normal'>
                    <FormattedMessage
                        id={firstOption.radionButtonText.more.id}
                        defaultMessage={firstOption.radionButtonText.more.defaultMessage}
                    />
                </span>
            );
        }

        const secondMessage = (
            <FormattedMessage
                id={secondOption.radionButtonText.label.id}
                defaultMessage={secondOption.radionButtonText.label.defaultMessage}
            />
        );

        let secondMessageMore;
        if (secondOption.radionButtonText.more?.id) {
            secondMessageMore = (
                <span className='font-weight--normal'>
                    <FormattedMessage
                        id={secondOption.radionButtonText.more.id}
                        defaultMessage={secondOption.radionButtonText.more.defaultMessage}
                    />
                </span>
            );
        }

        let thirdMessage;
        if (thirdOption) {
            thirdMessage = (
                <FormattedMessage
                    id={thirdOption.radionButtonText.label.id}
                    defaultMessage={thirdOption.radionButtonText.label.defaultMessage}
                />
            );
        }

        const messageTitle = (
            <FormattedMessage
                id={title.id}
                defaultMessage={title.defaultMessage}
            />
        );

        const messageDesc = (
            <FormattedMessage
                id={description.id}
                defaultMessage={description.defaultMessage}
            />
        );

        const active = this.props.activeSection === section;
        let max = null;
        if (active) {
            const format = [false, false, false];
            let childOptionToShow: ChildOption | undefined;
            if (value === firstOption.value) {
                format[0] = true;
                childOptionToShow = firstOption.childOption;
            } else if (value === secondOption.value) {
                format[1] = true;
                childOptionToShow = secondOption.childOption;
            } else {
                format[2] = true;
                if (thirdOption) {
                    childOptionToShow = thirdOption.childOption;
                }
            }

            const name = section + 'Format';
            const key = section + 'UserDisplay';

            const firstDisplay = {
                [display]: firstOption.value,
            };

            const secondDisplay = {
                [display]: secondOption.value,
            };

            let thirdSection;
            if (thirdOption && thirdMessage) {
                const thirdDisplay = {
                    [display]: thirdOption.value,
                };

                thirdSection = (
                    <div className='radio'>
                        <label>
                            <input
                                id={name + 'C'}
                                type='radio'
                                name={name}
                                checked={format[2]}
                                onChange={(e) => this.handleOnChange(e, thirdDisplay)}
                            />
                            {thirdMessage}
                        </label>
                        <br/>
                    </div>
                );
            }

            let childOptionSection;
            if (childOptionToShow) {
                const childDisplay = childOptionToShow.display;
                childOptionSection = (
                    <div className='checkbox'>
                        <hr/>
                        <label>
                            <input
                                id={name + 'childOption'}
                                type='checkbox'
                                name={childOptionToShow.label.id}
                                checked={childOptionToShow.value === 'true'}
                                onChange={(e) => {
                                    this.handleOnChange(e, {[childDisplay]: e.target.checked ? 'true' : 'false'});
                                }}
                            />
                            <FormattedMessage
                                id={childOptionToShow.label.id}
                                defaultMessage={childOptionToShow.label.defaultMessage}
                            />
                            {moreColon}
                            <span className='font-weight--normal'>
                                <FormattedMessage
                                    id={childOptionToShow.more.id}
                                    defaultMessage={childOptionToShow.more.defaultMessage}
                                />
                            </span>
                        </label>
                        <br/>
                    </div>
                );
            }

            let inputs = [
                <fieldset key={key}>
                    <legend className='form-legend hidden-label'>
                        {messageTitle}
                    </legend>
                    <div className='radio'>
                        <label>
                            <input
                                id={name + 'A'}
                                type='radio'
                                name={name}
                                checked={format[0]}
                                onChange={(e) => this.handleOnChange(e, firstDisplay)}
                            />
                            {firstMessage}
                            {moreColon}
                            {firstMessageMore}
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                id={name + 'B'}
                                type='radio'
                                name={name}
                                checked={format[1]}
                                onChange={(e) => this.handleOnChange(e, secondDisplay)}
                            />
                            {secondMessage}
                            {moreColon}
                            {secondMessageMore}
                        </label>
                        <br/>
                    </div>
                    {thirdSection}
                    <div>
                        <br/>
                        {messageDesc}
                    </div>
                    {childOptionSection}
                </fieldset>,
            ];

            if (display === 'teammateNameDisplay' && disabled) {
                extraInfo = (
                    <span>
                        <FormattedMessage
                            id='user.settings.display.teammateNameDisplay'
                            defaultMessage='This field is handled through your System Administrator. If you want to change it, you need to do so through your System Administrator.'
                        />
                    </span>
                );
                submit = null;
                inputs = [];
            }
            max = (
                <SettingItemMax
                    title={messageTitle}
                    inputs={inputs}
                    submit={submit}
                    saving={this.state.isSaving}
                    serverError={this.state.serverError}
                    extraInfo={extraInfo}
                    updateSection={this.updateSection}
                />);
        }

        let describe;
        if (value === firstOption.value) {
            describe = firstMessage;
        } else if (value === secondOption.value) {
            describe = secondMessage;
        } else {
            describe = thirdMessage;
        }

        return (
            <div>
                <SettingItem
                    active={active}
                    areAllSectionsInactive={this.props.activeSection === ''}
                    title={messageTitle}
                    describe={describe}
                    section={section}
                    updateSection={this.updateSection}
                    max={max}
                />
                <div className='divider-dark'/>
            </div>
        );
    }

    render() {
        const collapseSection = this.createSection({
            section: 'collapse',
            display: 'collapseDisplay',
            value: this.state.collapseDisplay,
            defaultDisplay: 'false',
            title: defineMessage({
                id: 'user.settings.display.collapseDisplay',
                defaultMessage: 'Default Appearance of Image Previews',
            }),
            firstOption: {
                value: 'false',
                radionButtonText: {
                    label: defineMessage({
                        id: 'user.settings.display.collapseOn',
                        defaultMessage: 'Expanded',
                    }),
                },
            },
            secondOption: {
                value: 'true',
                radionButtonText: {
                    label: defineMessage({
                        id: 'user.settings.display.collapseOff',
                        defaultMessage: 'Collapsed',
                    }),
                },
            },
            description: defineMessage({
                id: 'user.settings.display.collapseDesc',
                defaultMessage: 'Set whether previews of image links and image attachment thumbnails show as expanded or collapsed by default. This setting can also be controlled using the slash commands /expand and /collapse.',
            }),
        });

        let linkPreviewSection = null;

        if (this.props.enableLinkPreviews) {
            linkPreviewSection = this.createSection({
                section: 'linkpreview',
                display: 'linkPreviewDisplay',
                value: this.state.linkPreviewDisplay,
                defaultDisplay: 'true',
                title: defineMessage({
                    id: 'user.settings.display.linkPreviewDisplay',
                    defaultMessage: 'Website Link Previews',
                }),
                firstOption: {
                    value: 'true',
                    radionButtonText: {
                        label: defineMessage({
                            id: 'user.settings.display.linkPreviewOn',
                            defaultMessage: 'On',
                        }),
                    },
                },
                secondOption: {
                    value: 'false',
                    radionButtonText: {
                        label: defineMessage({
                            id: 'user.settings.display.linkPreviewOff',
                            defaultMessage: 'Off',
                        }),
                    },
                },
                description: defineMessage({
                    id: 'user.settings.display.linkPreviewDesc',
                    defaultMessage: 'When available, the first web link in a message will show a preview of the website content below the message.',
                }),
            });
            this.prevSections.message_display = 'linkpreview';
        } else {
            this.prevSections.message_display = this.prevSections.linkpreview;
        }

        let lastActiveSection = null;

        if (this.props.lastActiveTimeEnabled) {
            lastActiveSection = this.createSection({
                section: 'lastactive',
                display: 'lastActiveDisplay',
                value: this.state.lastActiveDisplay,
                defaultDisplay: 'true',
                title: defineMessage({
                    id: 'user.settings.display.lastActiveDisplay',
                    defaultMessage: 'Share last active time',
                }),
                firstOption: {
                    value: 'true',
                    radionButtonText: {
                        label: defineMessage({
                            id: 'user.settings.display.lastActiveOn',
                            defaultMessage: 'On',
                        }),
                    },
                },
                secondOption: {
                    value: 'false',
                    radionButtonText: {
                        label: defineMessage({
                            id: 'user.settings.display.lastActiveOff',
                            defaultMessage: 'Off',
                        }),
                    },
                },
                description: defineMessage({
                    id: 'user.settings.display.lastActiveDesc',
                    defaultMessage: 'When enabled, other users will see when you were last active.',
                }),
                onSubmit: this.submitLastActive,
            });
        }

        const clockSection = this.createSection({
            section: 'clock',
            display: 'militaryTime',
            value: this.state.militaryTime,
            defaultDisplay: 'false',
            title: defineMessage({
                id: 'user.settings.display.clockDisplay',
                defaultMessage: 'Clock Display',
            }),
            firstOption: {
                value: 'false',
                radionButtonText: {
                    label: defineMessage({
                        id: 'user.settings.display.normalClock',
                        defaultMessage: '12-hour clock (example: 4:00 PM)',
                    }),
                },
            },
            secondOption: {
                value: 'true',
                radionButtonText: {
                    label: defineMessage({
                        id: 'user.settings.display.militaryClock',
                        defaultMessage: '24-hour clock (example: 16:00)',
                    }),
                },
            },
            description: defineMessage({
                id: 'user.settings.display.preferTime',
                defaultMessage: 'Select how you prefer time displayed.',
            }),
        });

        const teammateNameDisplaySection = this.createSection({
            section: Preferences.NAME_NAME_FORMAT,
            display: 'teammateNameDisplay',
            value: this.props.lockTeammateNameDisplay ? this.props.configTeammateNameDisplay : this.state.teammateNameDisplay,
            defaultDisplay: this.props.configTeammateNameDisplay,
            title: defineMessage({
                id: 'user.settings.display.teammateNameDisplayTitle',
                defaultMessage: 'Teammate Name Display',
            }),
            firstOption: {
                value: Constants.TEAMMATE_NAME_DISPLAY.SHOW_USERNAME,
                radionButtonText: {
                    label: defineMessage({
                        id: 'user.settings.display.teammateNameDisplayUsername',
                        defaultMessage: 'Show username',
                    }),
                },
            },
            secondOption: {
                value: Constants.TEAMMATE_NAME_DISPLAY.SHOW_NICKNAME_FULLNAME,
                radionButtonText: {
                    label: defineMessage({
                        id: 'user.settings.display.teammateNameDisplayNicknameFullname',
                        defaultMessage: 'Show nickname if one exists, otherwise show first and last name',
                    }),
                },
            },
            thirdOption: {
                value: Constants.TEAMMATE_NAME_DISPLAY.SHOW_FULLNAME,
                radionButtonText: {
                    label: defineMessage({
                        id: 'user.settings.display.teammateNameDisplayFullname',
                        defaultMessage: 'Show first and last name',
                    }),
                },
            },
            description: defineMessage({
                id: 'user.settings.display.teammateNameDisplayDescription',
                defaultMessage: 'Set how to display other user\'s names in posts and the Direct Messages list.',
            }),
            disabled: this.props.lockTeammateNameDisplay,
        });

        const availabilityStatusOnPostsSection = this.createSection({
            section: 'availabilityStatus',
            display: 'availabilityStatusOnPosts',
            value: this.state.availabilityStatusOnPosts,
            defaultDisplay: 'true',
            title: defineMessage({
                id: 'user.settings.display.availabilityStatusOnPostsTitle',
                defaultMessage: 'Show user availability on posts',
            }),
            firstOption: {
                value: 'true',
                radionButtonText: {
                    label: defineMessage({
                        id: 'user.settings.sidebar.on',
                        defaultMessage: 'On',
                    }),
                },
            },
            secondOption: {
                value: 'false',
                radionButtonText: {
                    label: defineMessage({
                        id: 'user.settings.sidebar.off',
                        defaultMessage: 'Off',
                    }),
                },
            },
            description: defineMessage({
                id: 'user.settings.display.availabilityStatusOnPostsDescription',
                defaultMessage: 'When enabled, online availability is displayed on profile images in the message list.',
            }),
        });

        let timezoneSelection;
        if (!this.props.shouldAutoUpdateTimezone) {
            const userTimezone = this.props.userTimezone;
            const active = this.props.activeSection === 'timezone';
            let max = null;
            if (active) {
                max = (
                    <ManageTimezones
                        user={this.props.user}
                        useAutomaticTimezone={Boolean(userTimezone.useAutomaticTimezone)}
                        automaticTimezone={userTimezone.automaticTimezone}
                        manualTimezone={userTimezone.manualTimezone}
                        updateSection={this.updateSection}
                    />
                );
            }
            timezoneSelection = (
                <div>
                    <SettingItem
                        active={active}
                        areAllSectionsInactive={this.props.activeSection === ''}
                        title={
                            <FormattedMessage
                                id='user.settings.display.timezone'
                                defaultMessage='Timezone'
                            />
                        }
                        describe={this.props.timezoneLabel}
                        section={'timezone'}
                        updateSection={this.updateSection}
                        max={max}
                    />
                    <div className='divider-dark'/>
                </div>
            );
        }

        const messageDisplaySection = this.createSection({
            section: Preferences.MESSAGE_DISPLAY,
            display: 'messageDisplay',
            value: this.state.messageDisplay,
            defaultDisplay: Preferences.MESSAGE_DISPLAY_CLEAN,
            title: defineMessage({
                id: 'user.settings.display.messageDisplayTitle',
                defaultMessage: 'Message Display',
            }),
            firstOption: {
                value: Preferences.MESSAGE_DISPLAY_CLEAN,
                radionButtonText: {
                    label: defineMessage({
                        id: 'user.settings.display.messageDisplayClean',
                        defaultMessage: 'Standard',
                    }),
                    more: defineMessage({
                        id: 'user.settings.display.messageDisplayCleanDes',
                        defaultMessage: 'Easy to scan and read.',
                    }),
                },
            },
            secondOption: {
                value: Preferences.MESSAGE_DISPLAY_COMPACT,
                radionButtonText: {
                    label: defineMessage({
                        id: 'user.settings.display.messageDisplayCompact',
                        defaultMessage: 'Compact',
                    }),
                    more: defineMessage({
                        id: 'user.settings.display.messageDisplayCompactDes',
                        defaultMessage: 'Fit as many messages on the screen as we can.',
                    }),
                },
                childOption: {
                    label: defineMessage({
                        id: 'user.settings.display.colorize',
                        defaultMessage: 'Colorize usernames',
                    }),
                    value: this.state.colorizeUsernames,
                    display: 'colorizeUsernames',
                    more: defineMessage({
                        id: 'user.settings.display.colorizeDes',
                        defaultMessage: 'Use colors to distinguish users in compact mode',
                    }),
                },
            },
            description: defineMessage({
                id: 'user.settings.display.messageDisplayDescription',
                defaultMessage: 'Select how messages in a channel should be displayed.',
            }),
        });

        let collapsedReplyThreads;

        if (this.props.collapsedReplyThreadsAllowUserPreference) {
            collapsedReplyThreads = this.createSection({
                section: Preferences.COLLAPSED_REPLY_THREADS,
                display: 'collapsedReplyThreads',
                value: this.state.collapsedReplyThreads,
                defaultDisplay: Preferences.COLLAPSED_REPLY_THREADS_FALLBACK_DEFAULT,
                title: defineMessage({
                    id: 'user.settings.display.collapsedReplyThreadsTitle',
                    defaultMessage: 'Collapsed Reply Threads',
                }),
                firstOption: {
                    value: Preferences.COLLAPSED_REPLY_THREADS_ON,
                    radionButtonText: {
                        label: defineMessage({
                            id: 'user.settings.display.collapsedReplyThreadsOn',
                            defaultMessage: 'On',
                        }),
                    },
                },
                secondOption: {
                    value: Preferences.COLLAPSED_REPLY_THREADS_OFF,
                    radionButtonText: {
                        label: defineMessage({
                            id: 'user.settings.display.collapsedReplyThreadsOff',
                            defaultMessage: 'Off',
                        }),
                    },
                },
                description: defineMessage({
                    id: 'user.settings.display.collapsedReplyThreadsDescription',
                    defaultMessage: 'When enabled, reply messages are not shown in the channel and you\'ll be notified about threads you\'re following in the "Threads" view.',
                }),
            });
        }

        const clickToReply = this.createSection({
            section: Preferences.CLICK_TO_REPLY,
            display: 'clickToReply',
            value: this.state.clickToReply,
            defaultDisplay: 'true',
            title: defineMessage({
                id: 'user.settings.display.clickToReply',
                defaultMessage: 'Click to open threads',
            }),
            firstOption: {
                value: 'true',
                radionButtonText: {
                    label: defineMessage({
                        id: 'user.settings.sidebar.on',
                        defaultMessage: 'On',
                    }),
                },
            },
            secondOption: {
                value: 'false',
                radionButtonText: {
                    label: defineMessage({
                        id: 'user.settings.sidebar.off',
                        defaultMessage: 'Off',
                    }),
                },
            },
            description: defineMessage({
                id: 'user.settings.display.clickToReplyDescription',
                defaultMessage: 'When enabled, click anywhere on a message to open the reply thread.',
            }),
        });

        const channelDisplayModeSection = this.createSection({
            section: Preferences.CHANNEL_DISPLAY_MODE,
            display: 'channelDisplayMode',
            value: this.state.channelDisplayMode,
            defaultDisplay: Preferences.CHANNEL_DISPLAY_MODE_FULL_SCREEN,
            title: defineMessage({
                id: 'user.settings.display.channelDisplayTitle',
                defaultMessage: 'Channel Display',
            }),
            firstOption: {
                value: Preferences.CHANNEL_DISPLAY_MODE_FULL_SCREEN,
                radionButtonText: {
                    label: defineMessage({
                        id: 'user.settings.display.fullScreen',
                        defaultMessage: 'Full width',
                    }),
                },
            },
            secondOption: {
                value: Preferences.CHANNEL_DISPLAY_MODE_CENTERED,
                radionButtonText: {
                    label: defineMessage({
                        id: 'user.settings.display.fixedWidthCentered',
                        defaultMessage: 'Fixed width, centered',
                    }),
                },
            },
            description: defineMessage({
                id: 'user.settings.display.channeldisplaymode',
                defaultMessage: 'Select the width of the center channel.',
            }),
        });

        let languagesSection;
        const userLocale = this.props.userLocale;
        const localeName = getLanguageInfo(userLocale).name;

        languagesSection = (
            <div>
                <SettingItem
                    active={this.props.activeSection === 'languages'}
                    areAllSectionsInactive={this.props.activeSection === ''}
                    title={
                        <FormattedMessage
                            id='user.settings.display.language'
                            defaultMessage='Language'
                        />
                    }
                    describe={localeName}
                    section={'languages'}
                    updateSection={this.updateSection}
                    max={(
                        <ManageLanguages
                            user={this.props.user}
                            locale={userLocale}
                            updateSection={this.updateSection}
                        />
                    )}
                />
                <div className='divider-dark'/>
            </div>
        );

        if (Object.keys(this.props.locales).length === 1) {
            languagesSection = null;
        }

        let themeSection;
        if (this.props.enableThemeSelection) {
            themeSection = (
                <div>
                    <ThemeSetting
                        selected={this.props.activeSection === 'theme'}
                        areAllSectionsInactive={this.props.activeSection === ''}
                        updateSection={this.updateSection}
                        setRequireConfirm={this.props.setRequireConfirm}
                        setEnforceFocus={this.props.setEnforceFocus}
                        allowCustomThemes={this.props.allowCustomThemes}
                    />
                    <div className='divider-dark'/>
                </div>
            );
        }

        let oneClickReactionsOnPostsSection;
        if (this.props.emojiPickerEnabled) {
            oneClickReactionsOnPostsSection = this.createSection({
                section: Preferences.ONE_CLICK_REACTIONS_ENABLED,
                display: 'oneClickReactionsOnPosts',
                value: this.state.oneClickReactionsOnPosts,
                defaultDisplay: 'true',
                title: defineMessage({
                    id: 'user.settings.display.oneClickReactionsOnPostsTitle',
                    defaultMessage: 'Quick reactions on messages',
                }),
                firstOption: {
                    value: 'true',
                    radionButtonText: {
                        label: defineMessage({
                            id: 'user.settings.sidebar.on',
                            defaultMessage: 'On',
                        }),
                    },
                },
                secondOption: {
                    value: 'false',
                    radionButtonText: {
                        label: defineMessage({
                            id: 'user.settings.sidebar.off',
                            defaultMessage: 'Off',
                        }),
                    },
                },
                description: defineMessage({
                    id: 'user.settings.display.oneClickReactionsOnPostsDescription',
                    defaultMessage: 'When enabled, you can react in one-click with recently used reactions when hovering over a message.',
                }),
            });
        }

        return (
            <div id='displaySettings'>
                <SettingMobileHeader
                    closeModal={this.props.closeModal}
                    collapseModal={this.props.collapseModal}
                    text={
                        <FormattedMessage
                            id='user.settings.display.title'
                            defaultMessage='Display Settings'
                        />
                    }
                />
                <div className='user-settings'>
                    <SettingDesktopHeader
                        id='displaySettingsTitle'
                        text={
                            <FormattedMessage
                                id='user.settings.display.title'
                                defaultMessage='Display Settings'
                            />
                        }
                    />
                    <div className='divider-dark first'/>
                    {themeSection}
                    {collapsedReplyThreads}
                    {clockSection}
                    {teammateNameDisplaySection}
                    {availabilityStatusOnPostsSection}
                    {lastActiveSection}
                    {timezoneSelection}
                    {linkPreviewSection}
                    {collapseSection}
                    {messageDisplaySection}
                    {clickToReply}
                    {channelDisplayModeSection}
                    {oneClickReactionsOnPostsSection}
                    {languagesSection}
                </div>
            </div>
        );
    }
}
