import { createConvexClient, printJson, queryRef, readCliArgs, resolveSchoolId } from "./_convex.mjs";

const args = readCliArgs();
const schoolId = resolveSchoolId(args);
const client = createConvexClient();

const result = await client.query(
  queryRef("modules/ops/telegramInviteCodes:listInviteCodes"),
  {
    schoolId,
  },
);

printJson(result);
