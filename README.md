
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
- `AutomationRule`
- `Notification`
- `AIConversation`
- `AIMessage`

## Native C Helper

`backend/app/native/risk_score.c` contains the real `task_risk_score` function used by the task service. It computes a task risk score from overdue time, priority weight, unread notifications, and SLA breach state.

If the compiled library is missing, `backend/app/native/risk_score.py` falls back to an equivalent pure Python implementation.

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
- org-specific automation rules
- personal, org-wide, and role-targeted notifications
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
- activity feed page
- org-aware knowledge, tasks, notifications, and AI flows
- rich task detail drawer with comments, timeline, attachments, editing, watchers, subtasks, and AI actions

## Task Collaboration Upgrade

The task system now supports:

- full task editing for allowed roles
- comments with author and timestamp
- automatic task activity timeline
- attachments stored locally with download links
- task watchers and followers
- subtask creation and progress visibility
- @mention detection in comments with notifications
- board view and list view toggle
- advanced filtering by search, status, priority, assignee, team, SLA state, and organization scope
- AI task helper actions for summary, next steps, and subtasks

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
- notification badges and mention alerts update live
- organization and user management changes can propagate to connected clients
- super admins can stay global or scoped to one organization in realtime
- the frontend reconnects automatically and surfaces non-intrusive toast alerts

## Migration Note

This upgrade changes the SQLite schema to support organizations and role hierarchy. On startup, CompHeart detects older single-org schemas and rebuilds the local SQLite database automatically so the new seed can initialize cleanly.

## Validation Notes

The upgraded backend now enforces:

- server-side organization scoping
- role hierarchy checks on sensitive endpoints
- super admin global visibility
- admin org-only management
- manager team-focused workflows
- user-scoped task and notification access
- task edit/comment/attachment permissions by role and ownership

## Future Improvements

- deeper per-action permission policies and audit logs
- editable organizations and teams from the UI
- richer task comments and assignment flows
- vector search and stronger retrieval for CompHeart AI
- richer team management and editable team structures
- background automation execution and schedules
