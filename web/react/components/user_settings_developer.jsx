// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var SettingItemMin = require('./setting_item_min.jsx');
var SettingItemMax = require('./setting_item_max.jsx');

export default class DeveloperTab extends React.Component {
    constructor(props) {
        super(props);

        this.state = {};
    }
    register() {
        $('#user_settings1').modal('hide');
        $('#register_app').modal('show');
    }
    render() {
        var appSection;
        var self = this;
        if (this.props.activeSection === 'app') {
            var inputs = [];

            inputs.push(
                <div className='form-group'>
                    <div className='col-sm-7'>
                        <a
                            className='btn btn-sm btn-primary'
                            onClick={this.register}
                        >
                            {'Register New Application'}
                        </a>
                    </div>
                </div>
            );

            appSection = (
                <SettingItemMax
                    title='Applications (Preview)'
                    inputs={inputs}
                    updateSection={function updateSection(e) {
                        self.props.updateSection('');
                        e.preventDefault();
                    }}
                />
            );
        } else {
            appSection = (
                <SettingItemMin
                    title='Applications (Preview)'
                    describe='Open to register a new third-party application'
                    updateSection={function updateSection() {
                        self.props.updateSection('app');
                    }}
                />
            );
        }

        return (
            <div>
                <div className='modal-header'>
                    <button
                        type='button'
                        className='close'
                        data-dismiss='modal'
                        aria-label='Close'
                    >
                        <span aria-hidden='true'>{'x'}</span>
                    </button>
                    <h4
                        className='modal-title'
                        ref='title'
                    >
                        <i className='modal-back'></i>{'Developer Settings'}
                    </h4>
                </div>
                <div className='user-settings'>
                    <h3 className='tab-header'>{'Developer Settings'}</h3>
                    <div className='divider-dark first'/>
                    {appSection}
                    <div className='divider-dark'/>
                </div>
            </div>
        );
    }
}

DeveloperTab.defaultProps = {
    activeSection: ''
};
DeveloperTab.propTypes = {
    activeSection: React.PropTypes.string,
    updateSection: React.PropTypes.func
};
