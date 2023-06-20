// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ChangeEvent, ClipboardEvent, createRef, MouseEvent, RefObject} from 'react';
import {defineMessages, FormattedMessage, MessageDescriptor} from 'react-intl';

import {setThemeDefaults} from 'mattermost-redux/utils/theme_utils';
import {Theme} from 'mattermost-redux/selectors/entities/preferences';

import {t} from 'utils/i18n';
import Constants from 'utils/constants';

import LocalizedIcon from 'components/localized_icon';
import OverlayTrigger, {BaseOverlayTrigger} from 'components/overlay_trigger';
import Popover from 'components/widgets/popover';

import ColorChooser from '../color_chooser/color_chooser';

const COPY_SUCCESS_INTERVAL = 3000;

const messages: Record<string, MessageDescriptor> = defineMessages({
    sidebarBg: {
        id: 'user.settings.custom_theme.sidebarBg',
        defaultMessage: 'Sidebar BG',
    },
    sidebarText: {
        id: 'user.settings.custom_theme.sidebarText',
        defaultMessage: 'Sidebar Text',
    },
    sidebarHeaderBg: {
        id: 'user.settings.custom_theme.sidebarHeaderBg',
        defaultMessage: 'Sidebar Header BG',
    },
    sidebarTeamBarBg: {
        id: 'user.settings.custom_theme.sidebarTeamBarBg',
        defaultMessage: 'Team Sidebar BG',
    },
    sidebarHeaderTextColor: {
        id: 'user.settings.custom_theme.sidebarHeaderTextColor',
        defaultMessage: 'Sidebar Header Text',
    },
    sidebarUnreadText: {
        id: 'user.settings.custom_theme.sidebarUnreadText',
        defaultMessage: 'Sidebar Unread Text',
    },
    sidebarTextHoverBg: {
        id: 'user.settings.custom_theme.sidebarTextHoverBg',
        defaultMessage: 'Sidebar Text Hover BG',
    },
    sidebarTextActiveBorder: {
        id: 'user.settings.custom_theme.sidebarTextActiveBorder',
        defaultMessage: 'Sidebar Text Active Border',
    },
    sidebarTextActiveColor: {
        id: 'user.settings.custom_theme.sidebarTextActiveColor',
        defaultMessage: 'Sidebar Text Active Color',
    },
    onlineIndicator: {
        id: 'user.settings.custom_theme.onlineIndicator',
        defaultMessage: 'Online Indicator',
    },
    awayIndicator: {
        id: 'user.settings.custom_theme.awayIndicator',
        defaultMessage: 'Away Indicator',
    },
    dndIndicator: {
        id: 'user.settings.custom_theme.dndIndicator',
        defaultMessage: 'Do Not Disturb Indicator',
    },
    mentionBg: {
        id: 'user.settings.custom_theme.mentionBg',
        defaultMessage: 'Mention Jewel BG',
    },
    mentionColor: {
        id: 'user.settings.custom_theme.mentionColor',
        defaultMessage: 'Mention Jewel Text',
    },
    centerChannelBg: {
        id: 'user.settings.custom_theme.centerChannelBg',
        defaultMessage: 'Center Channel BG',
    },
    centerChannelColor: {
        id: 'user.settings.custom_theme.centerChannelColor',
        defaultMessage: 'Center Channel Text',
    },
    newMessageSeparator: {
        id: 'user.settings.custom_theme.newMessageSeparator',
        defaultMessage: 'New Message Separator',
    },
    linkColor: {
        id: 'user.settings.custom_theme.linkColor',
        defaultMessage: 'Link Color',
    },
    buttonBg: {
        id: 'user.settings.custom_theme.buttonBg',
        defaultMessage: 'Button BG',
    },
    buttonColor: {
        id: 'user.settings.custom_theme.buttonColor',
        defaultMessage: 'Button Text',
    },
    errorTextColor: {
        id: 'user.settings.custom_theme.errorTextColor',
        defaultMessage: 'Error Text Color',
    },
    mentionHighlightBg: {
        id: 'user.settings.custom_theme.mentionHighlightBg',
        defaultMessage: 'Mention Highlight BG',
    },
    mentionHighlightLink: {
        id: 'user.settings.custom_theme.mentionHighlightLink',
        defaultMessage: 'Mention Highlight Link',
    },
    codeTheme: {
        id: 'user.settings.custom_theme.codeTheme',
        defaultMessage: 'Code Theme',
    },
});

