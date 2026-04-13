from sqlalchemy.orm import Session

from app.models.collaboration import OrganizationSetting, UserWorkspaceSetting


def get_or_create_workspace_setting(db: Session, user_id: int):
    setting = db.query(UserWorkspaceSetting).filter(UserWorkspaceSetting.user_id == user_id).first()
    if setting:
        return setting
    setting = UserWorkspaceSetting(user_id=user_id)
    db.add(setting)
    db.commit()
    db.refresh(setting)
    return setting


def get_or_create_organization_setting(db: Session, organization_id: int):
    setting = db.query(OrganizationSetting).filter(OrganizationSetting.organization_id == organization_id).first()
    if setting:
        return setting
    setting = OrganizationSetting(organization_id=organization_id)
    db.add(setting)
    db.commit()
    db.refresh(setting)
    return setting
