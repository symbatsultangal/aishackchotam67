# Telegram Backend Debugging

## Message Not Stored
- Symptom: no `telegramMessages` row appears after Telegram input
- Likely cause: adapter failed before the backend request or the ingress secret was wrong
- Exact check:

```powershell
npm run telegram:debug:attendance -- --schoolId <schoolId> --chatId <telegramChatId>
```

- Exact fix:
  - confirm the sibling bot repo can reach `CONVEX_INGEST_URL`
  - confirm `TELEGRAM_INGRESS_SECRET` matches in both repos
  - retry with one new Telegram message

## Linked User Still Gets Link-First Reply
- Symptom: `/start <code>` succeeded earlier, but normal messages still get “Please link your account first”
- Likely cause: wrong `SCHOOL_ID` in the bot repo or stale `telegramAccounts`
- Exact check:

```powershell
$env:SCHOOL_ID="<schoolId>"
npm run telegram:debug:attendance -- --chatId <telegramChatId>
```

- Exact fix:
  - make sure the bot repo `SCHOOL_ID` matches the backend school
  - confirm the returned `account.telegramUserId` matches the real Telegram user
  - create a fresh invite code and relink if needed

## Ack Sent But No Attendance Fact
- Symptom: Telegram shows `✓ received` but no attendance effect appears
- Likely cause: parser error, class code mismatch, or message classified as `ignore`
- Exact check:

```powershell
$env:SCHOOL_ID="<schoolId>"
npm run telegram:debug:attendance -- --chatId <telegramChatId>
```

- Exact fix:
  - inspect the latest `telegramMessages[].parserStatus`
  - inspect `telegramMessages[].parserDetails`
  - resend using the canonical attendance format from the appendix

## Ack Sent But No Incident/Task
- Symptom: Telegram shows `✓ received` but the incident flow is incomplete
- Likely cause: parser error or no eligible assignee fallback
- Exact check:

```powershell
$env:SCHOOL_ID="<schoolId>"
npm run telegram:debug:incident -- --chatId <telegramChatId>
```

- Exact fix:
  - inspect the incident `assignmentStatus`
  - inspect `assignmentReason`
  - make sure at least one active `facilities`, `admin`, or `director` staff member exists

## Duplicate Rows Created
- Symptom: replaying the same update created duplicate effects
- Likely cause: dedupe regression
- Exact check:
  - compare `telegramMessages.dedupeKey`
  - confirm it equals `chatId:telegramMessageId`
  - check whether multiple rows share the same dedupe key

- Exact fix:
  - stop the demo flow
  - inspect recent changes around `storeInbound`
  - do not proceed until duplicate writes are eliminated

## Bad Adapter Secret
- Symptom: the adapter sees backend 401 errors
- Likely cause: `TELEGRAM_INGRESS_SECRET` mismatch
- Exact check:
  - compare `.env.local` in the backend repo with `.env` in the bot repo
  - confirm both use the same exact secret string

- Exact fix:
  - set the same secret in both places
  - restart both processes

## Expired Invite
- Symptom: `/start <code>` returns invalid or expired
- Likely cause: invite older than 24 hours or already redeemed
- Exact check:

```powershell
$env:SCHOOL_ID="<schoolId>"
npm run telegram:invite:list
```

- Exact fix:
  - create a fresh invite code
  - retry `/start <new-code>`

## Notification Queued But Not Sent
- Symptom: incident notification exists but Telegram recipient did not receive it
- Likely cause: recipient has no active `telegramAccounts` record or outbound send failed
- Exact check:

```powershell
$env:SCHOOL_ID="<schoolId>"
npm run telegram:debug:incident -- --chatId <telegramChatId>
```

- Exact fix:
  - confirm the assignee has an active Telegram account
  - confirm `TELEGRAM_BOT_TOKEN` is valid in the backend repo
  - resend after fixing the recipient link or token