type Props = {
    theme: Theme;
    updateTheme: (theme: Theme) => void;
};

type State = {
    copyTheme: string;
};

export default class CustomThemeChooser extends React.PureComponent<Props, State> {
    textareaRef: RefObject<HTMLTextAreaElement>;
    sidebarStylesHeaderRef: RefObject<HTMLDivElement>;
    centerChannelStylesHeaderRef: RefObject<HTMLDivElement>;
    linkAndButtonStylesHeaderRef: RefObject<HTMLDivElement>;
    sidebarStylesRef: RefObject<HTMLDivElement>;
    headerOverlayRef: RefObject<BaseOverlayTrigger>;
    centerChannelStylesRef: RefObject<HTMLDivElement>;
    linkAndButtonStylesRef: RefObject<HTMLDivElement>;

    constructor(props: Props) {
        super(props);
        this.textareaRef = createRef();
        this.sidebarStylesHeaderRef = createRef();
        this.centerChannelStylesHeaderRef = createRef();
        this.linkAndButtonStylesHeaderRef = createRef();
        this.sidebarStylesRef = createRef();
        this.headerOverlayRef = createRef();
        this.centerChannelStylesRef = createRef();
        this.linkAndButtonStylesRef = createRef();

        const copyTheme = this.setCopyTheme(this.props.theme);

        this.state = {
            copyTheme,
        };
    }
    handleColorChange = (settingId: string, color: string) => {
        const {updateTheme, theme} = this.props;
        if (theme[settingId] !== color) {
            const newTheme: Theme = {
                ...theme,
                type: 'custom',
                [settingId]: color,
            };

            // For backwards compatability
            if (settingId === 'mentionBg') {
                newTheme.mentionBj = color;
            }

            updateTheme(newTheme);

            const copyTheme = this.setCopyTheme(newTheme);

            this.setState({
                copyTheme,
            });
        }
    };

    setCopyTheme(theme: Theme) {
        const copyTheme = Object.assign({}, theme);
        delete copyTheme.type;
        delete copyTheme.image;

        return JSON.stringify(copyTheme);
    }

    pasteBoxChange = (e: ClipboardEvent<HTMLTextAreaElement>) => {
        let text = '';

        if ((window as any).clipboardData && (window as any).clipboardData.getData) { // IE
            text = (window as any).clipboardData.getData('Text');
        } else {
            text = e.clipboardData.getData('Text');//e.clipboardData.getData('text/plain');
        }

        if (text.length === 0) {
            return;
        }

        let theme;
        try {
            theme = JSON.parse(text);
        } catch (err) {
            return;
        }

        theme = setThemeDefaults(theme);

        this.setState({
            copyTheme: JSON.stringify(theme),
        });

        theme.type = 'custom';
        this.props.updateTheme(theme);
    };

    onChangeHandle = (e: ChangeEvent<HTMLTextAreaElement>) => e.stopPropagation();

    selectTheme = () => {
        this.textareaRef.current?.focus();
        this.textareaRef.current?.setSelectionRange(0, this.state.copyTheme.length);
    };

    toggleSidebarStyles = (e: MouseEvent<HTMLDivElement>) => {
        e.preventDefault();

        this.sidebarStylesHeaderRef.current?.classList.toggle('open');
        this.toggleSection(this.sidebarStylesRef.current);
    };

    toggleCenterChannelStyles = (e: MouseEvent<HTMLDivElement>) => {
        e.preventDefault();

        this.centerChannelStylesHeaderRef.current?.classList.toggle('open');
        this.toggleSection(this.centerChannelStylesRef.current);
    };

    toggleLinkAndButtonStyles = (e: MouseEvent<HTMLDivElement>) => {
        e.preventDefault();

        this.linkAndButtonStylesHeaderRef.current?.classList.toggle('open');
        this.toggleSection(this.linkAndButtonStylesRef.current);
    };

