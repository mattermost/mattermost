// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import AutocompleteSelector from './autocomplete_selector';

describe('components/widgets/settings/AutocompleteSelector', () => {
    test('render component with required props', () => {
        const wrapper = shallow(
            <AutocompleteSelector
                id='string.id'
                label='some label'
                value='some value'
                providers={[]}
            />,
        );
        expect(wrapper).toMatchInlineSnapshot(`
            <div
              className="form-group"
              data-testid="autoCompleteSelector"
            >
              <label
                className="control-label "
              >
                some label
              </label>
              <div
                className=""
              >
                <Connect(SuggestionBox)
                  className="form-control"
                  completeOnTab={true}
                  containerClass="select-suggestion-container"
                  listComponent={[Function]}
                  listPosition="top"
                  onBlur={[Function]}
                  onChange={[Function]}
                  onFocus={[Function]}
                  onItemSelected={[Function]}
                  openOnFocus={true}
                  openWhenEmpty={true}
                  providers={Array []}
                  renderNoResults={true}
                  replaceAllInputOnSelect={true}
                  value="some value"
                />
              </div>
            </div>
        `);
    });

    test('check snapshot with value prop and changing focus', () => {
        const wrapper = shallow(
            <AutocompleteSelector
                providers={[]}
                label='some label'
                value='value from prop'
            />,
        );

        wrapper.instance().onBlur();

        expect(wrapper).toMatchInlineSnapshot(`
            <div
              className="form-group"
              data-testid="autoCompleteSelector"
            >
              <label
                className="control-label "
              >
                some label
              </label>
              <div
                className=""
              >
                <Connect(SuggestionBox)
                  className="form-control"
                  completeOnTab={true}
                  containerClass="select-suggestion-container"
                  listComponent={[Function]}
                  listPosition="top"
                  onBlur={[Function]}
                  onChange={[Function]}
                  onFocus={[Function]}
                  onItemSelected={[Function]}
                  openOnFocus={true}
                  openWhenEmpty={true}
                  providers={Array []}
                  renderNoResults={true}
                  replaceAllInputOnSelect={true}
                  value="value from prop"
                />
              </div>
            </div>
        `);

        wrapper.instance().onChange({target: {value: 'value from input'}});
        wrapper.instance().onFocus();

        expect(wrapper).toMatchInlineSnapshot(`
            <div
              className="form-group"
              data-testid="autoCompleteSelector"
            >
              <label
                className="control-label "
              >
                some label
              </label>
              <div
                className=""
              >
                <Connect(SuggestionBox)
                  className="form-control"
                  completeOnTab={true}
                  containerClass="select-suggestion-container"
                  listComponent={[Function]}
                  listPosition="top"
                  onBlur={[Function]}
                  onChange={[Function]}
                  onFocus={[Function]}
                  onItemSelected={[Function]}
                  openOnFocus={true}
                  openWhenEmpty={true}
                  providers={Array []}
                  renderNoResults={true}
                  replaceAllInputOnSelect={true}
                  value="value from input"
                />
              </div>
            </div>
        `);
    });

    test('onSelected', () => {
        const onSelected = jest.fn();
        const wrapper = shallow(
            <AutocompleteSelector
                label='some label'
                value='some value'
                providers={[]}
                onSelected={onSelected}
            />,
        );

        const selected = {text: 'sometext', value: 'somevalue'};
        wrapper.instance().handleSelected(selected);

        expect(onSelected).toHaveBeenCalledTimes(1);
        expect(onSelected).toHaveBeenCalledWith(selected);
    });
});
