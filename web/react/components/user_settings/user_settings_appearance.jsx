// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import CustomThemeChooser from './custom_theme_chooser.jsx';
import PremadeThemeChooser from './premade_theme_chooser.jsx';

import UserStore from '../../stores/user_store.jsx';

import AppDispatcher from '../../dispatcher/app_dispatcher.jsx';
import * as Client from '../../utils/client.jsx';
import * as Utils from '../../utils/utils.jsx';

import Constants from '../../utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;

export default class UserSettingsAppearance extends React.Component {
    constructor(props) {
        super(props);

        this.onChange = this.onChange.bind(this);
        this.submitTheme = this.submitTheme.bind(this);
        this.updateTheme = this.updateTheme.bind(this);
        this.deactivate = this.deactivate.bind(this);
        this.resetFields = this.resetFields.bind(this);
        this.handleImportModal = this.handleImportModal.bind(this);

        this.state = this.getStateFromStores();

        this.originalTheme = Object.assign({}, this.state.theme);
    }
    componentDidMount() {
        UserStore.addChangeListener(this.onChange);

        if (this.props.activeSection === 'theme') {
            $(ReactDOM.findDOMNode(this.refs[this.state.theme])).addClass('active-border');
        }
    }
    componentDidUpdate() {
        if (this.props.activeSection === 'theme') {
            $('.color-btn').removeClass('active-border');
            $(ReactDOM.findDOMNode(this.refs[this.state.theme])).addClass('active-border');
        }
    }
    componentWillUnmount() {
        UserStore.removeChangeListener(this.onChange);
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
        $('.ps-container.modal-body').perfectScrollbar('update');
    }
    submitTheme(e) {
        e.preventDefault();
        var user = UserStore.getCurrentUser();
        user.theme_props = this.state.theme;

        Client.updateUser(user,
            (data) => {
                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECIEVED_ME,
                    me: data
                });

                this.props.setRequireConfirm(false);
                this.originalTheme = Object.assign({}, this.state.theme);
                this.scrollToTop();
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
    deactivate() {
        const state = this.getStateFromStores();

        Utils.applyTheme(state.theme);
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
        var serverError;
        if (this.state.serverError) {
            serverError = this.state.serverError;
        }

        const displayCustom = this.state.type === 'custom';

        let custom;
        let premade;
        if (displayCustom) {
            custom = (
                <CustomThemeChooser
                    theme={this.state.theme}
                    updateTheme={this.updateTheme}
                />
            );
        } else {
            premade = (
                <PremadeThemeChooser
                    theme={this.state.theme}
                    updateTheme={this.updateTheme}
                />
            );
        }

        const themeUI = (
            <div className='section-max appearance-section'>
                <div className='col-sm-12'>
                    <div className='radio'>
                        <label>
                            <input type='radio'
                                checked={!displayCustom}
                                onChange={this.updateType.bind(this, 'premade')}
                            />
                            {'Theme Colors'}
                        </label>
                        <br/>
                    </div>
                    {premade}
                    <div className='radio'>
                        <label>
                            <input type='radio'
                                checked={displayCustom}
                                onChange={this.updateType.bind(this, 'custom')}
                            />
                            {'Custom Theme'}
                        </label>
                        <br/>
                    </div>
                    {custom}
                    <hr />
                    {serverError}
                    <a
                        className='btn btn-sm btn-primary'
                        href='#'
                        onClick={this.submitTheme}
                    >
                        {'Save'}
                    </a>
                    <a
                        className='btn btn-sm theme'
                        href='#'
                        onClick={this.resetFields}
                    >
                        {'Cancel'}
                    </a>
                </div>
            </div>
        );

        return (
            <div>
                <div className='modal-header'>
                    <button
                        type='button'
                        className='close'
                        aria-label='Close'
                        onClick={this.props.closeModal}
                    >
                        <span aria-hidden='true'>{'×'}</span>
                    </button>
                    <h4
                        className='modal-title'
                        ref='title'
                    >
                        <i
                            className='modal-back'
                            onClick={this.props.collapseModal}
                        />
                        {'Appearance Settings'}
                    </h4>
                </div>
                <div className='user-settings'>
                    <h3 className='tab-header'>{'Appearance Settings'}</h3>
                    <div className='divider-dark first'/>
                    {themeUI}
                    <div className='divider-dark'/>
                    <br/>
                    <a
                        className='theme'
                        onClick={this.handleImportModal}
                    >
                        {'Import theme colors from Slack'}
                    </a>
                </div>
            </div>
        );
    }
}

UserSettingsAppearance.defaultProps = {
    activeSection: ''
};
UserSettingsAppearance.propTypes = {
    activeSection: React.PropTypes.string,
    updateTab: React.PropTypes.func,
    closeModal: React.PropTypes.func.isRequired,
    collapseModal: React.PropTypes.func.isRequired,
    setRequireConfirm: React.PropTypes.func.isRequired,
    setEnforceFocus: React.PropTypes.func.isRequired
};
