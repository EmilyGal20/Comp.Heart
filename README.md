
# COMPHEART

CompHeart is a premium internal company operating system for multi-organization environments. It centralizes knowledge, tasks, workflows, AI assistance, notifications, people management, and executive visibility inside one role-aware platform.

## Upgrade Highlights

- Multi-organization model with first-class `Organization` support.
- Hierarchical roles: `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `USER`.
- Organization-aware login flow with company selection.
- `/api/auth/me` session profile support and scoped token flow.
- Super admin global control center with cross-org comparison.
- Organization-scoped admin workspaces for people, tasks, knowledge, automations, and notifications.
- Better manager and regular-user experiences with personalized dashboards and more useful filtering.
- Role-aware CompHeart AI responses based on organization context and user responsibility.
- Segmented notifications for personal, org-wide, and role-targeted alerts.
- Realtime websocket layer for live task changes, comments, mentions, notifications, org updates, and user updates.
- Collaborative task workspace with comments, activity timeline, attachments, watchers, subtasks, board/list views, and AI task helpers.
- Advanced work management layers with sprint planning, backlog management, task templates, recurring generation, approvals, global search, a command palette, task chat, reports, exports, audit logs, calendar and timeline views, and a permissions matrix.
- AI-generated task planning with structured suggestions, subtask generation, and one-click creation.
- Slack-style internal chat with organization channels, team channels, task-linked threads, and live mentions.
- Integration-ready GitHub, Slack, and Email architecture with real settings surfaces.
- Predictive SLA analytics for at-risk tasks, overloaded users, and team risk visibility.
- Dedicated approvals dashboard with role-aware queues and quick approval actions.
- Visual automation builder with trigger, condition, action, and scope editing.
- Knowledge document version history with revision restore support.
- Organization announcements plus a dedicated important admin messages view.
- AI meeting summaries with action-item extraction and task creation.
- Personal self notes, a company contacts directory, and a restructured dashboard experience.
- New employee onboarding with role-aware steps, recommendations, and progress tracking.
- Full employee profile pages with task, notification, activity, and meeting context.
- Advanced notification center with grouping, filtering, bulk read, and live updates.
- AI-powered global search across tasks, knowledge, meetings, announcements, people, approvals, and discussions.
- Stabilized Super Admin command center and fixed control-center loading path with stronger fallbacks.
- More breathable layout polish with wider gutters, calmer spacing, and more centered content zones.

## Phase Upgrade Summary

### Phase 1: Planning Core

- Sprint planning with `PLANNED`, `ACTIVE`, and `COMPLETED` lifecycle states.
- Backlog management for tasks without a sprint.
- Sprint assignment and backlog ordering support.
- Sprint progress visibility in the planning workspace.

### Phase 2: Smart Automation

- Reusable task templates with default priority, tags, and SLA values.
- Recurring task definitions that can generate scheduled tasks.
- Lightweight approval flow with request, approve, and reject actions.

### Phase 3: Productivity Layer

- Global search across tasks, users, knowledge, and organizations.
- `Ctrl + K` command palette for fast navigation and actions.

### Phase 4: Collaboration

- Realtime task chat that lives alongside comments inside the task workspace.

### Phase 5: Insights

- Reporting endpoints for workload, SLA posture, overdue health, and sprint performance.
- CSV export for task reporting.
- Audit logs for organization changes, user management, task edits, and approvals.

### Phase 6: Visualization

- List, board, calendar, and timeline task views.

### Phase 7: Permissions & Control

- Visual permissions matrix page.
- Clear role-aware visibility across planning, reports, and management surfaces.

### Phase 8: AI, Communication, and Operational Intelligence

- AI-generated tasks from goals, prompts, and planning requests.
- Internal chat workspace with organization and team channels.
- Internal email sending with org-scoped recipient selection.
- Settings workspace for profile, integrations, workspace defaults, and operational controls.
- Predictive analytics for SLA risk and workload overload.

## Stack

- Frontend: React, Vite, JavaScript, MUI, Axios
- Backend: FastAPI, SQLAlchemy, Pydantic, SQLite
- Native helper: C module loaded through Python `ctypes`
- Dev runtime: root `package.json` with `concurrently`

## Role Hierarchy

- `SUPER_ADMIN`: can view all organizations, use global mode, compare orgs, create and edit organizations, activate or deactivate organizations, and manage users across orgs.
- `ADMIN`: manages users, workflows, automations, and operational oversight within one organization only.
- `MANAGER`: monitors team workload, assignments, SLA posture, and team-level execution visibility.
- `USER`: sees a personalized workspace with their tasks, watched work, mentions, alerts, recommended docs, and AI help.

## Multi-Organization Model

Organizations now own the main platform entities:

- teams
- users
- knowledge items
- tasks
- automation rules
- notifications
- AI conversations

Backend access control enforces organization scoping, and the frontend reflects that through role-aware routing and a top-bar organization switcher for super admins.

## Monorepo Structure

```text
compheart/
  package.json
  README.md
  frontend/
    package.json
    vite.config.js
    index.html
    src/
      api/
      components/
      layout/
      pages/
      store/
      styles/
  backend/
    requirements.txt
    run.py
    app/
      core/
      db/
      models/
      native/
      routers/
      schemas/
      seed/
      services/
      utils/
      main.py
