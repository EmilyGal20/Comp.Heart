from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.ai import AIConversation, AIMessage
from app.models.automation import AutomationRule
from app.models.collaboration import ChatChannel, ChatMembership, ChatMessage, OrganizationIntegration, OrganizationSetting, SentEmail, UserWorkspaceSetting
from app.models.knowledge import KnowledgeItem, KnowledgeTag
from app.models.notification import Notification
from app.models.organization import Organization
from app.models.productivity import Announcement, AnnouncementRead, KnowledgeVersion, MeetingSummary, OnboardingStep, SelfNote, UserOnboardingProgress
from app.models.task import Task, TaskActivity, TaskAttachment, TaskComment, TaskWatcher
from app.models.user import Team, User
from app.models.work_management import AuditLog, RecurringTask, Sprint, TaskApproval, TaskMessage, TaskTemplate


def seed_database(db: Session):
    if db.query(Organization).first():
        return

    organizations = [
        Organization(name="Northstar Health", slug="northstar", company_type="Enterprise", industry="Healthcare Operations", description="Multi-site healthcare operations and support workflows."),
        Organization(name="Aether Labs", slug="aether", company_type="Scale-up", industry="AI Infrastructure", description="Platform engineering, AI operations, and release management."),
        Organization(name="Harbor Commerce", slug="harbor", company_type="Mid-market", industry="Retail Operations", description="Omnichannel retail and fulfillment operations."),
    ]
    db.add_all(organizations)
    db.flush()

    teams = [
        Team(name="Global Operations", description="Cross-org oversight and governance.", organization_id=organizations[0].id),
        Team(name="Support Command", description="Escalations and incident response.", organization_id=organizations[0].id),
        Team(name="Product Ops", description="Release coordination and planning.", organization_id=organizations[1].id),
        Team(name="Automation Studio", description="Workflow automation and system checks.", organization_id=organizations[1].id),
        Team(name="Store Success", description="Store operations and fulfillment health.", organization_id=organizations[2].id),
        Team(name="Retail Systems", description="Operational systems and rollout support.", organization_id=organizations[2].id),
    ]
    db.add_all(teams)
    db.flush()

    users = [
        User(full_name="Emily Gal", email="emily@compheart.local", role="SUPER_ADMIN", title="Top CEO", responsibilities="Global system governance, organization growth, executive oversight.", organization_id=organizations[0].id, team_id=teams[0].id, password="demo123"),
        User(full_name="Maya Chen", email="maya@northstar.local", role="ADMIN", title="Chief of Staff", responsibilities="Org governance, automation approvals, KPI reviews.", organization_id=organizations[0].id, team_id=teams[0].id, password="demo123"),
        User(full_name="Ava Thompson", email="ava@northstar.local", role="MANAGER", title="Support Manager", responsibilities="Escalation ownership, team SLA monitoring, customer response coordination.", organization_id=organizations[0].id, team_id=teams[1].id, password="demo123"),
        User(full_name="Leo Grant", email="leo@northstar.local", role="USER", title="Support Specialist", responsibilities="Incident updates, task follow-up, knowledge feedback.", organization_id=organizations[0].id, team_id=teams[1].id, password="demo123"),
        User(full_name="Jordan Rivera", email="jordan@aether.local", role="ADMIN", title="Product Operations Lead", responsibilities="Release coordination, documentation quality, workflow improvement.", organization_id=organizations[1].id, team_id=teams[2].id, password="demo123"),
        User(full_name="Noah Patel", email="noah@aether.local", role="MANAGER", title="Automation Engineering Manager", responsibilities="Workflow automation, risk monitoring, execution reviews.", organization_id=organizations[1].id, team_id=teams[3].id, password="demo123"),
        User(full_name="Iris Solis", email="iris@aether.local", role="USER", title="Automation Engineer", responsibilities="Rule quality, alert tuning, native helper review.", organization_id=organizations[1].id, team_id=teams[3].id, password="demo123"),
        User(full_name="Camila Brooks", email="camila@harbor.local", role="ADMIN", title="Operations Director", responsibilities="Store performance, workforce visibility, org readiness.", organization_id=organizations[2].id, team_id=teams[4].id, password="demo123"),
        User(full_name="Marcus Hale", email="marcus@harbor.local", role="MANAGER", title="Retail Systems Manager", responsibilities="Operational rollout planning and issue triage.", organization_id=organizations[2].id, team_id=teams[5].id, password="demo123"),
        User(full_name="Nina Torres", email="nina@harbor.local", role="USER", title="Systems Coordinator", responsibilities="Operational updates, rollout execution, team coordination.", organization_id=organizations[2].id, team_id=teams[5].id, password="demo123"),
    ]
    db.add_all(users)
    db.flush()
    db.add_all(
        [
            UserWorkspaceSetting(user_id=user.id, default_task_view="board" if user.role in {"ADMIN", "MANAGER"} else "list", density="comfortable", notify_email=True, notify_desktop=True, theme_mode="dark")
            for user in users
        ]
    )
    db.add_all(
        [
            OrganizationSetting(organization_id=organizations[0].id, default_sla_hours=24, require_approval_for_critical=True, recurring_auto_run=True, slack_notifications_enabled=True, email_notifications_enabled=True),
            OrganizationSetting(organization_id=organizations[1].id, default_sla_hours=18, require_approval_for_critical=True, recurring_auto_run=True, slack_notifications_enabled=True, email_notifications_enabled=True),
            OrganizationSetting(organization_id=organizations[2].id, default_sla_hours=30, require_approval_for_critical=False, recurring_auto_run=True, slack_notifications_enabled=False, email_notifications_enabled=True),
        ]
    )

    tags = {name: KnowledgeTag(name=name) for name in ["incident", "sla", "process", "release", "automation", "onboarding", "retail", "ops"]}
    db.add_all(tags.values())
    db.flush()

    knowledge_items = [
        KnowledgeItem(title="Northstar Incident Command Runbook", slug="northstar-incident-command-runbook", category="process", organization_id=organizations[0].id, content="Acknowledge critical issues in 15 minutes, assign a commander, open a bridge, update stakeholders, and log patient-impact decisions.", summary="The first-hour response flow for critical healthcare operations incidents.", author_id=users[2].id, is_published=True, tags=[tags["incident"], tags["sla"], tags["process"]]),
        KnowledgeItem(title="Aether Release Readiness Checklist", slug="aether-release-readiness-checklist", category="operations", organization_id=organizations[1].id, content="Verify rollback owner, feature flags, telemetry monitors, communication plan, and automation rule health before each release.", summary="Release-readiness guardrails for AI platform deployments.", author_id=users[4].id, is_published=True, tags=[tags["release"], tags["automation"], tags["ops"]]),
        KnowledgeItem(title="Harbor Store Systems Rollout Playbook", slug="harbor-store-systems-rollout-playbook", category="operations", organization_id=organizations[2].id, content="Coordinate store training, cutover timing, escalation coverage, and post-launch verification for every rollout wave.", summary="How Harbor launches internal systems across store regions safely.", author_id=users[8].id, is_published=True, tags=[tags["retail"], tags["process"], tags["ops"]]),
        KnowledgeItem(title="Aether New Teammate Operating Guide", slug="aether-new-teammate-operating-guide", category="people", organization_id=organizations[1].id, content="Review task lifecycle, release rituals, incident channels, and AI escalation norms in week one.", summary="Onboarding expectations for Aether Labs team members.", author_id=users[4].id, is_published=True, tags=[tags["onboarding"], tags["process"]]),
    ]
    db.add_all(knowledge_items)
    db.flush()
    db.add_all(
        [
            KnowledgeVersion(knowledge_item_id=knowledge_items[0].id, version_number=1, title_snapshot=knowledge_items[0].title, content_snapshot="Initial incident command draft for support operations.", summary_snapshot="Initial draft", edited_by=users[1].id),
            KnowledgeVersion(knowledge_item_id=knowledge_items[0].id, version_number=2, title_snapshot=knowledge_items[0].title, content_snapshot="Updated incident command process with stakeholder bridge guidance.", summary_snapshot="Stakeholder bridge update", edited_by=users[2].id),
            KnowledgeVersion(knowledge_item_id=knowledge_items[1].id, version_number=1, title_snapshot=knowledge_items[1].title, content_snapshot="Release readiness checklist baseline.", summary_snapshot="Baseline release checklist", edited_by=users[4].id),
        ]
    )

    now = datetime.now(timezone.utc)
    tasks = [
        Task(title="Stabilize patient billing escalation lane", description="Investigate delayed claim notifications and tighten the support escalation workflow.\n\nCoordinate with support leadership and update the runbook after the root cause is confirmed.", organization_id=organizations[0].id, status="IN_PROGRESS", priority="high", tags=["billing", "incident", "urgent"], related_knowledge_ids=[knowledge_items[0].id], assignee_id=users[3].id, creator_id=users[1].id, due_at=now - timedelta(hours=5), sla_hours=8, sla_status="breached", related_knowledge_id=knowledge_items[0].id),
        Task(title="Audit ICU workflow announcements", description="Review org-wide messaging for high-severity operational updates and update templates.", organization_id=organizations[0].id, status="REVIEW", priority="medium", tags=["communication", "process"], related_knowledge_ids=[knowledge_items[0].id], assignee_id=users[2].id, creator_id=users[1].id, due_at=now + timedelta(hours=10), sla_hours=12, sla_status="warning", related_knowledge_id=knowledge_items[0].id),
        Task(title="Prepare release command center", description="Confirm owners, monitoring, rollback paths, and AI escalation prompts for Friday deployment.", organization_id=organizations[1].id, status="BLOCKED", priority="critical", tags=["release", "ops", "blocker"], related_knowledge_ids=[knowledge_items[1].id, knowledge_items[3].id], assignee_id=users[6].id, creator_id=users[4].id, due_at=now - timedelta(hours=2), sla_hours=6, sla_status="breached", related_knowledge_id=knowledge_items[1].id),
        Task(title="Tune automation severity mapping", description="Refine the threshold logic used for manager-facing automation alerts.", organization_id=organizations[1].id, status="TODO", priority="medium", tags=["automation", "alerts"], related_knowledge_ids=[knowledge_items[1].id], assignee_id=users[6].id, creator_id=users[5].id, due_at=now + timedelta(days=1), sla_hours=24, sla_status="on_track", related_knowledge_id=knowledge_items[1].id),
        Task(title="Coordinate west region store rollout", description="Align training schedule, issue coverage, and overnight support for the next launch wave.", organization_id=organizations[2].id, status="IN_PROGRESS", priority="high", tags=["retail", "rollout"], related_knowledge_ids=[knowledge_items[2].id], assignee_id=users[9].id, creator_id=users[8].id, due_at=now + timedelta(hours=16), sla_hours=20, sla_status="warning", related_knowledge_id=knowledge_items[2].id),
        Task(title="Refresh systems coordinator checklist", description="Update task and communication checklists for the store systems coordinator role.", organization_id=organizations[2].id, status="TODO", priority="low", tags=["documentation", "onboarding"], related_knowledge_ids=[knowledge_items[2].id], assignee_id=users[9].id, creator_id=users[7].id, due_at=now + timedelta(days=3), sla_hours=48, sla_status="on_track", related_knowledge_id=knowledge_items[2].id),
        Task(title="Validate stakeholder update template", description="Draft the communication update that goes out once the billing incident root cause is confirmed.", organization_id=organizations[0].id, status="TODO", priority="medium", tags=["communication", "subtask"], related_knowledge_ids=[knowledge_items[0].id], assignee_id=users[2].id, creator_id=users[1].id, due_at=now + timedelta(hours=4), sla_hours=6, sla_status="warning", related_knowledge_id=knowledge_items[0].id),
    ]
    db.add_all(tasks)
    db.flush()
    tasks[6].parent_task_id = tasks[0].id
    tasks[0].backlog_order = 1
    tasks[1].backlog_order = 2
    tasks[2].backlog_order = 1
    tasks[3].backlog_order = 2
    tasks[4].backlog_order = 1
    tasks[5].backlog_order = 2
    tasks[6].backlog_order = 3
    tasks[0].external_refs = ["https://github.com/compheart/demo/issues/41", "slack://northstar/incidents/billing"]
    tasks[2].external_refs = ["https://github.com/compheart/demo/pull/88"]

    comments = [
        TaskComment(task_id=tasks[0].id, author_id=users[1].id, content="Raised this in the morning operations review.\nNeed an owner for the communication follow-up."),
        TaskComment(task_id=tasks[0].id, author_id=users[3].id, content="Investigating the delayed claim webhook path now.\n@ava can you review the outbound communication sequence once I confirm the fix?"),
        TaskComment(task_id=tasks[2].id, author_id=users[5].id, content="We need telemetry validation before approving the release."),
        TaskComment(task_id=tasks[4].id, author_id=users[8].id, content="Store leaders requested more rollout coaching coverage."),
    ]
    db.add_all(comments)

    activities = [
        TaskActivity(task_id=tasks[0].id, user_id=users[1].id, action_type="created", message="Maya Chen created the task"),
        TaskActivity(task_id=tasks[0].id, user_id=users[1].id, action_type="assigned", field_changed="assignee_id", old_value=None, new_value=str(users[3].id), message="Maya Chen assigned the task to Leo Grant"),
        TaskActivity(task_id=tasks[0].id, user_id=users[3].id, action_type="status_changed", field_changed="status", old_value="TODO", new_value="IN_PROGRESS", message="Leo Grant changed status to IN_PROGRESS"),
        TaskActivity(task_id=tasks[2].id, user_id=users[4].id, action_type="created", message="Jordan Rivera created the task"),
        TaskActivity(task_id=tasks[2].id, user_id=users[5].id, action_type="updated", field_changed="priority", old_value="high", new_value="critical", message="Noah Patel raised the task priority to critical"),
        TaskActivity(task_id=tasks[2].id, user_id=users[6].id, action_type="comment_added", message="Iris Solis added a comment"),
        TaskActivity(task_id=tasks[4].id, user_id=users[8].id, action_type="created", message="Marcus Hale created the task"),
        TaskActivity(task_id=tasks[4].id, user_id=users[9].id, action_type="status_changed", field_changed="status", old_value="TODO", new_value="IN_PROGRESS", message="Nina Torres changed status to IN_PROGRESS"),
        TaskActivity(task_id=tasks[6].id, user_id=users[1].id, action_type="created", message="Maya Chen created the subtask"),
    ]
    db.add_all(activities)
    db.add_all([
        TaskWatcher(task_id=tasks[0].id, user_id=users[1].id),
        TaskWatcher(task_id=tasks[0].id, user_id=users[2].id),
        TaskWatcher(task_id=tasks[0].id, user_id=users[3].id),
        TaskWatcher(task_id=tasks[2].id, user_id=users[4].id),
        TaskWatcher(task_id=tasks[2].id, user_id=users[5].id),
        TaskWatcher(task_id=tasks[4].id, user_id=users[8].id),
        TaskWatcher(task_id=tasks[4].id, user_id=users[9].id),
    ])

    uploads_root = Path(get_settings().uploads_dir)
    uploads_root.mkdir(parents=True, exist_ok=True)
    sample_dir = uploads_root / f"task_{tasks[0].id}"
    sample_dir.mkdir(parents=True, exist_ok=True)
    sample_file = sample_dir / "handoff-note.txt"
    sample_file.write_text("Billing escalation handoff note for leadership review.", encoding="utf-8")
    db.add(
        TaskAttachment(
            task_id=tasks[0].id,
            file_name="handoff-note.txt",
            file_path=f"/uploads/task_{tasks[0].id}/handoff-note.txt",
            uploaded_by=users[1].id,
        )
    )

    sprints = [
        Sprint(organization_id=organizations[0].id, name="Northstar Incident Sprint", goal="Stabilize escalation and communications", start_date=now.date(), end_date=(now + timedelta(days=10)).date(), status="ACTIVE"),
        Sprint(organization_id=organizations[1].id, name="Aether Release Readiness", goal="Remove blockers before deployment", start_date=now.date(), end_date=(now + timedelta(days=14)).date(), status="PLANNED"),
    ]
    db.add_all(sprints)
    db.flush()
    tasks[0].sprint_id = sprints[0].id
    tasks[1].sprint_id = sprints[0].id
    tasks[2].sprint_id = sprints[1].id

    templates = [
        TaskTemplate(organization_id=organizations[0].id, name="Incident Follow-up", title_template="Document incident follow-up actions", description_template="Capture root cause, timeline, owner, and stakeholder communications.", default_priority="medium", default_tags='["incident","follow-up"]', default_sla=24),
        TaskTemplate(organization_id=organizations[1].id, name="Release Checklist Task", title_template="Validate release gate", description_template="Review release readiness gate and confirm owners.", default_priority="high", default_tags='["release","ops"]', default_sla=12),
    ]
    db.add_all(templates)
    db.flush()

    recurring = [
        RecurringTask(organization_id=organizations[0].id, template_id=templates[0].id, frequency="weekly", next_run_at=now - timedelta(minutes=5), is_active=True),
        RecurringTask(organization_id=organizations[1].id, template_id=templates[1].id, frequency="monthly", next_run_at=now + timedelta(days=30), is_active=True),
    ]
    db.add_all(recurring)

    approvals = [
        TaskApproval(task_id=tasks[1].id, requested_by=users[1].id, approved_by=users[2].id, reason="Need sign-off before publishing workflow changes", status="APPROVED"),
        TaskApproval(task_id=tasks[2].id, requested_by=users[4].id, approved_by=None, reason="Release command center needs approval before launch", status="PENDING"),
    ]
    db.add_all(approvals)

    messages = [
        TaskMessage(task_id=tasks[0].id, user_id=users[1].id, message="Let’s keep the external update tight until we confirm the webhook fix."),
        TaskMessage(task_id=tasks[0].id, user_id=users[3].id, message="Agreed. I’ll post the root cause notes in the next 20 minutes."),
        TaskMessage(task_id=tasks[2].id, user_id=users[5].id, message="Telemetry gap is still the blocker for sign-off."),
    ]
    db.add_all(messages)

    channels = [
        ChatChannel(organization_id=organizations[0].id, name="northstar-ops", description="Org-wide operations room", channel_type="ORG", is_private=False, created_by=users[1].id),
        ChatChannel(organization_id=organizations[0].id, team_id=teams[1].id, name="support-command", description="Support command team room", channel_type="TEAM", is_private=False, created_by=users[2].id),
        ChatChannel(organization_id=organizations[1].id, name="release-watch", description="Release readiness and risk coordination", channel_type="ORG", is_private=False, created_by=users[4].id),
        ChatChannel(organization_id=organizations[2].id, name="store-rollouts", description="Rollout operations and launch updates", channel_type="ORG", is_private=False, created_by=users[7].id),
    ]
    db.add_all(channels)
    db.flush()
    for channel in channels:
        eligible = [user for user in users if user.organization_id == channel.organization_id and (channel.team_id is None or user.team_id == channel.team_id)]
        for member in eligible:
            db.add(ChatMembership(channel_id=channel.id, user_id=member.id, unread_count=0))
    db.add_all(
        [
            ChatMessage(channel_id=channels[0].id, user_id=users[1].id, message="Heads up: executive review of the billing incident starts at 14:00."),
            ChatMessage(channel_id=channels[1].id, user_id=users[2].id, message="Please keep escalation handoffs concise and tagged with @name when ownership shifts."),
            ChatMessage(channel_id=channels[2].id, user_id=users[5].id, message="Telemetry blocker is still active. We should avoid release sign-off until it is closed."),
            ChatMessage(channel_id=channels[3].id, user_id=users[8].id, message="West region training coverage is looking good. Final store roster lands tomorrow morning."),
        ]
    )

    announcements = [
        Announcement(organization_id=organizations[0].id, title="Billing escalation comms change", content="Support leaders should now use the updated stakeholder bridge template for billing incidents.", severity="high", is_pinned=True, created_by=users[1].id, target_role="MANAGER", target_team_id=teams[1].id),
        Announcement(organization_id=organizations[1].id, title="Release freeze window", content="Aether enters a release freeze every Thursday 18:00-20:00 before production windows.", severity="medium", is_pinned=False, created_by=users[4].id, target_role=None, target_team_id=None),
        Announcement(organization_id=organizations[2].id, title="Store rollout policy update", content="All rollout training confirmations must be logged before a regional cutover is approved.", severity="critical", is_pinned=True, created_by=users[7].id, target_role="USER", target_team_id=teams[5].id),
    ]
    db.add_all(announcements)
    db.flush()
    db.add_all(
        [
            AnnouncementRead(announcement_id=announcements[0].id, user_id=users[2].id, is_read=True),
            AnnouncementRead(announcement_id=announcements[1].id, user_id=users[6].id, is_read=False),
        ]
    )

    meeting_summaries = [
        MeetingSummary(organization_id=organizations[0].id, team_id=teams[1].id, title="Billing escalation review", raw_notes="Reviewed webhook failures, stakeholder update cadence, and ownership clarity.", summary="The team aligned on the billing escalation fix path, stakeholder update owner, and follow-up template refresh.", created_by=users[2].id),
        MeetingSummary(organization_id=organizations[1].id, team_id=teams[3].id, title="Release readiness sync", raw_notes="Telemetry blocker, release freeze, and rollback owner review.", summary="The team agreed to hold release sign-off until telemetry gaps close and clarified rollback ownership.", created_by=users[5].id),
    ]
    meeting_summaries[0].action_items = ["Confirm webhook fix deployment", "Publish stakeholder update", "Refresh escalation template"]
    meeting_summaries[0].decisions = ["Use updated stakeholder bridge", "Escalation owner remains support manager"]
    meeting_summaries[0].followups = ["Review webhook metrics tomorrow", "Confirm comms template adoption next week"]
    meeting_summaries[1].action_items = ["Close telemetry blocker", "Validate rollback owner", "Reconfirm release window"]
    meeting_summaries[1].decisions = ["Do not sign off release yet", "Keep freeze window intact"]
    meeting_summaries[1].followups = ["Re-run readiness check tomorrow"]
    db.add_all(meeting_summaries)

    db.add_all(
        [
            SelfNote(user_id=users[3].id, title="Billing check-in", content="Need to confirm claim webhook logs after lunch.", is_pinned=True, color="amber"),
            SelfNote(user_id=users[6].id, title="Release blocker", content="Ask Noah for telemetry dashboard access before the next sync.", is_pinned=False, color="violet"),
            SelfNote(user_id=users[9].id, title="Training follow-up", content="Send west region training checklist to store leads.", is_pinned=True, color="cyan"),
        ]
    )

    onboarding_steps = [
        OnboardingStep(title="Complete your profile", description="Add your title, responsibilities, and team context so others can route work correctly.", role_target=None, action_path="/profile", action_label="Open profile", step_type="profile", sort_order=1),
        OnboardingStep(title="Review key announcements", description="Read the latest important admin messages and org-wide updates.", role_target=None, action_path="/messages", action_label="Open messages", step_type="communications", sort_order=2),
        OnboardingStep(title="Read the operating guide", description="Review the highest-priority knowledge doc for your organization.", role_target="USER", organization_id=organizations[1].id, action_path="/knowledge", action_label="Open knowledge", step_type="knowledge", sort_order=3),
        OnboardingStep(title="Join your team channels", description="Open chat, review your org channels, and introduce yourself in the right room.", role_target=None, action_path="/chat", action_label="Open chat", step_type="collaboration", sort_order=4),
        OnboardingStep(title="Review assigned work", description="Check your open tasks, due dates, and SLA expectations.", role_target=None, action_path="/tasks", action_label="Open tasks", step_type="work", sort_order=5),
        OnboardingStep(title="Configure workspace preferences", description="Choose your task view, density, and notification defaults.", role_target=None, action_path="/settings", action_label="Open settings", step_type="settings", sort_order=6),
        OnboardingStep(title="Set up organization operations", description="Review approval defaults, recurring execution, and org notification routing.", role_target="ADMIN", action_path="/settings", action_label="Open org settings", step_type="admin-setup", sort_order=7),
        OnboardingStep(title="Review organization health", description="Start in the command center and review the highest-risk orgs and alerts.", role_target="SUPER_ADMIN", action_path="/control-center", action_label="Open command center", step_type="system-setup", sort_order=8),
    ]
    db.add_all(onboarding_steps)
    db.flush()
    db.add_all(
        [
            UserOnboardingProgress(user_id=users[3].id, step_id=onboarding_steps[0].id, is_completed=True),
            UserOnboardingProgress(user_id=users[3].id, step_id=onboarding_steps[1].id, is_completed=False),
            UserOnboardingProgress(user_id=users[1].id, step_id=onboarding_steps[6].id, is_completed=True),
            UserOnboardingProgress(user_id=users[0].id, step_id=onboarding_steps[7].id, is_completed=False),
        ]
    )

    db.add_all(
        [
            OrganizationIntegration(organization_id=organizations[0].id, provider="github", is_enabled=True, config_json='{"owner": "compheart", "repo": "northstar-ops", "webhook_status": "ready"}'),
            OrganizationIntegration(organization_id=organizations[0].id, provider="slack", is_enabled=True, config_json='{"workspace": "northstar-hq", "default_channel": "#northstar-ops"}'),
            OrganizationIntegration(organization_id=organizations[0].id, provider="email", is_enabled=True, config_json='{"sender_name": "Northstar Ops", "mode": "mock"}'),
            OrganizationIntegration(organization_id=organizations[1].id, provider="github", is_enabled=True, config_json='{"owner": "compheart", "repo": "aether-platform", "webhook_status": "ready"}'),
            OrganizationIntegration(organization_id=organizations[1].id, provider="slack", is_enabled=True, config_json='{"workspace": "aether-labs", "default_channel": "#release-watch"}'),
            OrganizationIntegration(organization_id=organizations[1].id, provider="email", is_enabled=True, config_json='{"sender_name": "Aether Operations", "mode": "mock"}'),
            OrganizationIntegration(organization_id=organizations[2].id, provider="github", is_enabled=False, config_json='{"owner": "compheart", "repo": "harbor-rollouts"}'),
            OrganizationIntegration(organization_id=organizations[2].id, provider="slack", is_enabled=False, config_json='{"workspace": "harbor-commerce"}'),
            OrganizationIntegration(organization_id=organizations[2].id, provider="email", is_enabled=True, config_json='{"sender_name": "Harbor Operations", "mode": "mock"}'),
        ]
    )

    rules = [
        AutomationRule(name="Northstar Overdue SLA Alert", description="Escalates overdue support tasks to the manager and notification center.", organization_id=organizations[0].id, trigger_type="task.updated", condition_json='{"sla_status": "breached"}', action_json='{"type": "notify", "audience": "managers", "severity": "critical"}', is_enabled=True),
        AutomationRule(name="Aether High Priority Release Ping", description="Notifies automation leadership when critical release tasks appear.", organization_id=organizations[1].id, trigger_type="task.created", condition_json='{"priority": "critical"}', action_json='{"type": "notify", "audience": "managers", "severity": "high"}', is_enabled=True),
        AutomationRule(name="Harbor Rollout Playbook Boost", description="Boosts retail rollout knowledge in the AI assistant.", organization_id=organizations[2].id, trigger_type="knowledge.updated", condition_json='{"category": "operations"}', action_json='{"type": "ai_suggest", "weight": "boost"}', is_enabled=True),
    ]
    db.add_all(rules)

    notifications = [
        Notification(title="Northstar SLA warning", message="Patient billing escalation is now overdue and visible to support leadership.", organization_id=organizations[0].id, type="sla", severity="critical", user_id=users[3].id, role_target="MANAGER", is_org_wide=False, is_read=False),
        Notification(title="Northstar org announcement", message="Incident update templates were refreshed for all support teams.", organization_id=organizations[0].id, type="announcement", severity="low", user_id=None, role_target=None, is_org_wide=True, is_read=False),
        Notification(title="Mentioned in task comment", message="Leo Grant mentioned you in Stabilize patient billing escalation lane.", organization_id=organizations[0].id, type="mention", severity="medium", user_id=users[2].id, role_target=None, is_org_wide=False, is_read=False),
        Notification(title="Aether release risk elevated", message="Friday release command center has entered high-risk status.", organization_id=organizations[1].id, type="task", severity="high", user_id=users[6].id, role_target="MANAGER", is_org_wide=False, is_read=False),
        Notification(title="Aether automation note", message="Automation severity mapping review was added to your queue.", organization_id=organizations[1].id, type="automation", severity="medium", user_id=users[6].id, role_target=None, is_org_wide=False, is_read=False),
        Notification(title="Harbor rollout announcement", message="West region rollout prep is entering final coordination mode.", organization_id=organizations[2].id, type="announcement", severity="medium", user_id=None, role_target="MANAGER", is_org_wide=True, is_read=False),
        Notification(title="Harbor checklist refresh", message="Coordinator checklist refresh task is now live.", organization_id=organizations[2].id, type="knowledge", severity="low", user_id=users[9].id, role_target=None, is_org_wide=False, is_read=True),
    ]
    db.add_all(notifications)

    audit_logs = [
        AuditLog(organization_id=organizations[0].id, user_id=users[1].id, action="user_created", entity_type="User", entity_id=users[3].id, details="leo@northstar.local"),
        AuditLog(organization_id=organizations[0].id, user_id=users[1].id, action="task_updated", entity_type="Task", entity_id=tasks[0].id, details="Stabilize patient billing escalation lane"),
        AuditLog(organization_id=organizations[1].id, user_id=users[4].id, action="approval_requested", entity_type="TaskApproval", entity_id=2, details="Prepare release command center"),
        AuditLog(organization_id=organizations[0].id, user_id=users[1].id, action="integration_updated", entity_type="OrganizationIntegration", entity_id=1, details="github"),
    ]
    db.add_all(audit_logs)
    email_log = SentEmail(
        organization_id=organizations[0].id,
        sender_user_id=users[1].id,
        subject="Billing escalation leadership update",
        body="Sharing the current status before the afternoon review.",
        task_id=tasks[0].id,
        status="SENT",
    )
    email_log.recipient_ids = [users[2].id, users[3].id]
    db.add(email_log)

    conversations = [
        AIConversation(title="How do we handle Northstar incidents?", organization_id=organizations[0].id, user_id=users[3].id),
        AIConversation(title="How should we prep the Aether release?", organization_id=organizations[1].id, user_id=users[6].id),
    ]
    db.add_all(conversations)
    db.flush()
    db.add_all(
        [
            AIMessage(conversation_id=conversations[0].id, role="user", content="How do we handle critical incidents?"),
            AIMessage(conversation_id=conversations[0].id, role="assistant", content="Use the Northstar Incident Command Runbook: acknowledge within 15 minutes, assign a commander, and open the stakeholder bridge."),
            AIMessage(conversation_id=conversations[1].id, role="user", content="What should I review before the release?"),
            AIMessage(conversation_id=conversations[1].id, role="assistant", content="Review rollback ownership, telemetry coverage, communication plans, and automation rule health before the release window."),
        ]
    )

    db.commit()
