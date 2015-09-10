// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

export default class EmailSettings extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
        };
    }

    render() {
        return (
            <div className='wrapper--fixed'>
                <h3>{'Email Settings'}</h3>
                <form
                    className='form-horizontal'
                    role='form'
                >
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='email'
                        >
                            {'Bypass Email: '}
                            <a
                                href='#'
                                data-trigger='hover click'
                                data-toggle='popover'
                                data-position='bottom'
                                data-content={'Here\'s some more help text inside a popover for the Bypass Email field just to show how popovers look.'}
                            >
                                {'(?)'}
                            </a>
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='byPassEmail'
                                    value='option1'
                                />
                                    {'True'}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='byPassEmail'
                                    value='option2'
                                />
                                    {'False'}
                            </label>
                            <p className='help-text'>{'This is some sample help text for the Bypass Email field'}</p>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='smtpUsername'
                        >
                            {'SMTP Username:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='email'
                                className='form-control'
                                id='smtpUsername'
                                placeholder='Enter your SMTP username'
                                value=''
                            />
                            <div className='help-text'>
                                <div className='alert alert-warning'><i className='fa fa-warning'></i>{' This is some error text for the Bypass Email field'}</div>
                            </div>
                            <p className='help-text'>{'This is some sample help text for the SMTP username field'}</p>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='smtpPassword'
                        >
                            {'SMTP Password:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='password'
                                className='form-control'
                                id='smtpPassword'
                                placeholder='Enter your SMTP password'
                                value=''
                            />
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='smtpServer'
                        >
                            {'SMTP Server:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='smtpServer'
                                placeholder='Enter your SMTP server'
                                value=''
                            />
                            <div className='help-text'>
                                <a
                                    href='#'
                                    className='help-link'
                                >
                                    {'Test Connection'}
                                </a>
                                <div className='alert alert-success'><i className='fa fa-check'></i>{' Connection successful'}</div>
                                <div className='alert alert-warning hide'><i className='fa fa-warning'></i>{' Connection unsuccessful'}</div>
                            </div>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label className='control-label col-sm-4'>{'Use TLS:'}</label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='tls'
                                    value='option1'
                                />
                                    {'True'}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='tls'
                                    value='option2'
                                />
                                    {'False'}
                            </label>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label className='control-label col-sm-4'>{'Use Start TLS:'}</label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='starttls'
                                    value='option1'
                                />
                                    {'True'}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='starttls'
                                    value='option2'
                                />
                                    {'False'}
                            </label>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='feedbackEmail'
                        >
                            {'Feedback Email:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='feedbackEmail'
                                placeholder='Enter your feedback email'
                                value=''
                            />
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='feedbackUsername'
                        >
                            {'Feedback Username:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='feedbackUsername'
                                placeholder='Enter your feedback username'
                                value=''
                            />
                        </div>
                    </div>
                    <div className='form-group'>
                        <div className='col-sm-offset-4 col-sm-8'>
                            <div className='checkbox'>
                                <label><input type='checkbox' />{'Remember me'}</label>
                            </div>
                        </div>
                    </div>

                    <div
                        className='panel-group'
                        id='accordion'
                        role='tablist'
                        aria-multiselectable='true'
                    >
                        <div className='panel panel-default'>
                            <div
                                className='panel-heading'
                                role='tab'
                                id='headingOne'
                            >
                                <h3 className='panel-title'>
                                    <a
                                        className='collapsed'
                                        role='button'
                                        data-toggle='collapse'
                                        data-parent='#accordion'
                                        href='#collapseOne'
                                        aria-expanded='true'
                                        aria-controls='collapseOne'
                                    >
                                        {'Advanced Settings '}
                                        <i className='fa fa-plus'></i>
                                        <i className='fa fa-minus'></i>
                                    </a>
                                </h3>
                            </div>
                            <div
                                id='collapseOne'
                                className='panel-collapse collapse'
                                role='tabpanel'
                                aria-labelledby='headingOne'
                            >
                                <div className='panel-body'>
                                    <div className='form-group'>
                                        <label
                                            className='control-label col-sm-4'
                                            htmlFor='feedbackUsername'
                                        >
                                            {'Apple push server:'}
                                        </label>
                                        <div className='col-sm-8'>
                                            <input
                                                type='text'
                                                className='form-control'
                                                id='feedbackUsername'
                                                placeholder='Enter your Apple push server'
                                                value=''
                                            />
                                            <p className='help-text'>{'This is some sample help text for the Apple push server field'}</p>
                                        </div>
                                    </div>
                                    <div className='form-group'>
                                        <label
                                            className='control-label col-sm-4'
                                            htmlFor='feedbackUsername'
                                        >
                                            {'Apple push certificate public:'}
                                        </label>
                                        <div className='col-sm-8'>
                                            <input
                                                type='text'
                                                className='form-control'
                                                id='feedbackUsername'
                                                placeholder='Enter your public apple push certificate'
                                                value=''
                                            />
                                        </div>
                                    </div>
                                    <div className='form-group'>
                                        <label
                                            className='control-label col-sm-4'
                                            htmlFor='feedbackUsername'
                                        >
                                            {'Apple push certificate private:'}
                                        </label>
                                        <div className='col-sm-8'>
                                            <input
                                                type='text'
                                                className='form-control'
                                                id='feedbackUsername'
                                                placeholder='Enter your private apple push certificate'
                                                value=''
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className='form-group'>
                        <div className='col-sm-12'>
                            <button
                                type='submit'
                                className='btn btn-primary'
                            >
                                {'Submit'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        );
    }
}