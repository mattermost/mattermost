// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

export default class AboutBuildModal extends React.Component {
    render() {
        const config = global.window.config;

        return (
            <div
                className='modal fade'
                ref='modal'
                id='about_build'
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
                      >
                        <span className='name'>{`Mattermost ${config.Version}`}</span>
                      </h4>
                    </div>
                    <div className='modal-body'>
                      <div className='row form-group'>
                        <div className='col-sm-3 info__label'>{'Build Number:'}</div>
                        <div className='col-sm-9'>{config.BuildNumber}</div>
                      </div>
                      <div className='row form-group'>
                        <div className='col-sm-3 info__label'>{'Build Date:'}</div>
                        <div className='col-sm-9'>{config.BuildDate}</div>
                      </div>
                      <div className='row'>
                        <div className='col-sm-3 info__label'>{'Build Hash:'}</div>
                        <div className='col-sm-9'>{config.BuildHash}</div>
                      </div>
                    </div>
                    <div className='modal-footer'>
                      <button
                          type='button'
                          className='btn btn-default'
                          data-dismiss='modal'
                      >{'Close'}</button>
                    </div>
                  </div>
               </div>
            </div>
        );
    }
}