```

## Main Backend Modules

- `auth`: org-aware login, `/me`, token handling
- `organizations`: organization list/detail/users/teams/summary
- `admin`: global summary, organization comparison, scoped admin data
- `users`: scoped user directory, creation, editing, activation, personalized dashboard
- `knowledge`: organization-aware search and retrieval
- `tasks`: scoped task list, filtering, status updates, comments, watchers, subtasks, mentions, attachments, SLA and risk scoring
- `automation`: org-aware workflow rule management
- `notifications`: segmented notification center
- `ai`: org-aware AI chat and saved conversations
- `dashboard`: role-aware dashboard summary endpoint
- `websocket`: organization-aware live updates for tasks, notifications, org changes, and user changes
- `work_management`: sprints, backlog, templates, recurring tasks, approvals, task chat, search, reports, exports, audit logs, and permission matrix
- `chat`: org channels, team channels, and task-linked collaboration threads
- `integrations`: GitHub, Slack, and Email settings plus internal email workflows
- `settings`: profile, workspace, and organization operations defaults
- `analytics`: explainable task, user, and team SLA risk scoring
- `approvals`: dashboard-grade approval listing and decision workflows
- `announcements`: organization communication streams and important-message reads
- `meetings`: AI meeting summaries and task creation from action items
- `self_notes`: private notes that stay scoped to one user
- `contacts`: organization-aware directory queries
- `onboarding`: role-aware onboarding checklists, progress tracking, and recommended next steps
- `search`: global and AI-assisted search across the platform with strict permission-aware results
- `profiles`: richer employee profile aggregation for work, activity, approvals, and meetings
- `command_center`: super-admin platform oversight with health, alerts, automation, and audit visibility

## Database Models

- `Organization`
- `Team`
- `User`
- `KnowledgeItem`
- `KnowledgeTag`
- `Task`
- `TaskActivity`
- `TaskAttachment`
- `TaskComment`
- `TaskWatcher`
- `Sprint`
- `TaskTemplate`
- `RecurringTask`
- `TaskApproval`
- `TaskMessage`
- `AuditLog`
- `ChatChannel`
- `ChatMembership`
- `ChatMessage`
- `OrganizationIntegration`
- `SentEmail`
- `UserWorkspaceSetting`
- `OrganizationSetting`
- `KnowledgeVersion`
- `Announcement`
- `AnnouncementRead`
- `MeetingSummary`
- `SelfNote`
- `OnboardingStep`
- `UserOnboardingProgress`
- `AutomationRule`
- `Notification`
- `AIConversation`
- `AIMessage`

## Native C Helper

`backend/app/native/risk_score.c` contains the real `task_risk_score` function used by the task service. It computes a task risk score from overdue time, priority weight, unread notifications, and SLA breach state.

If the compiled library is missing, `backend/app/native/risk_score.py` falls back to an equivalent pure Python implementation.

# ----------------------------------------------------------

### Compile Instructions

Windows with MinGW:

```powershell
gcc -shared -o backend/app/native/risk_score.dll backend/app/native/risk_score.c
```

Linux:

```bash
gcc -shared -fPIC -o backend/app/native/librisk_score.so backend/app/native/risk_score.c
```

macOS:

```bash
gcc -shared -fPIC -o backend/app/native/librisk_score.dylib backend/app/native/risk_score.c
```

## Setup

1. Install backend and frontend dependencies:

```bash
npm run install-all
```

2. Optionally compile the native C helper.

3. Optionally add a backend `.env` file for real OpenAI responses:

```env
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1-mini
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SENDER=ops@compheart.local
```

## Running The Stack

Start both frontend and backend from the repo root:

```bash
npm run dev
```

Ports:

- Frontend: `http://localhost:8069`
- Backend: `http://localhost:7155`

Individual commands:

