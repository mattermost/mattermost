/*********************************************************************
 * NAN - Native Abstractions for Node.js
 *
 * Copyright (c) 2016 NAN contributors
 *
 * MIT License <https://github.com/nodejs/nan/blob/master/LICENSE.md>
 ********************************************************************/

#ifndef NAN_MAYBE_43_INL_H_
#define NAN_MAYBE_43_INL_H_

template<typename T>
using MaybeLocal = v8::MaybeLocal<T>;

template<typename T>
using Maybe = v8::Maybe<T>;

template<typename T>
inline Maybe<T> Nothing() {
  return v8::Nothing<T>();
}

template<typename T>
inline Maybe<T> Just(const T& t) {
  return v8::Just<T>(t);
}

v8::Local<v8::Context> GetCurrentContext();

inline
MaybeLocal<v8::String> ToDetailString(v8::Local<v8::Value> val) {
  return val->ToDetailString(GetCurrentContext());
}

inline
MaybeLocal<v8::Uint32> ToArrayIndex(v8::Local<v8::Value> val) {
  return val->ToArrayIndex(GetCurrentContext());
}

inline
Maybe<bool> Equals(v8::Local<v8::Value> a, v8::Local<v8::Value>(b)) {
  return a->Equals(GetCurrentContext(), b);
}

inline
MaybeLocal<v8::Object> NewInstance(v8::Local<v8::Function> h) {
  return h->NewInstance(GetCurrentContext());
}

inline
MaybeLocal<v8::Object> NewInstance(
      v8::Local<v8::Function> h
    , int argc
    , v8::Local<v8::Value> argv[]) {
  return h->NewInstance(GetCurrentContext(), argc, argv);
}

inline
MaybeLocal<v8::Object> NewInstance(v8::Local<v8::ObjectTemplate> h) {
  return h->NewInstance(GetCurrentContext());
}


inline MaybeLocal<v8::Function> GetFunction(
    v8::Local<v8::FunctionTemplate> t) {
  return t->GetFunction(GetCurrentContext());
}

inline Maybe<bool> Set(
    v8::Local<v8::Object> obj
  , v8::Local<v8::Value> key
  , v8::Local<v8::Value> value) {
  return obj->Set(GetCurrentContext(), key, value);
}

inline Maybe<bool> Set(
    v8::Local<v8::Object> obj
  , uint32_t index
  , v8::Local<v8::Value> value) {
  return obj->Set(GetCurrentContext(), index, value);
}

inline Maybe<bool> ForceSet(
    v8::Local<v8::Object> obj
  , v8::Local<v8::Value> key
  , v8::Local<v8::Value> value
  , v8::PropertyAttribute attribs = v8::None) {
  return obj->ForceSet(GetCurrentContext(), key, value, attribs);
}

inline MaybeLocal<v8::Value> Get(
    v8::Local<v8::Object> obj
  , v8::Local<v8::Value> key) {
  return obj->Get(GetCurrentContext(), key);
}

inline
MaybeLocal<v8::Value> Get(v8::Local<v8::Object> obj, uint32_t index) {
  return obj->Get(GetCurrentContext(), index);
}

inline v8::PropertyAttribute GetPropertyAttributes(
    v8::Local<v8::Object> obj
  , v8::Local<v8::Value> key) {
  return obj->GetPropertyAttributes(GetCurrentContext(), key).FromJust();
}

inline Maybe<bool> Has(
    v8::Local<v8::Object> obj
  , v8::Local<v8::String> key) {
  return obj->Has(GetCurrentContext(), key);
}

inline Maybe<bool> Has(v8::Local<v8::Object> obj, uint32_t index) {
  return obj->Has(GetCurrentContext(), index);
}

inline Maybe<bool> Delete(
    v8::Local<v8::Object> obj
  , v8::Local<v8::String> key) {
  return obj->Delete(GetCurrentContext(), key);
}

inline
Maybe<bool> Delete(v8::Local<v8::Object> obj, uint32_t index) {
  return obj->Delete(GetCurrentContext(), index);
}

inline
MaybeLocal<v8::Array> GetPropertyNames(v8::Local<v8::Object> obj) {
  return obj->GetPropertyNames(GetCurrentContext());
}

