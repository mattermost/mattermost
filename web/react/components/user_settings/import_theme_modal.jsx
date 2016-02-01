// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ModalStore from '../../stores/modal_store.jsx';
import UserStore from '../../stores/user_store.jsx';
import * as Utils from '../../utils/utils.jsx';
import * as Client from '../../utils/client.jsx';
const Modal = ReactBootstrap.Modal;

import AppDispatcher from '../../dispatcher/app_dispatcher.jsx';
import Constants from '../../utils/constants.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'mm-intl';

const holders = defineMessages({
    submitError: {
        id: 'user.settings.import_theme.submitError',
        defaultMessage: 'Invalid format, please try copying and pasting in again.'
    }
});

const ActionTypes = Constants.ActionTypes;

class ImportThemeModal extends React.Component {
    constructor(props) {
        super(props);

        this.updateShow = this.updateShow.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleChange = this.handleChange.bind(this);

        this.state = {
            inputError: '',
            show: false
        };
    }
    componentDidMount() {
        ModalStore.addModalListener(ActionTypes.TOGGLE_IMPORT_THEME_MODAL, this.updateShow);
    }
    componentWillUnmount() {
        ModalStore.removeModalListener(ActionTypes.TOGGLE_IMPORT_THEME_MODAL, this.updateShow);
    }
    updateShow(show) {
        this.setState({show});
    }
    handleSubmit(e) {
        e.preventDefault();

        const text = ReactDOM.findDOMNode(this.refs.input).value;

        if (!this.isInputValid(text)) {
            this.setState({inputError: this.props.intl.formatMessage(holders.submitError)});
            return;
        }

        const colors = text.split(',');
        const theme = {type: 'custom'};

        theme.sidebarBg = colors[0];
        theme.sidebarText = colors[5];
        theme.sidebarUnreadText = colors[5];
        theme.sidebarTextHoverBg = colors[4];
        theme.sidebarTextActiveBorder = colors[2];
        theme.sidebarTextActiveColor = colors[3];
        theme.sidebarHeaderBg = colors[1];
        theme.sidebarHeaderTextColor = colors[5];
        theme.onlineIndicator = colors[6];
        theme.awayIndicator = '#E0B333';
        theme.mentionBj = colors[7];
        theme.mentionColor = '#ffffff';
        theme.centerChannelBg = '#ffffff';
        theme.centerChannelColor = '#333333';
        theme.newMessageSeparator = '#F80';
        theme.linkColor = '#2389d7';
        theme.buttonBg = '#26a970';
        theme.buttonColor = '#ffffff';
        theme.mentionHighlightBg = '#fff2bb';
        theme.mentionHighlightLink = '#2f81b7';
        theme.codeTheme = 'github';

        let user = UserStore.getCurrentUser();
        user.theme_props = theme;

        Client.updateUser(user,
            (data) => {
                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECIEVED_ME,
                    me: data
                });

                this.setState({show: false});
                Utils.applyTheme(theme);
            },
            (err) => {
                var state = this.getStateFromStores();
                state.serverError = err;
                this.setState(state);
            }
        );
    }
    isInputValid(text) {
        if (text.length === 0) {
            return false;
        }

        if (text.indexOf(' ') !== -1) {
            return false;
        }

        if (text.length > 0 && text.indexOf(',') === -1) {
            return false;
        }

        if (text.length > 0) {
            const colors = text.split(',');

            if (colors.length !== 8) {
                return false;
            }

            for (let i = 0; i < colors.length; i++) {
                if (colors[i].length !== 7 && colors[i].length !== 4) {
                    return false;
                }

                if (colors[i].charAt(0) !== '#') {
                    return false;
                }
            }
        }

        return true;
    }
    handleChange(e) {
        if (this.isInputValid(e.target.value)) {
            this.setState({inputError: null});
        } else {
            this.setState({inputError: this.props.intl.formatMessage(holders.submitError)});
        }
    }
    render() {
        return (
            <span>
                <Modal
                    show={this.state.show}
                    onHide={() => this.setState({show: false})}
                >
                    <Modal.Header closeButton={true}>
                        <Modal.Title>
                            <FormattedMessage
                                id='user.settings.import_theme.importHeader'
                                defaultMessage='Import Slack Theme'
                            />
                        </Modal.Title>
                    </Modal.Header>
                    <form
                        role='form'
                        className='form-horizontal'
                    >
                        <Modal.Body>
                            <p>
                                <FormattedMessage
                                    id='user.settings.import_theme.importBody'
                                    defaultMessage='To import a theme, go to a Slack team and look for “Preferences -> Sidebar Theme”. Open the custom theme option, copy the theme color values and paste them here:'
                                />
                            </p>
                            <div className='form-group less'>
                                <div className='col-sm-9'>
                                    <input
                                        ref='input'
                                        type='text'
                                        className='form-control'
                                        onChange={this.handleChange}
                                    />
                                    <div className='input__help'>
                                        {this.state.inputError}
                                    </div>
                                </div>
                            </div>
                        </Modal.Body>
                        <Modal.Footer>
                            <button
                                type='button'
                                className='btn btn-default'
                                onClick={() => this.setState({show: false})}
                            >
                                <FormattedMessage
                                    id='user.settings.import_theme.cancel'
                                    defaultMessage='Cancel'
                                />
                            </button>
                            <button
                                onClick={this.handleSubmit}
                                type='submit'
                                className='btn btn-primary'
                                tabIndex='3'
                            >
                                <FormattedMessage
                                    id='user.settings.import_theme.submit'
                                    defaultMessage='Submit'
                                />
                            </button>
                        </Modal.Footer>
                    </form>
                </Modal>
            </span>
        );
    }
}

ImportThemeModal.propTypes = {
    intl: intlShape.isRequired
};

export default injectIntl(ImportThemeModal);