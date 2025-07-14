// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessage} from 'react-intl';

import Provider from './provider';
import type {ResultsCallback} from './provider';
import SearchDateSuggestion from './search_date_suggestion';

type DateItem = {label: string; date: string};

export default class SearchDateProvider extends Provider {
    handlePretextChanged(pretext: string, resultsCallback: ResultsCallback<DateItem>) {
        const captured = (/\b(on|before|after):\s*(\S*)$/i).exec(pretext.toLowerCase());
        if (captured) {
            const dateType = captured[1];
            const datePrefix = captured[2];

            this.startNewRequest(datePrefix);

            const dates: DateItem[] = Object.assign([], [{label: 'Selected Date', date: datePrefix}]);
            const terms = dates.map((date) => date.date);

            let label;
            if (dateType === 'after') {
                label = defineMessage({
                    id: 'suggestion.date.after',
                    defaultMessage: 'After the selected date',
                });
            } else if (dateType === 'before') {
                label = defineMessage({
                    id: 'suggestion.date.before',
                    defaultMessage: 'Before the selected date',
                });
            } else {
                label = defineMessage({
                    id: 'suggestion.date.on',
                    defaultMessage: 'On the selected date',
                });
            }

            resultsCallback({
                matchedPretext: datePrefix,
                groups: [{
                    key: 'searchDate',
                    hideLabel: true,
                    label,
                    terms,
                    items: dates,
                }],
                component: SearchDateSuggestion,
            });
        }

        return Boolean(captured);
    }

    presentationType() {
        return 'date';
    }
}