```bash
npm run frontend
npm run backend
```

## Login Flow

The login screen now supports organization selection.

- Regular users, managers, and admins sign into their organization-scoped workspace.
- Super admins can sign in without choosing a company and then switch between global mode and org-specific mode in the header.

## Seed Data

The upgraded seed bootstraps a realistic multi-org environment:

- 3 organizations
- 6 teams
- 10 users across all role levels
- organization-specific knowledge entries
- org-distributed tasks with SLA variation
- comments, activity history, watchers, subtasks, and attachment-ready task records
- sprint, backlog, approval, recurring, and task-chat examples
- org and team chat channels with seeded message history
- GitHub, Slack, and Email integration settings shells
- workspace defaults, predictive analytics inputs, and sent email history
- org-specific automation rules
- personal, org-wide, and role-targeted notifications
- audit log history
- stored AI conversations

Demo credentials all use password `demo123`:

- `emily@compheart.local` (`SUPER_ADMIN`)
- `maya@northstar.local` (`ADMIN`)
- `ava@northstar.local` (`MANAGER`)
- `leo@northstar.local` (`USER`)
- `jordan@aether.local` (`ADMIN`)
- `noah@aether.local` (`MANAGER`)
- `iris@aether.local` (`USER`)
- `camila@harbor.local` (`ADMIN`)
- `marcus@harbor.local` (`MANAGER`)
- `nina@harbor.local` (`USER`)

## API Overview

Auth:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/auth/organizations`

Organizations:

- `GET /api/organizations`
- `POST /api/organizations`
- `PUT /api/organizations/{id}`
- `PATCH /api/organizations/{id}/status`
- `GET /api/organizations/{id}`
- `GET /api/organizations/{id}/users`
- `GET /api/organizations/{id}/teams`
- `GET /api/organizations/{id}/summary`

Admin / Global:

- `GET /api/admin/global-summary`
- `GET /api/admin/organization-comparison`
- `GET /api/admin/users`
- `GET /api/admin/tasks`
- `GET /api/admin/activity`
- `GET /api/admin/command-center`
- `GET /api/admin/control-center`
- `GET /api/admin/onboarding-overview`

Users:

- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/{id}`
- `PATCH /api/users/{id}/status`
- `GET /api/users/{id}`
- `GET /api/users/me/dashboard`

Knowledge:

- `GET /api/knowledge`
- `GET /api/knowledge/search`
- `POST /api/knowledge`
- `GET /api/knowledge/{id}`
- `PUT /api/knowledge/{id}`
- `GET /api/knowledge/{id}/versions`
- `POST /api/knowledge/{id}/restore-version/{version_id}`

Tasks:

- `GET /api/tasks`
- `POST /api/tasks`
- `GET /api/tasks/{id}`
- `PUT /api/tasks/{id}`
- `PATCH /api/tasks/{id}/status`
- `POST /api/tasks/{id}/comments`
- `GET /api/tasks/{id}/comments`
- `GET /api/tasks/{id}/activity`
- `POST /api/tasks/{id}/attachments`
- `GET /api/tasks/{id}/attachments`
- `POST /api/tasks/{id}/watch`
- `DELETE /api/tasks/{id}/watch`
- `POST /api/tasks/{id}/subtasks`
- `GET /api/tasks/{id}/subtasks`
- `POST /api/tasks/{id}/ai-assist`

Work Management:

- `GET /api/work/sprints`
- `POST /api/work/sprints`
- `PATCH /api/work/sprints/{sprint_id}/status`
- `GET /api/work/backlog`
- `PATCH /api/work/backlog/reorder`
- `PATCH /api/work/tasks/{task_id}/sprint`
- `GET /api/work/templates`
- `POST /api/work/templates`
- `POST /api/work/templates/{template_id}/tasks`
- `GET /api/work/recurring`
- `POST /api/work/recurring`
- `POST /api/work/recurring/run`
- `POST /api/work/approvals`
- `PATCH /api/work/approvals/{approval_id}`
- `GET /api/work/tasks/{task_id}/messages`
- `POST /api/work/tasks/{task_id}/messages`
- `GET /api/work/search`
- `GET /api/work/reports/summary`
- `GET /api/work/reports/tasks.csv`
- `GET /api/work/audit-logs`
- `GET /api/work/permissions/matrix`

Approvals:

- `GET /api/approvals/dashboard`
- `GET /api/approvals`
- `PATCH /api/approvals/{id}`

Announcements:

- `GET /api/announcements`
- `POST /api/announcements`
- `PUT /api/announcements/{id}`
- `PATCH /api/announcements/{id}/read`

