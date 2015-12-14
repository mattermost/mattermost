// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import * as Client from '../utils/client.jsx';
import Constants from '../utils/constants.jsx';
import * as Utils from '../utils/utils.jsx';

const Modal = ReactBootstrap.Modal;

export default class EditChannelHeaderModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);

        this.onShow = this.onShow.bind(this);
        this.onHide = this.onHide.bind(this);

        this.state = {
            header: props.channel.header,
            serverError: ''
        };
    }

    componentDidMount() {
        if (this.props.show) {
            this.onShow();
        }
    }

    componentWillReceiveProps(nextProps) {
        if (this.props.channel.header !== nextProps.channel.header) {
            this.setState({
                header: nextProps.channel.header
            });
        }
    }

    componentDidUpdate(prevProps) {
        if (this.props.show && !prevProps.show) {
            this.onShow();
        }
    }

    handleChange(e) {
        this.setState({
            header: e.target.value
        });
    }

    handleSubmit() {
        Client.updateChannelHeader(
            this.props.channel.id,
            this.state.header,
            (channel) => {
                this.setState({serverError: ''});
                this.onHide();

                AppDispatcher.handleServerAction({
                    type: Constants.ActionTypes.RECIEVED_CHANNEL,
                    channel
                });
            },
            (err) => {
                if (err.message === 'Invalid channel_header parameter') {
                    this.setState({serverError: 'This channel header is too long, please enter a shorter one'});
                } else {
                    this.setState({serverError: err.message});
                }
            }
        );
    }

    onShow() {
        const textarea = ReactDOM.findDOMNode(this.refs.textarea);
        Utils.placeCaretAtEnd(textarea);
    }

    onHide() {
        this.setState({
            serverError: '',
            header: this.props.channel.header
        });

        this.props.onHide();
    }

    render() {
        var serverError = null;
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><br/><label className='control-label'>{this.state.serverError}</label></div>;
        }

        return (
            <Modal
                show={this.props.show}
                onHide={this.onHide}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>{'Edit Header for ' + this.props.channel.display_name}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>{'Edit the text appearing next to the channel name in the channel header.'}</p>
                    <textarea
                        ref='textarea'
                        className='form-control no-resize'
                        rows='6'
                        id='edit_header'
                        maxLength='1024'
                        value={this.state.header}
                        onChange={this.handleChange}
                    />
                    {serverError}
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={this.onHide}
                    >
                        {'Cancel'}
                    </button>
                    <button
                        type='button'
                        className='btn btn-primary'
                        onClick={this.handleSubmit}
                    >
                        {'Save'}
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}

EditChannelHeaderModal.propTypes = {
    show: React.PropTypes.bool.isRequired,
    onHide: React.PropTypes.func.isRequired,
    channel: React.PropTypes.object.isRequired
};
