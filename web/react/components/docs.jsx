// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as TextFormatting from '../utils/text_formatting.jsx';
import UserStore from '../stores/user_store.jsx';

export default class Docs extends React.Component {
    constructor(props) {
        super(props);
        UserStore.setCurrentUser(global.window.mm_user || {});

        this.state = {text: ''};
        const errorState = {text: '## 404'};

        if (props.site) {
            $.get(`/static/help/${props.site}_${global.window.mm_locale}.md`).then((response) => {
                this.setState({text: response});
            }, () => {
                this.setState(errorState);
            });
        } else {
            this.setState(errorState);
        }
    }

    render() {
        return (
            <div
                dangerouslySetInnerHTML={{__html: TextFormatting.formatText(this.state.text)}}
            >
            </div>
        );
    }
}

Docs.defaultProps = {
    site: ''
};
Docs.propTypes = {
    site: React.PropTypes.string
};
