// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import Constants from '../utils/constants.jsx';
import SuggestionList from './suggestion_list.jsx';
import SuggestionStore from '../stores/suggestion_store.jsx';
import * as Utils from '../utils/utils.jsx';

const ActionTypes = Constants.ActionTypes;
const KeyCodes = Constants.KeyCodes;

export default class SuggestionBox extends React.Component {
    constructor(props) {
        super(props);

        this.handleDocumentClick = this.handleDocumentClick.bind(this);
        this.handleFocus = this.handleFocus.bind(this);

        this.handleChange = this.handleChange.bind(this);
        this.handleCompleteWord = this.handleCompleteWord.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handlePretextChanged = this.handlePretextChanged.bind(this);

        this.suggestionId = Utils.generateId();

        this.state = {
            focused: false
        };
    }

    componentDidMount() {
        SuggestionStore.registerSuggestionBox(this.suggestionId);
        $(document).on('click', this.handleDocumentClick);

        SuggestionStore.addCompleteWordListener(this.suggestionId, this.handleCompleteWord);
        SuggestionStore.addPretextChangedListener(this.suggestionId, this.handlePretextChanged);
    }

    componentWillUnmount() {
        SuggestionStore.removeCompleteWordListener(this.suggestionId, this.handleCompleteWord);
        SuggestionStore.removePretextChangedListener(this.suggestionId, this.handlePretextChanged);

        SuggestionStore.unregisterSuggestionBox(this.suggestionId);
        $(document).off('click', this.handleDocumentClick);
    }

    handleDocumentClick(e) {
        if (!this.state.focused) {
            return;
        }

        const container = $(ReactDOM.findDOMNode(this));
        if (!(container.is(e.target) || container.has(e.target).length > 0)) {
            // we can't just use blur for this because it fires and hides the children before
            // their click handlers can be called
            this.setState({
                focused: false
            });
        }
    }

    handleFocus() {
        this.setState({
            focused: true
        });

        if (this.props.onFocus) {
            this.props.onFocus();
        }
    }

    handleChange(e) {
        const textbox = ReactDOM.findDOMNode(this.refs.textbox);
        const caret = Utils.getCaretPosition(textbox);
        const pretext = textbox.value.substring(0, caret);

        AppDispatcher.handleViewAction({
            type: ActionTypes.SUGGESTION_PRETEXT_CHANGED,
            id: this.suggestionId,
            pretext
        });

        if (this.props.onUserInput) {
            this.props.onUserInput(textbox.value);
        }

        if (this.props.onChange) {
            this.props.onChange(e);
        }
    }

    handleCompleteWord(term) {
        const textbox = ReactDOM.findDOMNode(this.refs.textbox);
        const caret = Utils.getCaretPosition(textbox);

        const text = this.props.value;
        const prefix = text.substring(0, caret - SuggestionStore.getMatchedPretext(this.suggestionId).length);
        const suffix = text.substring(caret);

        if (this.props.onUserInput) {
            this.props.onUserInput(prefix + term + ' ' + suffix);
        }

        // set the caret position after the next rendering
        window.requestAnimationFrame(() => {
            Utils.setCaretPosition(textbox, prefix.length + term.length + 1);
        });
    }

    handleKeyDown(e) {
        if (SuggestionStore.hasSuggestions(this.suggestionId)) {
            if (e.which === KeyCodes.UP) {
                AppDispatcher.handleViewAction({
                    type: ActionTypes.SUGGESTION_SELECT_PREVIOUS,
                    id: this.suggestionId
                });
                e.preventDefault();
            } else if (e.which === KeyCodes.DOWN) {
                AppDispatcher.handleViewAction({
                    type: ActionTypes.SUGGESTION_SELECT_NEXT,
                    id: this.suggestionId
                });
                e.preventDefault();
            } else if (e.which === KeyCodes.SPACE || e.which === KeyCodes.ENTER) {
                AppDispatcher.handleViewAction({
                    type: ActionTypes.SUGGESTION_COMPLETE_WORD,
                    id: this.suggestionId
                });
                e.preventDefault();
            } else if (this.props.onKeyDown) {
                this.props.onKeyDown(e);
            }
        } else if (this.props.onKeyDown) {
            this.props.onKeyDown(e);
        }
    }

    handlePretextChanged(pretext) {
        for (const provider of this.props.providers) {
            provider.handlePretextChanged(this.suggestionId, pretext);
        }
    }

    render() {
        const newProps = Object.assign({}, this.props, {
            onFocus: this.handleFocus,
            onChange: this.handleChange,
            onKeyDown: this.handleKeyDown
        });

        return (
            <div>
                <input
                    ref='textbox'
                    type='text'
                    {...newProps}
                />
                <SuggestionList suggestionId={this.suggestionId} />
            </div>
        );
    }
}

SuggestionBox.propTypes = {
    value: React.PropTypes.string.isRequired,
    onUserInput: React.PropTypes.func,
    providers: React.PropTypes.arrayOf(React.PropTypes.object),

    // explicitly name any input event handlers we override and need to manually call
    onChange: React.PropTypes.func,
    onKeyDown: React.PropTypes.func,
    onFocus: React.PropTypes.func
};
