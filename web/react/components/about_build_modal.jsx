// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
var Modal = ReactBootstrap.Modal;

const messages = defineMessages({
    number: {
        id: 'about.number',
        defaultMessage: 'Build Number:'
    },
    date: {
        id: 'about.date',
        defaultMessage: 'Build Date:'
    },
    hash: {
        id: 'about.hash',
        defaultMessage: 'Build Hash:'
    },
    close: {
        id: 'about.close',
        defaultMessage: 'Close'
    },
    name: {
        id: 'about.name',
        defaultMessage: 'Mattermost'
    }
});

class AboutBuildModal extends React.Component {
    constructor(props) {
        super(props);
        this.doHide = this.doHide.bind(this);
    }

    doHide() {
        this.props.onModalDismissed();
    }

    render() {
        const {formatMessage} = this.props.intl;

        const config = global.window.mm_config;

        return (
            <Modal
                show={this.props.show}
                onHide={this.doHide}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>{`${formatMessage(messages.name)} ${config.Version}`}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className='row form-group'>
                        <div className='col-sm-3 info__label'>{formatMessage(messages.number)}</div>
                        <div className='col-sm-9'>{config.BuildNumber}</div>
                    </div>
                    <div className='row form-group'>
                        <div className='col-sm-3 info__label'>{formatMessage(messages.date)}</div>
                        <div className='col-sm-9'>{config.BuildDate}</div>
                    </div>
                    <div className='row form-group'>
                        <div className='col-sm-3 info__label'>{formatMessage(messages.hash)}</div>
                        <div className='col-sm-9'>{config.BuildHash}</div>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={this.doHide}
                    >
                        {formatMessage(messages.close)}
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}

AboutBuildModal.defaultProps = {
    show: false
};

AboutBuildModal.propTypes = {
    show: React.PropTypes.bool.isRequired,
    onModalDismissed: React.PropTypes.func.isRequired,
    intl: intlShape.isRequired
};

export default injectIntl(AboutBuildModal);