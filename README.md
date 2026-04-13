
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
- dedicated organizations management page for super admins
- improved admin and manager workflows
- personalized user dashboard and My Work area
- planning workspace with sprint and backlog controls
- report center with export actions and audit visibility
- permission matrix page
- activity feed page
- org-aware knowledge, tasks, notifications, and AI flows
- rich task detail drawer with comments, chat, timeline, attachments, editing, watchers, subtasks, approvals, and AI actions

## Task Collaboration Upgrade

The task system now supports:

- full task editing for allowed roles
- comments with author and timestamp
- realtime task chat for fast collaboration
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
- sprint and backlog changes can update live
- recurring task generation and approval decisions can publish live updates
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
- `recurring_task_created`
- `backlog_updated`
- `sprint_updated`
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

## Seed Coverage

The current seed now includes:

- multiple organizations with admins, managers, and users
- backlog and sprint-assigned tasks
- reusable templates
- recurring task definitions
- pending and completed approvals
- task chat messages
- audit log records
- watchers, subtasks, comments, and notifications that still respect org boundaries

## Future Improvements

- deeper per-action permission policies and audit logs
- editable organizations and teams from the UI
- richer task comments and assignment flows
- vector search and stronger retrieval for CompHeart AI
- richer team management and editable team structures
- background automation execution and schedules
