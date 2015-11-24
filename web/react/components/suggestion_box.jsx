// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import Constants from '../utils/constants.jsx';
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

        this.suggestionId = Utils.generateId();

        this.state = {
            focused: false
        };
    }

    componentDidMount() {
        SuggestionStore.registerSuggestionBox(this.suggestionId);
        $(document).on('click', this.handleDocumentClick);

        SuggestionStore.addCompleteWordListener(this.suggestionId, this.handleCompleteWord);
    }

    componentWillUnmount() {
        SuggestionStore.removeCompleteWordListener(this.suggestionId, this.handleCompleteWord);

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
        } else if ((e.which === KeyCodes.SPACE || e.which === KeyCodes.ENTER) && SuggestionStore.hasSuggestions(this.suggestionId)) {
            AppDispatcher.handleViewAction({
                type: ActionTypes.SUGGESTION_COMPLETE_WORD,
                id: this.suggestionId
            });
            e.preventDefault();
        } else if (this.props.onKeyDown) {
            this.props.onKeyDown(e);
        }
    }

    render() {
        const {value, children, ...props} = this.props; // eslint-disable-line no-redeclare

        const newProps = Object.assign({}, props, {
            onFocus: this.handleFocus,
            onChange: this.handleChange,
            onKeyDown: this.handleKeyDown,
            value
        });

        const providerProps = {
            suggestionId: this.suggestionId
        };

        let newChildren = null;
        if (this.state.focused) {
            newChildren = React.Children.map(
                children,
                (child) => {
                    return React.cloneElement(child, providerProps);
                }
            );
        }

        return (
            <div>
                <input
                    ref='textbox'
                    type='text'
                    {...newProps}
                />
                {newChildren}
            </div>
        );
    }
}

SuggestionBox.propTypes = {
    children: React.PropTypes.node,
    value: React.PropTypes.string.isRequired,
    onUserInput: React.PropTypes.func,

    // explicitly name any input event handlers we override and need to manually call
    onChange: React.PropTypes.func,
    onKeyDown: React.PropTypes.func,
    onFocus: React.PropTypes.func
};
