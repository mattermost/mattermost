// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');
var ZeroClipboardMixin = require('react-zeroclipboard-mixin');

ZeroClipboardMixin.ZeroClipboard.config({
  swfPath: '../../static/flash/ZeroClipboard.swf'
});

module.exports = React.createClass({
    zeroclipboardElementsSelector: '[data-copy-btn]',
    mixins: [ ZeroClipboardMixin ],
    componentDidMount: function() {
        var self = this;
        if(this.refs.modal) {
          $(this.refs.modal.getDOMNode()).on('show.bs.modal', function(e) {
              var button = e.relatedTarget;
              self.setState({title: $(button).attr('data-title'), value: $(button).attr('data-value') });
          });
        }
    },
    getInitialState: function() {
        return { };
    },
    render: function() {
        var currentUser = UserStore.getCurrentUser()

        if (currentUser != null) {
            return (
                <div className="modal fade" ref="modal" id="get_link" tabIndex="-1" role="dialog" aria-hidden="true">
                   <div className="modal-dialog">
                      <div className="modal-content">
                        <div className="modal-header">
                          <button type="button" className="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                          <h4 className="modal-title" id="myModalLabel">{this.state.title} Link</h4>
                        </div>
                        <div className="modal-body">
                          <p>{"The link below is used for open " + strings.TeamPlural + " or if you allowed your " + strings.Team + " members to sign up using their " + strings.Company + " email addresses."}
                          </p>
                          <textarea className="form-control" readOnly="true" value={this.state.value}></textarea>
                        </div>
                        <div className="modal-footer">
                          <button type="button" className="btn btn-default" data-dismiss="modal">Close</button>
                          <button data-copy-btn type="button" className="btn btn-primary" data-clipboard-text={this.state.value}>Copy Link</button>
                        </div>
                      </div>
                   </div>
                </div>
            );
        } else {
            return <div/>;
        }
    }
});
