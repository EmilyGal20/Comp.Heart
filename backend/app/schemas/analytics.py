from pydantic import BaseModel


class TaskRiskRead(BaseModel):
    task_id: int
    title: str
    assignee: str
    team: str
    risk_score: int
    risk_level: str
    reasons: list[str]


class UserRiskRead(BaseModel):
    user_id: int
    full_name: str
    team: str
    open_tasks: int
    breached_tasks: int
    high_priority_tasks: int
    overload_score: int
    risk_level: str


class TeamRiskRead(BaseModel):
    team_id: int | None
    team_name: str
    open_tasks: int
    breached_tasks: int
    avg_risk_score: int
    risk_level: str
