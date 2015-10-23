// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

export default class SettingPicture extends React.Component {
    constructor(props) {
        super(props);

        this.setPicture = this.setPicture.bind(this);
    }

    setPicture(file) {
        if (file) {
            var reader = new FileReader();

            var img = ReactDOM.findDOMNode(this.refs.image);
            reader.onload = function load(e) {
                $(img).attr('src', e.target.result);
            };

            reader.readAsDataURL(file);
        }
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.picture) {
            this.setPicture(nextProps.picture);
        }
    }

    render() {
        var clientError = null;
        if (this.props.client_error) {
            clientError = <div className='form-group has-error'><label className='control-label'>{this.props.client_error}</label></div>;
        }
        var serverError = null;
        if (this.props.server_error) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.props.server_error}</label></div>;
        }

        var img = null;
        if (this.props.picture) {
            img = (
                <img
                    ref='image'
                    className='profile-img'
                    src=''
                />
            );
        } else {
            img = (
                <img
                    ref='image'
                    className='profile-img'
                    src={this.props.src}
                />
            );
        }

        var confirmButton;
        if (this.props.loadingPicture) {
            confirmButton = (
                <img
                    className='spinner'
                    src='/static/images/load.gif'
                />
            );
        } else {
            var confirmButtonClass = 'btn btn-sm';
            if (this.props.submitActive) {
                confirmButtonClass += ' btn-primary';
            } else {
                confirmButtonClass += ' btn-inactive disabled';
            }

            confirmButton = (
                <a
                    className={confirmButtonClass}
                    onClick={this.props.submit}
                >Save</a>
            );
        }
        var helpText = 'Upload a profile picture in either JPG or PNG format, at least ' + global.window.mm_config.ProfileWidth + 'px in width and ' + global.window.mm_config.ProfileHeight + 'px height.';

        var self = this;
        return (
            <ul className='section-max'>
                <li className='col-xs-12 section-title'>{this.props.title}</li>
                <li className='col-xs-offset-3 col-xs-8'>
                    <ul className='setting-list'>
                        <li className='setting-list-item'>
                            {img}
                        </li>
                        <li className='setting-list-item'>
                            {helpText}
                        </li>
                        <li className='setting-list-item'>
                            {serverError}
                            {clientError}
                            <span className='btn btn-sm btn-primary btn-file sel-btn'>
                                Select
                                <input
                                    ref='input'
                                    accept='.jpg,.png,.bmp'
                                    type='file'
                                    onChange={this.props.pictureChange}
                                />
                            </span>
                            {confirmButton}
                            <a
                                className='btn btn-sm theme'
                                href='#'
                                onClick={self.props.updateSection}
                            >Cancel</a>
                        </li>
                    </ul>
                </li>
            </ul>
        );
    }
}

SettingPicture.propTypes = {
    client_error: React.PropTypes.string,
    server_error: React.PropTypes.string,
    src: React.PropTypes.string,
    picture: React.PropTypes.object,
    loadingPicture: React.PropTypes.bool,
    submitActive: React.PropTypes.bool,
    submit: React.PropTypes.func,
    title: React.PropTypes.string,
    pictureChange: React.PropTypes.func
};
