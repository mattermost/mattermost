// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var Modal = ReactBootstrap.Modal;

import {FormattedMessage} from 'mm-intl';

export default class AboutBuildModal extends React.Component {
    constructor(props) {
        super(props);
        this.doHide = this.doHide.bind(this);
    }

    doHide() {
        this.props.onModalDismissed();
    }

    render() {
        const config = global.window.mm_config;
        const license = global.window.mm_license;

        let title = (
            <FormattedMessage
                id='about.teamEditiont0'
                defaultMessage='Team Edition T0'
            />
        );

        let licensee;
        if (config.BuildEnterpriseReady === 'true') {
            title = (
                <FormattedMessage
                    id='about.teamEditiont1'
                    defaultMessage='Team Edition T1'
                />
            );
            if (license.IsLicensed === 'true') {
                title = (
                    <FormattedMessage
                        id='about.enterpriseEditione1'
                        defaultMessage='Enterprise Edition E1'
                    />
                );
                licensee = (
                    <div className='row form-group'>
                        <div className='col-sm-3 info__label'>
                            <FormattedMessage
                                id='about.licensed'
                                defaultMessage='Licensed by:'
                            />
                        </div>
                        <div className='col-sm-9'>{license.Company}</div>
                    </div>
                );
            }
        }

        return (
            <Modal
                show={this.props.show}
                onHide={this.doHide}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>
                        <FormattedMessage
                            id='about.title'
                            defaultMessage='About Mattermost'
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <h4>{'Mattermost'} {title}</h4>
                    {licensee}
                    <div className='row form-group'>
                        <div className='col-sm-3 info__label'>
                            <FormattedMessage
                                id='about.version'
                                defaultMessage='Version:'
                            />
                        </div>
                        <div className='col-sm-9'>{config.Version}</div>
                    </div>
                    <div className='row form-group'>
                        <div className='col-sm-3 info__label'>
                            <FormattedMessage
                                id='about.number'
                                defaultMessage='Build Number:'
                            />
                        </div>
                        <div className='col-sm-9'>{config.BuildNumber}</div>
                    </div>
                    <div className='row form-group'>
                        <div className='col-sm-3 info__label'>
                            <FormattedMessage
                                id='about.date'
                                defaultMessage='Build Date:'
                            />
                        </div>
                        <div className='col-sm-9'>{config.BuildDate}</div>
                    </div>
                    <div className='row form-group'>
                        <div className='col-sm-3 info__label'>
                            <FormattedMessage
                                id='about.hash'
                                defaultMessage='Build Hash:'
                            />
                        </div>
                        <div className='col-sm-9'>{config.BuildHash}</div>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={this.doHide}
                    >
                        <FormattedMessage
                            id='about.close'
                            defaultMessage='Close'
                        />
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
    onModalDismissed: React.PropTypes.func.isRequired
};
