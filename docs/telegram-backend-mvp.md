# Telegram Backend MVP

## Architecture and Repo Boundary
- `C:\Users\pcdca\Documents\AISHACK67` is the Convex backend of record.
- `C:\Users\pcdca\Documents\AISHACK67-telegram-bot` is the Telegram adapter repo.
- Telegram runtime concerns live in the sibling repo.
- Invite redemption, dedupe, inbound storage, parsing, attendance, incidents, tasks, and notifications live in this repo.

## Exact HTTP Contracts

### `POST /telegram/link/redeem`
- Required header: `x-telegram-adapter-secret`
- Request body:

```json
{
  "schoolId": "<schools id>",
  "code": "ABCD1234",
  "telegramUserId": "123456789",
  "chatId": "123456789",
  "username": "teacher_username",
  "firstName": "Aigerim"
}
```

### `POST /telegram/inbound`
- Required header: `x-telegram-adapter-secret`
- Request body:

```json
{
  "schoolId": "<schools id>",
  "updateId": 555001,
  "message": {
    "telegramMessageId": "101",
    "telegramUserId": "123456789",
    "chatId": "123456789",
    "chatType": "private",
    "text": "1A 24 present 2 absent",
    "username": "teacher_username",
    "firstName": "Aigerim",
    "sentAt": "2026-04-18T08:00:00.000Z"
  },
  "source": "polling"
}
```

## Invite Lifecycle
- Invite codes are stored in `telegramInviteCodes`.
- Codes are 8 uppercase alphanumeric characters.
- Codes are single-use.
- Codes expire after 24 hours.
- Creating a new code for the same staff member revokes older active codes.
- Redeeming a code creates or reactivates a `telegramAccounts` record for that staff member.

## Dedupe Rules
- Primary dedupe key: `chatId:telegramMessageId`
- The same Telegram message must never create:
  - a second `telegramMessages` row
  - a second attendance fact
  - a second incident
  - a second task
  - a second notification
  - a second `✓ received`
- Replayed adapter requests are safe.

## Required Backend Environment Variables
- `CONVEX_URL`
- `CONVEX_SITE_URL`
- `TELEGRAM_INGRESS_SECRET`
- `TELEGRAM_BOT_TOKEN`

Example local values in `.env.local`:

```env
CONVEX_URL=http://127.0.0.1:3210
CONVEX_SITE_URL=http://127.0.0.1:3211
TELEGRAM_INGRESS_SECRET=choose_a_shared_secret
TELEGRAM_BOT_TOKEN=your_botfather_token
```

## Admin Commands

### Generate an invite code
```powershell
$env:SCHOOL_ID="<schoolId>"
npm run telegram:invite:create -- --staffId <staffId>
```

### List invite codes
```powershell
$env:SCHOOL_ID="<schoolId>"
npm run telegram:invite:list
```

### Typecheck the backend
```powershell
npm run typecheck
```

## Attendance Verification Steps
1. Start Convex locally:

```powershell
npx convex dev
```

2. After a linked teacher sends an attendance message, verify the backend:

```powershell
$env:SCHOOL_ID="<schoolId>"
npm run telegram:debug:attendance -- --chatId <telegramChatId>
```

3. Confirm:
- `account` is present and active
- one recent `telegramMessages` row exists for the message
- one `attendanceFacts` record exists for the relevant `sourceMessageId`
- the message `parserStatus` is `processed`

## Incident Verification Steps
1. After a linked teacher sends an incident message, verify the backend:

```powershell
$env:SCHOOL_ID="<schoolId>"
npm run telegram:debug:incident -- --chatId <telegramChatId>
```

2. Confirm:
- one recent `telegramMessages` row exists
- one incident exists for that `sourceMessageId`
- one task exists when an assignee fallback is available
- one notification exists with dedupe key `incident:<incidentId>:staff:<assigneeStaffId>`

## Incident Assignee Fallback
- First active `facilities` staff member by `fullName` ascending
- Else first active `admin` by `fullName` ascending
- Else first active `director` by `fullName` ascending
- If none exist:
  - the incident is created
  - no task is created
  - `assignmentStatus` remains `unassigned`
  - `assignmentReason` becomes `no_active_incident_assignee`

