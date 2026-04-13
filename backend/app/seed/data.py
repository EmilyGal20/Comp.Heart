from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.ai import AIConversation, AIMessage
from app.models.automation import AutomationRule
from app.models.knowledge import KnowledgeItem, KnowledgeTag
from app.models.notification import Notification
from app.models.organization import Organization
from app.models.task import Task, TaskActivity, TaskAttachment, TaskComment, TaskWatcher
from app.models.user import Team, User


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
