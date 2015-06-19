// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

module.exports = React.createClass({
    handleConfirm: function() {
        $('#'+this.props.parent_id).attr('data-confirm', 'true');
        $('#'+this.props.parent_id).modal('hide');
        $('#'+this.props.id).modal('hide');
    },
    render: function() {
        return (
            <div className="modal fade" id={this.props.id} tabIndex="-1" role="dialog" aria-hidden="true">
               <div className="modal-dialog">
                  <div className="modal-content">
                    <div className="modal-header">
                      <h4 className="modal-title">{this.props.title}</h4>
                    </div>
                    <div className="modal-body">
                    {this.props.message}
                    </div>
                    <div className="modal-footer">
                      <button type="button" className="btn btn-default" data-dismiss="modal">Cancel</button>
                      <button onClick={this.handleConfirm} type="button" className="btn btn-primary">{this.props.confirm_button}</button>
                    </div>
                  </div>
               </div>
            </div>
        );
    }
});

