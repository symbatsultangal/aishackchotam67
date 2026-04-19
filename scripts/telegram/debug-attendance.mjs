import { createConvexClient, printJson, queryRef, readCliArgs, resolveSchoolId } from "./_convex.mjs";

const args = readCliArgs();
const chatId = args.chatId;
if (!chatId) {
  throw new Error("Missing --chatId <id>");
}

const schoolId = resolveSchoolId(args);
const client = createConvexClient();

const result = await client.query(
  queryRef("modules/ops/telegram:debugAttendanceByChat"),
  {
    schoolId,
    chatId,
  },
);

printJson(result);
