// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var Modal = ReactBootstrap.Modal;

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

        let title = 'Team Edition';
        let licensee;
        if (config.BuildEnterpriseReady === 'true' && license.IsLicensed === 'true') {
            title = 'Enterprise Edition';
            licensee = (
                <div className='row form-group'>
                    <div className='col-sm-3 info__label'>{'Licensed by:'}</div>
                    <div className='col-sm-9'>{license.Company}</div>
                </div>
            );
        }

        return (
            <Modal
                show={this.props.show}
                onHide={this.doHide}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>{'About Mattermost'}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className='row form-group'>
                        <div className='col-sm-3 info__label'>{'Edition:'}</div>
                        <div className='col-sm-9'>{`Mattermost ${title}`}</div>
                    </div>
                    {licensee}
                    <div className='row form-group'>
                        <div className='col-sm-3 info__label'>{'Version:'}</div>
                        <div className='col-sm-9'>{config.Version}</div>
                    </div>
                    <div className='row form-group'>
                        <div className='col-sm-3 info__label'>{'Build Number:'}</div>
                        <div className='col-sm-9'>{config.BuildNumber}</div>
                    </div>
                    <div className='row form-group'>
                        <div className='col-sm-3 info__label'>{'Build Date:'}</div>
                        <div className='col-sm-9'>{config.BuildDate}</div>
                    </div>
                    <div className='row form-group'>
                        <div className='col-sm-3 info__label'>{'Build Hash:'}</div>
                        <div className='col-sm-9'>{config.BuildHash}</div>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-default'
                        onClick={this.doHide}
                    >
                        {'Close'}
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
