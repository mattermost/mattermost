// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

module.exports = React.createClass({
    setPicture: function(file) {
        if (file) {
            var reader = new FileReader();

            var img = this.refs.image.getDOMNode();
            reader.onload = function(e) {
                $(img).attr('src', e.target.result);
            };

            reader.readAsDataURL(file);
        }
    },
    componentWillReceiveProps: function(nextProps) {
        if (nextProps.picture) {
            this.setPicture(nextProps.picture);
        }
    },
    render: function() {
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
            img = (<img ref='image' className='profile-img' src=''/>);
        } else {
            img = (<img ref='image' className='profile-img' src={this.props.src}/>);
        }

        var confirmButton;
        if (this.props.loadingPicture) {
            confirmButton = <img className='spinner' src='/static/images/load.gif'/>;
        } else {
            var confirmButtonClass = 'btn btn-sm';
            if (this.props.submitActive) {
                confirmButtonClass += ' btn-primary';
            } else {
                confirmButtonClass += ' btn-inactive disabled';
            }
            confirmButton = <a className={confirmButtonClass} onClick={this.props.submit}>Save</a>;
        }

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
                            {serverError}
                            {clientError}
                            <span className='btn btn-sm btn-primary btn-file sel-btn'>Select<input ref='input' accept='.jpg,.png,.bmp' type='file' onChange={this.props.pictureChange}/></span>
                            {confirmButton}
                            <a className='btn btn-sm theme' href='#' onClick={self.props.updateSection}>Cancel</a>
                        </li>
                    </ul>
                </li>
            </ul>
        );
    }
});
