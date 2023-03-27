// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import AdminTextSetting from './text_setting';
import {renderWithIntl} from 'tests/react_testing_utils';

describe('components/admin_console/TextSetting', () => {
    test('render component with required props', () => {
        const onChange = jest.fn();
        const wrapper = renderWithIntl(
            <AdminTextSetting
                id='string.id'
                label='some label'
                value='some value'
                onChange={onChange}
                setByEnv={false}
                labelClassName=''
                inputClassName=''
                maxLength={-1}
                resizable={true}
                type='input'
            />,
        );
        expect(wrapper).toMatchInlineSnapshot(`
            Object {
              "asFragment": [Function],
              "baseElement": <body>
                <div>
                  <div
                    class="form-group"
                    data-testid="string.id"
                  >
                    <label
                      class="control-label col-sm-4"
                      data-testid="string.idlabel"
                      for="string.id"
                    >
                      some label
                    </label>
                    <div
                      class="col-sm-8"
                    >
                      <input
                        class="form-control"
                        data-testid="string.idinput"
                        id="string.id"
                        maxlength="-1"
                        type="input"
                        value="some value"
                      />
                      <div
                        class="help-text"
                        data-testid="string.idhelp-text"
                      />
                    </div>
                  </div>
                </div>
              </body>,
              "container": <div>
                <div
                  class="form-group"
                  data-testid="string.id"
                >
                  <label
                    class="control-label col-sm-4"
                    data-testid="string.idlabel"
                    for="string.id"
                  >
                    some label
                  </label>
                  <div
                    class="col-sm-8"
                  >
                    <input
                      class="form-control"
                      data-testid="string.idinput"
                      id="string.id"
                      maxlength="-1"
                      type="input"
                      value="some value"
                    />
                    <div
                      class="help-text"
                      data-testid="string.idhelp-text"
                    />
                  </div>
                </div>
              </div>,
              "debug": [Function],
              "findAllByAltText": [Function],
              "findAllByDisplayValue": [Function],
              "findAllByLabelText": [Function],
              "findAllByPlaceholderText": [Function],
              "findAllByRole": [Function],
              "findAllByTestId": [Function],
              "findAllByText": [Function],
              "findAllByTitle": [Function],
              "findByAltText": [Function],
              "findByDisplayValue": [Function],
              "findByLabelText": [Function],
              "findByPlaceholderText": [Function],
              "findByRole": [Function],
              "findByTestId": [Function],
              "findByText": [Function],
              "findByTitle": [Function],
              "getAllByAltText": [Function],
              "getAllByDisplayValue": [Function],
              "getAllByLabelText": [Function],
              "getAllByPlaceholderText": [Function],
              "getAllByRole": [Function],
              "getAllByTestId": [Function],
              "getAllByText": [Function],
              "getAllByTitle": [Function],
              "getByAltText": [Function],
              "getByDisplayValue": [Function],
              "getByLabelText": [Function],
              "getByPlaceholderText": [Function],
              "getByRole": [Function],
              "getByTestId": [Function],
              "getByText": [Function],
              "getByTitle": [Function],
              "queryAllByAltText": [Function],
              "queryAllByDisplayValue": [Function],
              "queryAllByLabelText": [Function],
              "queryAllByPlaceholderText": [Function],
              "queryAllByRole": [Function],
              "queryAllByTestId": [Function],
              "queryAllByText": [Function],
              "queryAllByTitle": [Function],
              "queryByAltText": [Function],
              "queryByDisplayValue": [Function],
              "queryByLabelText": [Function],
              "queryByPlaceholderText": [Function],
              "queryByRole": [Function],
              "queryByTestId": [Function],
              "queryByText": [Function],
              "queryByTitle": [Function],
              "rerender": [Function],
              "unmount": [Function],
            }
        `);
    });
});
