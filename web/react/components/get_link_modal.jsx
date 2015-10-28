// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');

export default class GetLinkModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
        this.onShow = this.onShow.bind(this);
        this.onHide = this.onHide.bind(this);

        this.state = {copiedLink: false};
    }
    onShow(e) {
        var button = e.relatedTarget;
        this.setState({title: $(button).attr('data-title'), value: $(button).attr('data-value')});
    }
    onHide() {
        this.setState({copiedLink: false});
    }
    componentDidMount() {
        if (this.refs.modal) {
            $(ReactDOM.findDOMNode(this.refs.modal)).on('show.bs.modal', this.onShow);
            $(ReactDOM.findDOMNode(this.refs.modal)).on('hide.bs.modal', this.onHide);
        }
    }
    handleClick() {
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
        var currentUser = UserStore.getCurrentUser();

        let copyLink = null;
        if (document.queryCommandSupported('copy')) {
            copyLink = (
                <button
                    data-copy-btn='true'
                    type='button'
                    className='btn btn-primary pull-left'
                    onClick={this.handleClick}
                    data-clipboard-text={this.state.value}
                >
                    Copy Link
                </button>
            );
        }

        var copyLinkConfirm = null;
        if (this.state.copiedLink) {
            copyLinkConfirm = <p className='alert alert-success copy-link-confirm'><i className='fa fa-check'></i> Link copied to clipboard.</p>;
        }

        if (currentUser != null) {
            return (
                <div
                    className='modal fade'
                    ref='modal'
                    id='get_link'
                    tabIndex='-1'
                    role='dialog'
                    aria-hidden='true'
                >
                    <div className='modal-dialog'>
                        <div className='modal-content'>
                            <div className='modal-header'>
                                <button
                                    type='button'
                                    className='close'
                                    data-dismiss='modal'
                                    aria-label='Close'
                                >
                                    <span aria-hidden='true'>&times;</span>
                                </button>
                                <h4
                                    className='modal-title'
                                    id='myModalLabel'
                                >
                                    {this.state.title} Link
                                </h4>
                            </div>
                            <div className='modal-body'>
                                <p>
                                Send teammates the link below for them to sign-up to this team site.
                                <br /><br />
                                </p>
                                <textarea
                                    className='form-control no-resize min-height'
                                    readOnly='true'
                                    ref='textarea'
                                    value={this.state.value}
                                />
                                </div>
                                <div className='modal-footer'>
                                <button
                                    type='button'
                                    className='btn btn-default'
                                    data-dismiss='modal'
                                >
                                    Close
                                </button>
                                {copyLink}
                                {copyLinkConfirm}
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
        return <div/>;
    }
}
