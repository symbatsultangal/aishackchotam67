import {
  makeFunctionReference,
  type DefaultFunctionArgs,
  type FunctionReference,
  type FunctionType,
} from "convex/server";

export function publicRef<
  Type extends FunctionType,
  Args extends DefaultFunctionArgs = any,
  ReturnType = any,
>(name: string): FunctionReference<Type, "public", Args, ReturnType> {
  return makeFunctionReference<Type, Args, ReturnType>(name);
}

export function internalRef<
  Type extends FunctionType,
  Args extends DefaultFunctionArgs = any,
  ReturnType = any,
>(name: string): FunctionReference<Type, "internal", Args, ReturnType> {
  return makeFunctionReference<Type, Args, ReturnType>(
    name,
  ) as unknown as FunctionReference<Type, "internal", Args, ReturnType>;
}
