//// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
//// See License.txt for license information.
//

const en = require('!!file?name=help/[name].[ext]!./Messaging_en.md');
const es = require('!!file?name=help/[name].[ext]!./Messaging_es.md');

import $ from 'jquery';
import React from 'react';

import LocalizationStore from 'stores/localization_store.jsx';
import * as TextFormatting from 'utils/text_formatting.jsx';

export default class Docs extends React.Component {
    constructor(props) {
        super(props);
        const errorState = {text: '## 404'};
        const locale = LocalizationStore.getLocale();
        const files = {
            en,
            es
        };

        this.state = {text: ''};

        $.get(files[locale]).then((response) => {
            this.setState({text: response});
        }, () => {
            this.setState(errorState);
        });
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