    toggleSection(node: HTMLElement | null) {
        if (!node) {
            return;
        }
        node.classList.toggle('open');

        // set overflow after animation, so the colorchooser is fully shown
        node.ontransitionend = () => {
            if (node.classList.contains('open')) {
                node.style.overflowY = 'inherit';
            } else {
                node.style.overflowY = 'hidden';
            }
        };
    }

    onCodeThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const theme: Theme = {
            ...this.props.theme,
            type: 'custom',
            codeTheme: e.target.value,
        };

        this.props.updateTheme(theme);
    };

    copyTheme = () => {
        this.selectTheme();
        document.execCommand('copy');
        this.showCopySuccess();
    };

    showCopySuccess = () => {
        const copySuccess: HTMLElement | null = document.querySelector('.copy-theme-success');
        if (copySuccess) {
            copySuccess.style.display = 'inline-block';
            setTimeout(() => {
                copySuccess.style.display = 'none';
            }, COPY_SUCCESS_INTERVAL);
        }
    };

    render() {
        const theme = this.props.theme;

        const sidebarElements: JSX.Element[] = [];
        const centerChannelElements: JSX.Element[] = [];
        const linkAndButtonElements: JSX.Element[] = [];
        Constants.THEME_ELEMENTS.forEach((element, index) => {
            if (element.id === 'codeTheme') {
                const codeThemeOptions: JSX.Element[] = [];
                let codeThemeURL = '';

                element.themes?.forEach((codeTheme, codeThemeIndex) => {
                    if (codeTheme.id === theme[element.id]) {
                        codeThemeURL = codeTheme.iconURL;
                    }
                    codeThemeOptions.push(
                        <option
                            key={'code-theme-key' + codeThemeIndex}
                            value={codeTheme.id}
                        >
                            {codeTheme.uiName}
                        </option>,
                    );
                });

                const popoverContent = (
                    <Popover
                        popoverStyle='info'
                        id='code-popover'
                        className='code-popover'
                    >
                        <img
                            width='200'
                            alt={'code theme image'}
                            src={codeThemeURL}
                        />
                    </Popover>
                );

                centerChannelElements.push(
                    <div
                        className='col-sm-6 form-group'
                        key={'custom-theme-key' + index}
                    >
                        <label className='custom-label'>
                            <FormattedMessage {...messages[element.id]}/>
                        </label>
                        <div
                            className='input-group theme-group group--code dropdown'
                            id={element.id}
                        >
                            <select
                                id='codeThemeSelect'
                                className='form-control'
                                defaultValue={theme[element.id]}
                                onChange={this.onCodeThemeChange}
                            >
                                {codeThemeOptions}
                            </select>
                            <OverlayTrigger
                                placement='top'
                                overlay={popoverContent}
                                ref={this.headerOverlayRef}
                            >
                                <span className='input-group-addon'>
                                    <img
                                        alt={'code theme image'}
                                        src={codeThemeURL}
                                    />
                                </span>
                            </OverlayTrigger>
                        </div>
                    </div>,
                );
            } else if (element.group === 'centerChannelElements') {
                centerChannelElements.push(
                    <div
                        className='col-sm-6 form-group element'
                        key={'custom-theme-key' + index}
                    >
                        <ColorChooser
                            id={element.id}
                            label={<FormattedMessage {...messages[element.id]}/>}
                            value={theme[element.id] || ''}
                            onChange={this.handleColorChange}
                        />
                    </div>,
                );
            } else if (element.group === 'sidebarElements') {
                // Need to support old typo mentionBj element for mentionBg
                let color = theme[element.id];
                if (!color && element.id === 'mentionBg') {
                    color = theme.mentionBj;
                }

                sidebarElements.push(
                    <div
                        className='col-sm-6 form-group element'
                        key={'custom-theme-key' + index}
                    >
                        <ColorChooser
                            id={element.id}
                            label={<FormattedMessage {...messages[element.id]}/>}
                            value={color || ''}
                            onChange={this.handleColorChange}
                        />
                    </div>,
                );
            } else {
                linkAndButtonElements.push(
                    <div
                        className='col-sm-6 form-group element'
                        key={'custom-theme-key' + index}
                    >
                        <ColorChooser
                            id={element.id}
                            label={<FormattedMessage {...messages[element.id]}/>}
                            value={theme[element.id] || ''}
                            onChange={this.handleColorChange}
                        />
                    </div>,
                );
            }
        });

        const pasteBox = (
            <div className='col-sm-12'>
                <label className='custom-label'>
                    <FormattedMessage
                        id='user.settings.custom_theme.copyPaste'
                        defaultMessage='Copy to share or paste theme colors here:'
                    />
                </label>
                <textarea
                    ref={this.textareaRef}
                    className='form-control'
                    id='pasteBox'
                    value={this.state.copyTheme}
                    onCopy={this.showCopySuccess}
                    onPaste={this.pasteBoxChange}
                    onChange={this.onChangeHandle}
                    onClick={this.selectTheme}
                />
                <div className='mt-3'>
                    <button
                        className='btn btn-link copy-theme-button'
                        onClick={this.copyTheme}
                    >
                        <FormattedMessage
                            id='user.settings.custom_theme.copyThemeColors'
                            defaultMessage='Copy Theme Colors'
                        />
                    </button>
                    <span
                        className='alert alert-success copy-theme-success'
                        role='alert'
                        style={{display: 'none'}}
                    >
                        <FormattedMessage
                            id='user.settings.custom_theme.copied'
                            defaultMessage='✔ Copied'
                        />
                    </span>
                </div>
            </div>
        );

        return (
            <div className='appearance-section pt-2'>
                <div className='theme-elements row'>
                    <div
                        ref={this.sidebarStylesHeaderRef}
                        id='sidebarStyles'
                        className='theme-elements__header'
                        onClick={this.toggleSidebarStyles}
                    >
                        <FormattedMessage
                            id='user.settings.custom_theme.sidebarTitle'
                            defaultMessage='Sidebar Styles'
                        />
                        <div className='header__icon'>
                            <LocalizedIcon
                                className='fa fa-plus'
                                title={{id: t('generic_icons.expand'), defaultMessage: 'Expand Icon'}}
                            />
                            <LocalizedIcon
                                className='fa fa-minus'
                                title={{id: t('generic_icons.collapse'), defaultMessage: 'Collapse Icon'}}
                            />
                        </div>
                    </div>
                    <div
                        ref={this.sidebarStylesRef}
                        className='theme-elements__body'
                    >
                        {sidebarElements}
                    </div>
                </div>
                <div className='theme-elements row'>
                    <div
                        ref={this.centerChannelStylesHeaderRef}
                        id='centerChannelStyles'
                        className='theme-elements__header'
                        onClick={this.toggleCenterChannelStyles}
                    >
                        <FormattedMessage
                            id='user.settings.custom_theme.centerChannelTitle'
                            defaultMessage='Center Channel Styles'
                        />
                        <div className='header__icon'>
                            <LocalizedIcon
                                className='fa fa-plus'
                                title={{id: t('generic_icons.expand'), defaultMessage: 'Expand Icon'}}
                            />
                            <LocalizedIcon
                                className='fa fa-minus'
                                title={{id: t('generic_icons.collapse'), defaultMessage: 'Collapse Icon'}}
                            />
                        </div>
                    </div>
                    <div
                        ref={this.centerChannelStylesRef}
                        id='centerChannelStyles'
                        className='theme-elements__body'
                    >
                        {centerChannelElements}
                    </div>
                </div>
                <div className='theme-elements row'>
                    <div
                        ref={this.linkAndButtonStylesHeaderRef}
                        id='linkAndButtonsStyles'
                        className='theme-elements__header'
                        onClick={this.toggleLinkAndButtonStyles}
                    >
                        <FormattedMessage
                            id='user.settings.custom_theme.linkButtonTitle'
                            defaultMessage='Link and Button Styles'
                        />
                        <div className='header__icon'>
                            <LocalizedIcon
                                className='fa fa-plus'
                                title={{id: t('generic_icons.expand'), defaultMessage: 'Expand Icon'}}
                            />
                            <LocalizedIcon
                                className='fa fa-minus'
                                title={{id: t('generic_icons.collapse'), defaultMessage: 'Collapse Icon'}}
                            />
                        </div>
                    </div>
                    <div
                        ref={this.linkAndButtonStylesRef}
                        className='theme-elements__body'
                    >
                        {linkAndButtonElements}
                    </div>
                </div>
                <div className='row mt-3'>
                    {pasteBox}
                </div>
            </div>
        );
    }
}