inline
MaybeLocal<v8::Array> GetOwnPropertyNames(v8::Local<v8::Object> obj) {
  return obj->GetOwnPropertyNames(GetCurrentContext());
}

inline Maybe<bool> SetPrototype(
    v8::Local<v8::Object> obj
  , v8::Local<v8::Value> prototype) {
  return obj->SetPrototype(GetCurrentContext(), prototype);
}

inline MaybeLocal<v8::String> ObjectProtoToString(
    v8::Local<v8::Object> obj) {
  return obj->ObjectProtoToString(GetCurrentContext());
}

inline Maybe<bool> HasOwnProperty(
    v8::Local<v8::Object> obj
  , v8::Local<v8::String> key) {
  return obj->HasOwnProperty(GetCurrentContext(), key);
}

inline Maybe<bool> HasRealNamedProperty(
    v8::Local<v8::Object> obj
  , v8::Local<v8::String> key) {
  return obj->HasRealNamedProperty(GetCurrentContext(), key);
}

inline Maybe<bool> HasRealIndexedProperty(
    v8::Local<v8::Object> obj
  , uint32_t index) {
  return obj->HasRealIndexedProperty(GetCurrentContext(), index);
}

inline Maybe<bool> HasRealNamedCallbackProperty(
    v8::Local<v8::Object> obj
  , v8::Local<v8::String> key) {
  return obj->HasRealNamedCallbackProperty(GetCurrentContext(), key);
}

inline MaybeLocal<v8::Value> GetRealNamedPropertyInPrototypeChain(
    v8::Local<v8::Object> obj
  , v8::Local<v8::String> key) {
  return obj->GetRealNamedPropertyInPrototypeChain(GetCurrentContext(), key);
}

inline MaybeLocal<v8::Value> GetRealNamedProperty(
    v8::Local<v8::Object> obj
  , v8::Local<v8::String> key) {
  return obj->GetRealNamedProperty(GetCurrentContext(), key);
}

inline MaybeLocal<v8::Value> CallAsFunction(
    v8::Local<v8::Object> obj
  , v8::Local<v8::Object> recv
  , int argc
  , v8::Local<v8::Value> argv[]) {
  return obj->CallAsFunction(GetCurrentContext(), recv, argc, argv);
}

inline MaybeLocal<v8::Value> CallAsConstructor(
    v8::Local<v8::Object> obj
  , int argc, v8::Local<v8::Value> argv[]) {
  return obj->CallAsConstructor(GetCurrentContext(), argc, argv);
}

inline
MaybeLocal<v8::String> GetSourceLine(v8::Local<v8::Message> msg) {
  return msg->GetSourceLine(GetCurrentContext());
}

inline Maybe<int> GetLineNumber(v8::Local<v8::Message> msg) {
  return msg->GetLineNumber(GetCurrentContext());
}

inline Maybe<int> GetStartColumn(v8::Local<v8::Message> msg) {
  return msg->GetStartColumn(GetCurrentContext());
}

inline Maybe<int> GetEndColumn(v8::Local<v8::Message> msg) {
  return msg->GetEndColumn(GetCurrentContext());
}

inline MaybeLocal<v8::Object> CloneElementAt(
    v8::Local<v8::Array> array
  , uint32_t index) {
#if (NODE_MODULE_VERSION >= NODE_6_0_MODULE_VERSION)
  v8::EscapableHandleScope handle_scope(v8::Isolate::GetCurrent());
  v8::Local<v8::Context> context = GetCurrentContext();
  v8::Local<v8::Value> elem;
  if (!array->Get(context, index).ToLocal(&elem)) {
    return MaybeLocal<v8::Object>();
  }
  v8::Local<v8::Object> obj;
  if (!elem->ToObject(context).ToLocal(&obj)) {
    return MaybeLocal<v8::Object>();
  }
  return MaybeLocal<v8::Object>(handle_scope.Escape(obj->Clone()));
#else
  return array->CloneElementAt(GetCurrentContext(), index);
#endif
}

inline MaybeLocal<v8::Value> Call(
    v8::Local<v8::Function> fun
  , v8::Local<v8::Object> recv
  , int argc
  , v8::Local<v8::Value> argv[]) {
  return fun->Call(GetCurrentContext(), recv, argc, argv);
}

#endif  // NAN_MAYBE_43_INL_H_
