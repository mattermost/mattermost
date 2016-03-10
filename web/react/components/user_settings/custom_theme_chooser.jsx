// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Constants from '../../utils/constants.jsx';

const OverlayTrigger = ReactBootstrap.OverlayTrigger;
const Popover = ReactBootstrap.Popover;

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'mm-intl';

const messages = defineMessages({
    sidebarBg: {
        id: 'user.settings.custom_theme.sidebarBg',
        defaultMessage: 'Sidebar BG'
    },
    sidebarText: {
        id: 'user.settings.custom_theme.sidebarText',
        defaultMessage: 'Sidebar Text'
    },
    sidebarHeaderBg: {
        id: 'user.settings.custom_theme.sidebarHeaderBg',
        defaultMessage: 'Sidebar Header BG'
    },
    sidebarHeaderTextColor: {
        id: 'user.settings.custom_theme.sidebarHeaderTextColor',
        defaultMessage: 'Sidebar Header Text'
    },
    sidebarUnreadText: {
        id: 'user.settings.custom_theme.sidebarUnreadText',
        defaultMessage: 'Sidebar Unread Text'
    },
    sidebarTextHoverBg: {
        id: 'user.settings.custom_theme.sidebarTextHoverBg',
        defaultMessage: 'Sidebar Text Hover BG'
    },
    sidebarTextActiveBorder: {
        id: 'user.settings.custom_theme.sidebarTextActiveBorder',
        defaultMessage: 'Sidebar Text Active Border'
    },
    sidebarTextActiveColor: {
        id: 'user.settings.custom_theme.sidebarTextActiveColor',
        defaultMessage: 'Sidebar Text Active Color'
    },
    onlineIndicator: {
        id: 'user.settings.custom_theme.onlineIndicator',
        defaultMessage: 'Online Indicator'
    },
    awayIndicator: {
        id: 'user.settings.custom_theme.awayIndicator',
        defaultMessage: 'Away Indicator'
    },
    mentionBj: {
        id: 'user.settings.custom_theme.mentionBj',
        defaultMessage: 'Mention Jewel BG'
    },
    mentionColor: {
        id: 'user.settings.custom_theme.mentionColor',
        defaultMessage: 'Mention Jewel Text'
    },
    centerChannelBg: {
        id: 'user.settings.custom_theme.centerChannelBg',
        defaultMessage: 'Center Channel BG'
    },
    centerChannelColor: {
        id: 'user.settings.custom_theme.centerChannelColor',
        defaultMessage: 'Center Channel Text'
    },
    newMessageSeparator: {
        id: 'user.settings.custom_theme.newMessageSeparator',
        defaultMessage: 'New Message Separator'
    },
    linkColor: {
        id: 'user.settings.custom_theme.linkColor',
        defaultMessage: 'Link Color'
    },
    buttonBg: {
        id: 'user.settings.custom_theme.buttonBg',
        defaultMessage: 'Button BG'
    },
    buttonColor: {
        id: 'user.settings.custom_theme.buttonColor',
        defaultMessage: 'Button Text'
    },
    mentionHighlightBg: {
        id: 'user.settings.custom_theme.mentionHighlightBg',
        defaultMessage: 'Mention Highlight BG'
    },
    mentionHighlightLink: {
        id: 'user.settings.custom_theme.mentionHighlightLink',
        defaultMessage: 'Mention Highlight Link'
    },
    codeTheme: {
        id: 'user.settings.custom_theme.codeTheme',
        defaultMessage: 'Code Theme'
    }
});

