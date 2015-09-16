// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

export default class Jobs extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
        };
    }

    render() {
        return (
            <div className='wrapper--fixed'>
                <h3>{' **************   JOB Settings'}</h3>
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
                                {'Save'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        );
    }
}