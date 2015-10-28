// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../../stores/user_store.jsx');
var Client = require('../../utils/client.jsx');
var Utils = require('../../utils/utils.jsx');

const CustomThemeChooser = require('./custom_theme_chooser.jsx');
const PremadeThemeChooser = require('./premade_theme_chooser.jsx');
const CodeThemeChooser = require('./code_theme_chooser.jsx');
const AppDispatcher = require('../../dispatcher/app_dispatcher.jsx');
const Constants = require('../../utils/constants.jsx');
const ActionTypes = Constants.ActionTypes;

export default class UserSettingsAppearance extends React.Component {
    constructor(props) {
        super(props);

        this.onChange = this.onChange.bind(this);
        this.submitTheme = this.submitTheme.bind(this);
        this.updateTheme = this.updateTheme.bind(this);
        this.updateCodeTheme = this.updateCodeTheme.bind(this);
        this.handleClose = this.handleClose.bind(this);
        this.handleImportModal = this.handleImportModal.bind(this);

        this.state = this.getStateFromStores();

        this.originalTheme = this.state.theme;
        this.originalCodeTheme = this.state.theme.codeTheme;
    }
    componentDidMount() {
        UserStore.addChangeListener(this.onChange);

        if (this.props.activeSection === 'theme') {
            $(ReactDOM.findDOMNode(this.refs[this.state.theme])).addClass('active-border');
        }
        $('#user_settings').on('hidden.bs.modal', this.handleClose);
    }
    componentDidUpdate() {
        if (this.props.activeSection === 'theme') {
            $('.color-btn').removeClass('active-border');
            $(ReactDOM.findDOMNode(this.refs[this.state.theme])).addClass('active-border');
        }
    }
    componentWillUnmount() {
        UserStore.removeChangeListener(this.onChange);
        $('#user_settings').off('hidden.bs.modal', this.handleClose);
    }
    getStateFromStores() {
        const user = UserStore.getCurrentUser();
        let theme = null;

        if ($.isPlainObject(user.theme_props) && !$.isEmptyObject(user.theme_props)) {
            theme = user.theme_props;
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

        if (!Utils.areStatesEqual(this.state, newState)) {
            this.setState(newState);
        }
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

                $('#user_settings').off('hidden.bs.modal', this.handleClose);
                this.props.updateTab('general');
                $('.ps-container.modal-body').scrollTop(0);
                $('.ps-container.modal-body').perfectScrollbar('update');
                $('#user_settings').modal('hide');
            },
            (err) => {
                var state = this.getStateFromStores();
                state.serverError = err;
                this.setState(state);
            }
        );
    }
    updateTheme(theme) {
        if (!theme.codeTheme) {
            theme.codeTheme = this.state.theme.codeTheme;
        }
        this.setState({theme});
        Utils.applyTheme(theme);
    }
    updateCodeTheme(codeTheme) {
        var theme = this.state.theme;
        theme.codeTheme = codeTheme;
        this.setState({theme});
        Utils.applyTheme(theme);
    }
    updateType(type) {
        this.setState({type});
    }
    handleClose() {
        const state = this.getStateFromStores();
        state.serverError = null;
        state.theme.codeTheme = this.originalCodeTheme;

        Utils.applyTheme(state.theme);

        this.setState(state);

        $('.ps-container.modal-body').scrollTop(0);
        $('.ps-container.modal-body').perfectScrollbar('update');
        $('#user_settings').modal('hide');
    }
    handleImportModal() {
        $('#user_settings').modal('hide');
        AppDispatcher.handleViewAction({
            type: ActionTypes.TOGGLE_IMPORT_THEME_MODAL,
            value: true
        });
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
                    <strong className='radio'>{'Code Theme'}</strong>
                    <CodeThemeChooser
                        theme={this.state.theme}
                        updateTheme={this.updateCodeTheme}
                    />
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
                        onClick={this.handleClose}
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
                        data-dismiss='modal'
                        aria-label='Close'
                    >
                        <span aria-hidden='true'>{'×'}</span>
                    </button>
                    <h4
                        className='modal-title'
                        ref='title'
                    >
                        <i className='modal-back'></i>{'Appearance Settings'}
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
    updateTab: React.PropTypes.func
};