Meetings:

- `GET /api/meetings`
- `POST /api/meetings/summarize`
- `GET /api/meetings/{id}`
- `POST /api/meetings/{id}/tasks`

Self Notes:

- `GET /api/self-notes`
- `POST /api/self-notes`
- `PUT /api/self-notes/{id}`
- `DELETE /api/self-notes/{id}`

Contacts:

- `GET /api/contacts`

Onboarding:

- `GET /api/onboarding`
- `GET /api/onboarding/me`
- `PATCH /api/onboarding/steps/{id}`

Profiles:

- `GET /api/users/me/profile`
- `GET /api/users/{id}/profile`

Search:

- `GET /api/search/global`
- `POST /api/search/ai`

Chat:

- `GET /api/chat/channels`
- `POST /api/chat/channels`
- `GET /api/chat/channels/{id}/messages`
- `POST /api/chat/channels/{id}/messages`
- `GET /api/chat/task/{task_id}/thread`

Integrations:

- `GET /api/integrations`
- `GET /api/integrations/github`
- `PUT /api/integrations/github`
- `GET /api/integrations/slack`
- `PUT /api/integrations/slack`
- `GET /api/integrations/email`
- `PUT /api/integrations/email`
- `POST /api/integrations/email/send`
- `GET /api/integrations/email/history`

Analytics:

- `GET /api/analytics/sla-risk`
- `GET /api/analytics/user-risk`
- `GET /api/analytics/team-risk`

Settings:

- `GET /api/settings/profile`
- `PUT /api/settings/profile`
- `GET /api/settings/workspace`
- `PUT /api/settings/workspace`
- `GET /api/settings/organization`
- `PUT /api/settings/organization`

Automation:

- `GET /api/automation`
- `POST /api/automation`
- `GET /api/automation/{id}`
- `PATCH /api/automation/{id}/toggle`
- `POST /api/automation/evaluate`

Notifications:

- `GET /api/notifications`
- `PATCH /api/notifications/{id}/read`

Realtime:

- `GET /ws/live?token=<jwt>&scope_org_id=<optional_org_id>`

AI:

- `POST /api/ai/chat`
- `POST /api/ai/generate-tasks`
- `POST /api/ai/generate-subtasks`
- `POST /api/ai/suggest-task-plan`
- `GET /api/ai/conversations`
- `GET /api/ai/conversations/{id}`

Dashboard:

- `GET /api/dashboard/summary`

## Frontend Experience

The frontend now includes:

- premium login experience with organization selection
- role-aware sidebar navigation
- top-bar organization context and super admin switcher
- dedicated global control center for super admins
- stabilized command center with resilient loading, error handling, and single-endpoint data aggregation
- dedicated organizations management page for super admins
- improved admin and manager workflows
- personalized user dashboard and My Work area
- dedicated onboarding workspace and AI/global search page
- full employee profile pages linked from contacts and people management
- approvals workspace with dashboard cards, filtered queues, and direct approve or reject actions
- planning workspace with sprint and backlog controls
- drag-and-drop backlog and sprint movement
- announcement center for company updates and a dedicated important admin messages page
- meetings workspace for AI summaries and action-item-to-task conversion
- knowledge version history and document restore controls
- dedicated chat workspace for channels and fast collaboration
- company contacts workspace for fast directory lookup
- report center with export actions and audit visibility
- permission matrix page
- activity feed page
- org-aware knowledge, tasks, notifications, and AI flows
- rich task detail drawer with comments, chat, timeline, attachments, editing, watchers, subtasks, approvals, and AI actions
- real settings workspace with profile, integrations, workspace defaults, and org controls

## Product Organization

The product is now grouped by workspace so features live in the page where operators expect to find them:

- `Dashboard`: role-aware overview widgets, announcements, approvals, notes, risk, and recent activity
- `Command Center`: super-admin global control, org health, alerts, automation health, and audit activity
- `Tasks`: list, board, calendar, timeline, detail drawer, comments, chat, attachments, and AI helpers
- `Planning`: sprints, backlog, templates, recurring tasks, and drag-and-drop planning
- `Approvals`: approval queue, decision workflow, and approval analytics
- `Knowledge`: documents, search, version history, and restore actions
- `Meetings`: AI meeting summaries and task conversion
- `Chat`: org, team, and task-linked communication
- `Announcements`: organization announcements and important admin messages
- `Contacts`: company directory and fast people lookup
- `Search`: AI and global search across tasks, knowledge, meetings, announcements, people, approvals, and discussion
- `Onboarding`: onboarding progress, role-aware setup steps, docs, contacts, and task guidance
- `Reports`: trends, exports, workload, SLA posture, and audit visibility
- `Automation`: automation builder and rule library
- `Settings`: profile, workspace, organization defaults, and integrations
- `Profile`: personal identity context and self notes

