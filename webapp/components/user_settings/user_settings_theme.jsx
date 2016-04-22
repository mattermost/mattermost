// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import ReactDOM from 'react-dom';
import CustomThemeChooser from './custom_theme_chooser.jsx';
import PremadeThemeChooser from './premade_theme_chooser.jsx';
import SettingItemMin from '../setting_item_min.jsx';
import SettingItemMax from '../setting_item_max.jsx';

import UserStore from 'stores/user_store.jsx';

import AppDispatcher from '../../dispatcher/app_dispatcher.jsx';
import Client from 'utils/web_client.jsx';
import * as Utils from 'utils/utils.jsx';

import Constants from 'utils/constants.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'react-intl';

const ActionTypes = Constants.ActionTypes;

const holders = defineMessages({
    themeTitle: {
        id: 'user.settings.display.theme.title',
        defaultMessage: 'Theme'
    },
    themeDescribe: {
        id: 'user.settings.display.theme.describe',
        defaultMessage: 'Open to manage your theme'
    }
});

import React from 'react';

export default class ThemeSetting extends React.Component {
    constructor(props) {
        super(props);

        this.onChange = this.onChange.bind(this);
        this.submitTheme = this.submitTheme.bind(this);
        this.updateTheme = this.updateTheme.bind(this);
        this.resetFields = this.resetFields.bind(this);
        this.handleImportModal = this.handleImportModal.bind(this);

        this.state = this.getStateFromStores();

        this.originalTheme = Object.assign({}, this.state.theme);
    }
    componentDidMount() {
        UserStore.addChangeListener(this.onChange);

        if (this.props.selected) {
            $(ReactDOM.findDOMNode(this.refs[this.state.theme])).addClass('active-border');
        }
    }
    componentDidUpdate() {
        if (this.props.selected) {
            $('.color-btn').removeClass('active-border');
            $(ReactDOM.findDOMNode(this.refs[this.state.theme])).addClass('active-border');
        }
    }
    componentWillReceiveProps(nextProps) {
        if (this.props.selected && !nextProps.selected) {
            this.resetFields();
        }
    }
    componentWillUnmount() {
        UserStore.removeChangeListener(this.onChange);

        if (this.props.selected) {
            const state = this.getStateFromStores();
            Utils.applyTheme(state.theme);
        }
    }
    getStateFromStores() {
        const user = UserStore.getCurrentUser();
        let theme = null;

        if ($.isPlainObject(user.theme_props) && !$.isEmptyObject(user.theme_props)) {
            theme = Object.assign({}, user.theme_props);
        } else {
            theme = $.extend(true, {}, Constants.THEMES.default);
        }

        let type = 'premade';
        if (theme.type === 'custom') {
            type = 'custom';
        }

        if (!theme.codeTheme) {
            theme.codeTheme = Constants.DEFAULT_CODE_THEME;
        }

        return {theme, type};
    }
    onChange() {
        const newState = this.getStateFromStores();

        if (!Utils.areObjectsEqual(this.state, newState)) {
            this.setState(newState);
        }

        this.props.setEnforceFocus(true);
    }
    scrollToTop() {
        $('.ps-container.modal-body').scrollTop(0);
    }
    submitTheme(e) {
        e.preventDefault();
        var user = UserStore.getCurrentUser();
        user.theme_props = this.state.theme;

        Client.updateUser(user,
            (data) => {
                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECEIVED_ME,
                    me: data
                });

                this.props.setRequireConfirm(false);
                this.originalTheme = Object.assign({}, this.state.theme);
                this.scrollToTop();
                this.props.updateSection('');
            },
            (err) => {
                var state = this.getStateFromStores();
                state.serverError = err;
                this.setState(state);
            }
        );
    }
    updateTheme(theme) {
        let themeChanged = this.state.theme.length === theme.length;
        if (!themeChanged) {
            for (const field in theme) {
                if (theme.hasOwnProperty(field)) {
                    if (this.state.theme[field] !== theme[field]) {
                        themeChanged = true;
                        break;
                    }
                }
            }
        }

        this.props.setRequireConfirm(themeChanged);

        this.setState({theme});
        Utils.applyTheme(theme);
    }
    updateType(type) {
        this.setState({type});
    }
    resetFields() {
        const state = this.getStateFromStores();
        state.serverError = null;
        this.setState(state);
        this.scrollToTop();

        Utils.applyTheme(state.theme);

        this.props.setRequireConfirm(false);
    }
    handleImportModal() {
        AppDispatcher.handleViewAction({
            type: ActionTypes.TOGGLE_IMPORT_THEME_MODAL,
            value: true
        });

        this.props.setEnforceFocus(false);
    }
    render() {
        const {formatMessage} = this.props.intl;

        var serverError;
        if (this.state.serverError) {
            serverError = this.state.serverError;
        }

        const displayCustom = this.state.type === 'custom';

        let custom;
        let premade;
        if (displayCustom) {
            custom = (
                <div key='customThemeChooser'>
                    <CustomThemeChooser
                        theme={this.state.theme}
                        updateTheme={this.updateTheme}
                    />
                </div>
            );
        } else {
            premade = (
                <div key='premadeThemeChooser'>
                    <br/>
                    <PremadeThemeChooser
                        theme={this.state.theme}
                        updateTheme={this.updateTheme}
                    />
                </div>
            );
        }

        let themeUI;
        if (this.props.selected) {
            let inputs = [];

            inputs.push(
                <div
                    className='radio'
                    key='premadeThemeColorLabel'
                >
                    <label>
                        <input type='radio'
                            checked={!displayCustom}
                            onChange={this.updateType.bind(this, 'premade')}
                        />
                        <FormattedMessage
                            id='user.settings.display.theme.themeColors'
                            defaultMessage='Theme Colors'
                        />
                    </label>
                    <br/>
                </div>
            );

            inputs.push(premade);

            inputs.push(
                <div
                    className='radio'
                    key='customThemeColorLabel'
                >
                    <label>
                        <input type='radio'
                            checked={displayCustom}
                            onChange={this.updateType.bind(this, 'custom')}
                        />
                        <FormattedMessage
                            id='user.settings.display.theme.customTheme'
                            defaultMessage='Custom Theme'
                        />
                    </label>
                </div>
            );

            inputs.push(custom);

            inputs.push(
                <div key='importSlackThemeButton'>
                    <br/>
                    <a
                        className='theme'
                        onClick={this.handleImportModal}
                    >
                        <FormattedMessage
                            id='user.settings.display.theme.import'
                            defaultMessage='Import theme colors from Slack'
                        />
                    </a>
                </div>
            );

            themeUI = (
                <SettingItemMax
                    inputs={inputs}
                    submit={this.submitTheme}
                    server_error={serverError}
                    width='full'
                    updateSection={(e) => {
                        this.props.updateSection('');
                        e.preventDefault();
                    }}
                />
            );
        } else {
            themeUI = (
                <SettingItemMin
                    title={formatMessage(holders.themeTitle)}
                    describe={formatMessage(holders.themeDescribe)}
                    updateSection={() => {
                        this.props.updateSection('theme');
                    }}
                />
            );
        }

        return themeUI;
    }
}

ThemeSetting.propTypes = {
    intl: intlShape.isRequired,
    selected: React.PropTypes.bool.isRequired,
    updateSection: React.PropTypes.func.isRequired,
    setRequireConfirm: React.PropTypes.func.isRequired,
    setEnforceFocus: React.PropTypes.func.isRequired
};

export default injectIntl(ThemeSetting);
