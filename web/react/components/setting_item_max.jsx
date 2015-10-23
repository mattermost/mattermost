// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

export default class SettingItemMax extends React.Component {
    render() {
        var clientError = null;
        if (this.props.client_error) {
            clientError = (<div className='form-group'><label className='col-sm-12 has-error'>{this.props.client_error}</label></div>);
        }

        var serverError = null;
        if (this.props.server_error) {
            serverError = (<div className='form-group'><label className='col-sm-12 has-error'>{this.props.server_error}</label></div>);
        }

        var extraInfo = null;
        if (this.props.extraInfo) {
            extraInfo = (<div className='setting-list__hint'>{this.props.extraInfo}</div>);
        }

        var submit = '';
        if (this.props.submit) {
            submit = (
                <a
                    className='btn btn-sm btn-primary'
                    href='#'
                    onClick={this.props.submit}
                >
                    Save
                </a>
            );
        }

        var inputs = this.props.inputs;
        var widthClass;
        if (this.props.width === 'full') {
            widthClass = 'col-sm-12';
        } else {
            widthClass = 'col-sm-10 col-sm-offset-2';
        }

        return (
            <ul className='section-max form-horizontal'>
                <li className='col-sm-12 section-title'>{this.props.title}</li>
                <li className={widthClass}>
                    <ul className='setting-list'>
                        <li className='setting-list-item'>
                            {inputs}
                            {extraInfo}
                        </li>
                        <li className='setting-list-item'>
                            <hr />
                            {serverError}
                            {clientError}
                            {submit}
                            <a
                                className='btn btn-sm theme'
                                href='#'
                                onClick={this.props.updateSection}
                            >
                                Cancel
                            </a>
                        </li>
                    </ul>
                </li>
            </ul>
        );
    }
}

SettingItemMax.propTypes = {
    inputs: React.PropTypes.array,
    client_error: React.PropTypes.string,
    server_error: React.PropTypes.string,
    extraInfo: React.PropTypes.element,
    updateSection: React.PropTypes.func,
    submit: React.PropTypes.func,
    title: React.PropTypes.string,
    width: React.PropTypes.string
};
