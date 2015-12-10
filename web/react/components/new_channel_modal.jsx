// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import * as Utils from '../utils/utils.jsx';
var Modal = ReactBootstrap.Modal;

const messages = defineMessages({
    displayNameError: {
        id: 'channel_modal.displayNameError',
        defaultMessage: 'This field is required'
    },
    group: {
        id: 'channel_modal.group',
        defaultMessage: 'Group'
    },
    privateGroup1: {
        id: 'channel_modal.privateGroup1',
        defaultMessage: 'Create a new private group with restricted membership. '
    },
    publicChannel1: {
        id: 'channel_modal.publicChannel1',
        defaultMessage: 'Create a public channel'
    },
    publicChannel2: {
        id: 'channel_modal.publicChannel2',
        defaultMessage: 'Create a new public channel anyone can join. '
    },
    privateGroup2: {
        id: 'channel_modal.privateGroup2',
        defaultMessage: 'Create a private group'
    },
    channel: {
        id: 'channel_modal.channel',
        defaultMessage: 'Channel'
    },
    modalTitle: {
        id: 'channel_modal.modalTitle',
        defaultMessage: 'New '
    },
    name: {
        id: 'channel_modal.name',
        defaultMessage: 'Name'
    },
    edit: {
        id: 'channel_modal.edit',
        defaultMessage: 'Edit'
    },
    description: {
        id: 'channel_modal.description',
        defaultMessage: 'Purpose'
    },
    optional: {
        id: 'channel_modal.optional',
        defaultMessage: '(optional)'
    },
    descriptionHelp1: {
        id: 'channel_modal.descriptionHelp1',
        defaultMessage: 'Describe how this '
    },
    descriptionHelp2: {
        id: 'channel_modal.descriptionHelp2',
        defaultMessage: ' should be used.'
    },
    cancel: {
        id: 'channel_modal.cancel',
        defaultMessage: 'Cancel'
    },
    createNew: {
        id: 'channel_modal.createNew',
        defaultMessage: 'Create New '
    }
});

class NewChannelModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleChange = this.handleChange.bind(this);

        this.state = {
            displayNameError: ''
        };
    }
    componentWillReceiveProps(nextProps) {
        if (nextProps.show === true && this.props.show === false) {
            this.setState({
                displayNameError: ''
            });
        }
    }
    handleSubmit(e) {
        e.preventDefault();

        const {formatMessage} = this.props.intl;
        const displayName = ReactDOM.findDOMNode(this.refs.display_name).value.trim();
        if (displayName.length < 1) {
            this.setState({displayNameError: formatMessage(messages.displayNameError)});
            return;
        }

        this.props.onSubmitChannel();
    }
    handleChange() {
        const newData = {
            displayName: ReactDOM.findDOMNode(this.refs.display_name).value,
            purpose: ReactDOM.findDOMNode(this.refs.channel_purpose).value
        };
        this.props.onDataChanged(newData);
    }
    render() {
        const {formatMessage} = this.props.intl;
        var displayNameError = null;
        var serverError = null;
        var displayNameClass = 'form-group';

        if (this.state.displayNameError) {
            displayNameError = <p className='input__help error'>{this.state.displayNameError}</p>;
            displayNameClass += ' has-error';
        }

        if (this.props.serverError) {
            serverError = <div className='form-group has-error'><p className='input__help error'>{this.props.serverError}</p></div>;
        }

        var channelTerm = '';
        var channelSwitchText = '';
        switch (this.props.channelType) {
        case 'P':
            channelTerm = formatMessage(messages.group);
            channelSwitchText = (
                <div className='modal-intro'>
                    {formatMessage(messages.privateGroup1)}
                    <a
                        href='#'
                        onClick={this.props.onTypeSwitched}
                    >
                        {formatMessage(messages.publicChannel1)}
                    </a>
                </div>
            );
            break;
        case 'O':
            channelTerm = formatMessage(messages.channel);
            channelSwitchText = (
                <div className='modal-intro'>
                    {formatMessage(messages.publicChannel2)}
                    <a
                        href='#'
                        onClick={this.props.onTypeSwitched}
                    >
                        {formatMessage(messages.privateGroup2)}
                    </a>
                </div>
            );
            break;
        }

        const prettyTeamURL = Utils.getShortenedTeamURL();

        return (
            <span>
                <Modal
                    show={this.props.show}
                    bsSize='large'
                    onHide={this.props.onModalDismissed}
                >
                    <Modal.Header closeButton={true}>
                        <Modal.Title>{formatMessage(messages.modalTitle) + channelTerm}</Modal.Title>
                    </Modal.Header>
                    <form
                        role='form'
                        className='form-horizontal'
                    >
                        <Modal.Body>
                            <div>
                                {channelSwitchText}
                            </div>
                            <div className={displayNameClass}>
                                <label className='col-sm-3 form__label control-label'>{formatMessage(messages.name)}</label>
                                <div className='col-sm-9'>
                                    <input
                                        onChange={this.handleChange}
                                        type='text'
                                        ref='display_name'
                                        className='form-control'
                                        placeholder='E.g.: "Bugs", "Marketing", "办公室恋情"'
                                        maxLength='22'
                                        value={this.props.channelData.displayName}
                                        autoFocus={true}
                                        tabIndex='1'
                                    />
                                    {displayNameError}
                                    <p className='input__help dark'>
                                        {'URL: ' + prettyTeamURL + this.props.channelData.name + ' ('}
                                        <a
                                            href='#'
                                            onClick={this.props.onChangeURLPressed}
                                        >
                                            {formatMessage(messages.edit)}
                                        </a>
                                        {')'}
                                    </p>
                                </div>
                            </div>
                            <div className='form-group less'>
                                <div className='col-sm-3'>
                                    <label className='form__label control-label'>{formatMessage(messages.description)}</label>
                                    <label className='form__label light'>{formatMessage(messages.optional)}</label>
                                </div>
                                <div className='col-sm-9'>
                                    <textarea
                                        className='form-control no-resize'
                                        ref='channel_purpose'
                                        rows='4'
                                        placeholder='Purpose'
                                        maxLength='128'
                                        value={this.props.channelData.purpose}
                                        onChange={this.handleChange}
                                        tabIndex='2'
                                    />
                                    <p className='input__help'>
                                        {formatMessage(messages.descriptionHelp1) + channelTerm + formatMessage(messages.descriptionHelp2)}
                                    </p>
                                    {serverError}
                                </div>
                            </div>
                        </Modal.Body>
                        <Modal.Footer>
                            <button
                                type='button'
                                className='btn btn-default'
                                onClick={this.props.onModalDismissed}
                            >
                                {formatMessage(messages.cancel)}
                            </button>
                            <button
                                onClick={this.handleSubmit}
                                type='submit'
                                className='btn btn-primary'
                                tabIndex='3'
                            >
                                {formatMessage(messages.createNew) + channelTerm}
                            </button>
                        </Modal.Footer>
                    </form>
                </Modal>
            </span>
        );
    }
}

NewChannelModal.defaultProps = {
    show: false,
    channelType: 'O',
    serverError: ''
};
NewChannelModal.propTypes = {
    intl: intlShape.isRequired,
    show: React.PropTypes.bool.isRequired,
    channelType: React.PropTypes.string.isRequired,
    channelData: React.PropTypes.object.isRequired,
    serverError: React.PropTypes.string,
    onSubmitChannel: React.PropTypes.func.isRequired,
    onModalDismissed: React.PropTypes.func.isRequired,
    onTypeSwitched: React.PropTypes.func.isRequired,
    onChangeURLPressed: React.PropTypes.func.isRequired,
    onDataChanged: React.PropTypes.func.isRequired
};

export default injectIntl(NewChannelModal);