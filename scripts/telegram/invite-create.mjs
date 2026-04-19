import { createConvexClient, mutationRef, printJson, readCliArgs, resolveSchoolId } from "./_convex.mjs";

const args = readCliArgs();
const staffId = args.staffId;
if (!staffId) {
  throw new Error("Missing --staffId <id>");
}

const schoolId = resolveSchoolId(args);
const client = createConvexClient();

const result = await client.mutation(
  mutationRef("modules/ops/telegramInviteCodes:createInviteCode"),
  {
    schoolId,
    staffId,
  },
);

printJson(result);
