// Copyright 2021-2022 The Memphis Authors
// Licensed under the Apache License, Version 2.0 (the “License”);
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an “AS IS” BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.package server

const Reducer = (filterState, action) => {
    switch (action.type) {
        case 'SET_FILTER_FIELDS':
            return {
                ...filterState,
                filterFields: action.payload
            };
        case 'SET_COUNTER':
            return {
                ...filterState,
                counter: action.payload
            };
        case 'SET_IS_OPEN':
            return {
                ...filterState,
                isOpen: action.payload
            };
        case 'SET_APPLY':
            return {
                ...filterState,
                apply: action.payload
            };
        default:
            return filterState;
    }
};

export default Reducer;
