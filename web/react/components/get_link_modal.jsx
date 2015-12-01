// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const Modal = ReactBootstrap.Modal;

export default class GetLinkModal extends React.Component {
    constructor(props) {
        super(props);

        this.onHide = this.onHide.bind(this);

        this.copyLink = this.copyLink.bind(this);

        this.state = {
            copiedLink: false
        };
    }

    onHide() {
        this.setState({copiedLink: false});

        this.props.onHide();
    }

    copyLink() {
        var copyTextarea = $(ReactDOM.findDOMNode(this.refs.textarea));
        copyTextarea.select();

        try {
            var successful = document.execCommand('copy');
            if (successful) {
                this.setState({copiedLink: true});
            } else {
                this.setState({copiedLink: false});
            }
        } catch (err) {
            this.setState({copiedLink: false});
        }
    }

    render() {
        let helpText = null;
        if (this.props.helpText) {
            helpText = (
                <p>
                    {this.props.helpText}
                    <br />
                    <br />
                </p>
            );
        }

        let copyLink = null;
        if (document.queryCommandSupported('copy')) {
            copyLink = (
                <button
                    data-copy-btn='true'
                    type='button'
                    className='btn btn-primary pull-left'
                    onClick={this.copyLink}
                >
                    {'Copy Link'}
                </button>
            );
        }

        var copyLinkConfirm = null;
        if (this.state.copiedLink) {
            copyLinkConfirm = <p className='alert alert-success copy-link-confirm'><i className='fa fa-check'></i>{' Link copied to clipboard.'}</p>;
        }

        return (
            <Modal
                show={this.props.show}
                onHide={this.onHide}
            >
                <Modal.Header closeButton={true}>
                    <h4 className='modal-title'>{this.props.title}</h4>
                </Modal.Header>
                <Modal.Body>
                    {helpText}
                    <textarea
                        className='form-control no-resize min-height'
                        readOnly='true'
                        ref='textarea'
                        value={this.props.link}
                    />
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={this.onHide}
                    >
                        {'Close'}
                    </button>
                    {copyLink}
                    {copyLinkConfirm}
                </Modal.Footer>
            </Modal>
        );
    }
}

GetLinkModal.propTypes = {
    show: React.PropTypes.bool.isRequired,
    onHide: React.PropTypes.func.isRequired,
    title: React.PropTypes.string.isRequired,
    helpText: React.PropTypes.string,
    link: React.PropTypes.string.isRequired
};

GetLinkModal.defaultProps = {
    helpText: null
};
