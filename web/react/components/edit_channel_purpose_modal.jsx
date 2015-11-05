// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const AsyncClient = require('../utils/async_client.jsx');
const Client = require('../utils/client.jsx');
const Utils = require('../utils/utils.jsx');

const Modal = ReactBootstrap.Modal;

export default class EditChannelPurposeModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleHide = this.handleHide.bind(this);
        this.handleSave = this.handleSave.bind(this);

        this.state = {serverError: ''};
    }

    componentDidUpdate() {
        if (this.props.show) {
            $(ReactDOM.findDOMNode(this.refs.purpose)).focus();
        }
    }

    handleHide() {
        this.setState({serverError: ''});

        if (this.props.onModalDismissed) {
            this.props.onModalDismissed();
        }
    }

    handleSave() {
        if (!this.props.channel) {
            return;
        }

        const data = {
            channel_id: this.props.channel.id,
            channel_purpose: ReactDOM.findDOMNode(this.refs.purpose).value.trim()
        };

        Client.updateChannelPurpose(data,
            () => {
                AsyncClient.getChannel(this.props.channel.id);

                this.handleHide();
            },
            (err) => {
                if (err.message === 'Invalid channel_purpose parameter') {
                    this.setState({serverError: 'This channel purpose is too long, please enter a shorter one'});
                } else {
                    this.setState({serverError: err.message});
                }
            }
        );
    }

    render() {
        if (!this.props.show) {
            return null;
        }

        let serverError = null;
        if (this.state.serverError) {
            serverError = (
                <div className='form-group has-error'>
                    <br/>
                    <label className='control-label'>{this.state.serverError}</label>
                </div>
            );
        }

        let title = <span>{'Edit Purpose'}</span>;
        if (this.props.channel.display_name) {
            title = <span>{'Edit Purpose for '}<span className='name'>{this.props.channel.display_name}</span></span>;
        }

        return (
            <Modal
                className='modal-edit-channel-purpose'
                ref='modal'
                show={this.props.show}
                onHide={this.handleHide}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>
                        {title}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>{`Describe how this ${Utils.getChannelTerm(this.props.channel.channelType)} should be used.`}</p>
                    <textarea
                        ref='purpose'
                        className='form-control no-resize'
                        rows='6'
                        maxLength='128'
                        defaultValue={this.props.channel.purpose}
                    />
                    {serverError}
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={this.handleHide}
                    >
                        {'Cancel'}
                    </button>
                    <button
                        type='button'
                        className='btn btn-primary'
                        onClick={this.handleSave}
                    >
                        {'Save'}
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}

EditChannelPurposeModal.propTypes = {
    show: React.PropTypes.bool.isRequired,
    channel: React.PropTypes.object,
    onModalDismissed: React.PropTypes.func.isRequired
};