## Task Collaboration Upgrade

The task system now supports:

- full task editing for allowed roles
- comments with author and timestamp
- realtime task chat for fast collaboration
- AI-generated tasks and structured planning suggestions
- automatic task activity timeline
- attachments stored locally with download links
- task watchers and followers
- subtask creation and progress visibility
- @mention detection in comments with notifications
- board view and list view toggle
- calendar and timeline views
- advanced filtering by search, status, priority, assignee, team, SLA state, and organization scope
- AI task helper actions for summary, next steps, and subtasks
- sprint assignment, backlog placement, template-based creation, approvals, and recurring generation
- task-linked email updates with organization-scoped recipient selection

### Task Permissions

- `SUPER_ADMIN`: full control
- `ADMIN`: full control inside organization
- `MANAGER`: can edit and assign tasks inside visible team scope
- `USER`: can edit tasks assigned to them, comment, attach files, and update their own task status

### Task Activity Tracking

Task activity is generated automatically for:

- task creation
- status changes
- assignee changes
- detail edits
- comments
- attachments

Notifications are emitted for key task events such as assignment, updates, comments, status changes, and overdue pressure.

## Realtime Collaboration

CompHeart now includes a websocket live-update channel:

- task creation, edits, status changes, comments, and watch state update live
- task chat messages update live
- channel chat messages update live
- sprint and backlog changes can update live
- recurring task generation and approval decisions can publish live updates
- announcements, approval decisions, and meeting-generated tasks can publish live updates
- email send notifications can publish live updates
- notification badges and mention alerts update live
- organization and user management changes can propagate to connected clients
- super admins can stay global or scoped to one organization in realtime
- the frontend reconnects automatically and surfaces non-intrusive toast alerts

### Realtime Event Examples

- `task_created`
- `task_updated`
- `task_status_changed`
- `task_commented`
- `task_message_created`
- `task_assigned`
- `approval_updated`
- `announcement_created`
- `announcement_updated`
- `meeting_summary_created`
- `meeting_tasks_created`
- `recurring_task_created`
- `backlog_updated`
- `sprint_updated`
- `chat_message_created`
- `email_sent`
- `notification_created`
- `organization_updated`
- `user_updated`

## Migration Note

This upgrade changes the SQLite schema again to support planning and governance entities, including:

- `sprints`
- `task_templates`
- `recurring_tasks`
- `task_approvals`
- `task_messages`
- `audit_logs`
- task-level `sprint_id`
- task-level `backlog_order`
- `chat_channels`
- `chat_memberships`
- `chat_messages`
- `organization_integrations`
- `sent_emails`
- `user_workspace_settings`
- `organization_settings`
- `knowledge_versions`
- `announcements`
- `announcement_reads`
- `meeting_summaries`
- `self_notes`
- `onboarding_steps`
- `user_onboarding_progress`
- automation fields `scope_json` and `last_triggered_at`
- approval field `reason`

On startup, CompHeart detects older incompatible SQLite schemas and rebuilds the local database automatically so the latest seed can initialize cleanly.

## Validation Notes

The upgraded backend now enforces:

- server-side organization scoping
- role hierarchy checks on sensitive endpoints
- super admin global visibility
- admin org-only management
- manager team-focused workflows
- user-scoped task and notification access
- task edit/comment/attachment permissions by role and ownership
- organization-aware planning, approvals, reporting, search, and chat access
- organization-aware integration management and recipient-scoped email sending
- explainable predictive analytics based on due dates, blockers, priority, open subtasks, and workload

## Seed Coverage

The current seed now includes:

- multiple organizations with admins, managers, and users
- backlog and sprint-assigned tasks
- reusable templates
- recurring task definitions
- pending and completed approvals
- approval reasons and approval dashboard-ready records
- task chat messages
- seeded chat channels, integration settings, and sent email history
- document version history, announcements, meeting summaries, and self notes
- onboarding step definitions and seeded onboarding progress
- audit log records
- watchers, subtasks, comments, and notifications that still respect org boundaries

## Future Improvements

- deeper per-action permission policies and audit logs
- editable organizations and teams from the UI
- richer task comments and assignment flows
- vector search and stronger retrieval for CompHeart AI
- richer team management and editable team structures
- background automation execution and schedules