class CustomThemeChooser extends React.Component {
    constructor(props) {
        super(props);

        this.onPickerChange = this.onPickerChange.bind(this);
        this.onInputChange = this.onInputChange.bind(this);
        this.pasteBoxChange = this.pasteBoxChange.bind(this);
        this.toggleContent = this.toggleContent.bind(this);

        this.state = {};
    }
    componentDidMount() {
        $('.color-picker').colorpicker({
            format: 'hex'
        });
        $('.color-picker').on('changeColor', this.onPickerChange);
    }
    componentDidUpdate() {
        const theme = this.props.theme;
        Constants.THEME_ELEMENTS.forEach((element) => {
            if (theme.hasOwnProperty(element.id) && element.id !== 'codeTheme') {
                $('#' + element.id).data('colorpicker').color.setColor(theme[element.id]);
                $('#' + element.id).colorpicker('update');
            }
        });
    }
    onPickerChange(e) {
        const theme = this.props.theme;
        theme[e.target.id] = e.color.toHex();
        theme.type = 'custom';
        this.props.updateTheme(theme);
    }
    onInputChange(e) {
        const theme = this.props.theme;
        theme[e.target.parentNode.id] = e.target.value;
        theme.type = 'custom';
        this.props.updateTheme(theme);
    }
    pasteBoxChange(e) {
        const text = e.target.value;

        if (text.length === 0) {
            return;
        }

        const colors = text.split(',');

        const theme = {type: 'custom'};
        let index = 0;
        Constants.THEME_ELEMENTS.forEach((element) => {
            if (index < colors.length - 1) {
                theme[element.id] = colors[index];
            }
            index++;
        });
        theme.codeTheme = colors[colors.length - 1];

        this.props.updateTheme(theme);
    }
    toggleContent(e) {
        e.stopPropagation();
        if ($(e.target).hasClass('theme-elements__header')) {
            $(e.target).next().slideToggle();
            $(e.target).toggleClass('open');
        } else {
            $(e.target).closest('.theme-elements__header').next().slideToggle();
            $(e.target).closest('.theme-elements__header').toggleClass('open');
        }
    }
    render() {
        const {formatMessage} = this.props.intl;
        const theme = this.props.theme;

        const sidebarElements = [];
        const centerChannelElements = [];
        const linkAndButtonElements = [];
        let colors = '';
        Constants.THEME_ELEMENTS.forEach((element, index) => {
            if (element.id === 'codeTheme') {
                const codeThemeOptions = [];

                element.themes.forEach((codeTheme, codeThemeIndex) => {
                    codeThemeOptions.push(
                        <option
                            key={'code-theme-key' + codeThemeIndex}
                            value={codeTheme.id}
                        >
                            {codeTheme.uiName}
                        </option>
                    );
                });

                var popoverContent = (
                    <Popover
                        bsStyle='info'
                        id='code-popover'
                        className='code-popover'
                    >
                        <img
                            width='200'
                            src={'/static/images/themes/code_themes/' + theme[element.id] + '.png'}
                        />
                    </Popover>
                );

                centerChannelElements.push(
                    <div
                        className='col-sm-6 form-group'
                        key={'custom-theme-key' + index}
                    >
                        <label className='custom-label'>{formatMessage(messages[element.id])}</label>
                        <div
                            className='input-group theme-group group--code dropdown'
                            id={element.id}
                        >
                            <select
                                className='form-control'
                                type='text'
                                value={theme[element.id]}
                                onChange={this.onInputChange}
                            >
                                {codeThemeOptions}
                            </select>
                            <OverlayTrigger
                                placement='top'
                                overlay={popoverContent}
                                ref='headerOverlay'
                            >
                            <span className='input-group-addon'>
                                <img
                                    src={'/static/images/themes/code_themes/' + theme[element.id] + '.png'}
                                />
                            </span>
                            </OverlayTrigger>
                        </div>
                    </div>
                );
            } else if (element.group === 'centerChannelElements') {
                centerChannelElements.push(
                    <div
                        className='col-sm-6 form-group element'
                        key={'custom-theme-key' + index}
                    >
                        <label className='custom-label'>{formatMessage(messages[element.id])}</label>
                        <div
                            className='input-group color-picker'
                            id={element.id}
                        >
                            <input
                                className='form-control'
                                type='text'
                                value={theme[element.id]}
                                onChange={this.onInputChange}
                            />
                            <span className='input-group-addon'><i></i></span>
                        </div>
                    </div>
                );

                colors += theme[element.id] + ',';
            } else if (element.group === 'sidebarElements') {
                sidebarElements.push(
                    <div
                        className='col-sm-6 form-group element'
                        key={'custom-theme-key' + index}
                    >
                        <label className='custom-label'>{formatMessage(messages[element.id])}</label>
                        <div
                            className='input-group color-picker'
                            id={element.id}
                        >
                            <input
                                className='form-control'
                                type='text'
                                value={theme[element.id]}
                                onChange={this.onInputChange}
                            />
                            <span className='input-group-addon'><i></i></span>
                        </div>
                    </div>
                );

                colors += theme[element.id] + ',';
            } else {
                linkAndButtonElements.push(
                    <div
                        className='col-sm-6 form-group element'
                        key={'custom-theme-key' + index}
                    >
                        <label className='custom-label'>{formatMessage(messages[element.id])}</label>
                        <div
                            className='input-group color-picker'
                            id={element.id}
                        >
                            <input
                                className='form-control'
                                type='text'
                                value={theme[element.id]}
                                onChange={this.onInputChange}
                            />
                            <span className='input-group-addon'><i></i></span>
                        </div>
                    </div>
                );

                colors += theme[element.id] + ',';
            }
        });

        colors += theme.codeTheme;

        const pasteBox = (
            <div className='col-sm-12'>
                <label className='custom-label'>
                    <FormattedMessage
                        id='user.settings.custom_theme.copyPaste'
                        defaultMessage='Copy and paste to share theme colors:'
                    />
                </label>
                <input
                    type='text'
                    className='form-control'
                    value={colors}
                    onChange={this.pasteBoxChange}
                />
            </div>
        );

        return (
            <div className='appearance-section padding-top'>
                <div className='theme-elements row'>
                    <div
                        className='theme-elements__header'
                        onClick={this.toggleContent}
                    >
                        {'Sidebar Styles'}
                        <div className='header__icon'>
                            <i className='fa fa-plus'></i>
                            <i className='fa fa-minus'></i>
                        </div>
                    </div>
                    <div className='theme-elements__body'>
                        {sidebarElements}
                    </div>
                </div>
                <div className='theme-elements row'>
                    <div
                        className='theme-elements__header'
                        onClick={this.toggleContent}
                    >
                        {'Center Channel Styles'}
                        <div className='header__icon'>
                            <i className='fa fa-plus'></i>
                            <i className='fa fa-minus'></i>
                        </div>
                    </div>
                    <div className='theme-elements__body'>
                        {centerChannelElements}
                    </div>
                </div>
                <div className='theme-elements row form-group'>
                    <div
                        className='theme-elements__header'
                        onClick={this.toggleContent}
                    >
                        {'Link and Button Styles'}
                        <div className='header__icon'>
                            <i className='fa fa-plus'></i>
                            <i className='fa fa-minus'></i>
                        </div>
                    </div>
                    <div className='theme-elements__body'>
                        {linkAndButtonElements}
                    </div>
                </div>
                <div className='row'>
                    {pasteBox}
                </div>
            </div>
        );
    }
}

CustomThemeChooser.propTypes = {
    intl: intlShape.isRequired,
    theme: React.PropTypes.object.isRequired,
    updateTheme: React.PropTypes.func.isRequired
};

export default injectIntl(CustomThemeChooser);
