import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

import { loadLocalEnv, parseArgs, requireEnv } from "./_env.mjs";

export function createConvexClient() {
  loadLocalEnv();
  const url = requireEnv("CONVEX_URL");
  return new ConvexHttpClient(url, {
    skipConvexDeploymentUrlCheck: true,
    logger: false,
  });
}

export function mutationRef(name) {
  return makeFunctionReference(name);
}

export function queryRef(name) {
  return makeFunctionReference(name);
}

export function resolveSchoolId(rawArgs) {
  return rawArgs.schoolId ?? process.env.SCHOOL_ID ?? requireEnv("SCHOOL_ID");
}

export function readCliArgs() {
  loadLocalEnv();
  return parseArgs(process.argv.slice(2));
}

export function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}
