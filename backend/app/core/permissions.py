ROLE_SUPER_ADMIN = "SUPER_ADMIN"
ROLE_ADMIN = "ADMIN"
ROLE_MANAGER = "MANAGER"
ROLE_USER = "USER"

ROLE_LEVELS = {
    ROLE_USER: 10,
    ROLE_MANAGER: 20,
    ROLE_ADMIN: 30,
    ROLE_SUPER_ADMIN: 40,
}


def has_role(user, minimum_role: str) -> bool:
    return ROLE_LEVELS.get(user.role, 0) >= ROLE_LEVELS.get(minimum_role, 0)


def can_manage_role(actor, target_role: str) -> bool:
    if actor.role == ROLE_SUPER_ADMIN:
        return True
    if actor.role == ROLE_ADMIN:
        return target_role in {ROLE_MANAGER, ROLE_USER, ROLE_ADMIN}
    if actor.role == ROLE_MANAGER:
        return target_role == ROLE_USER
    return False
