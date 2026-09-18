from fastapi import APIRouter

from ...services.rbac import (
    get_feature_catalogue,
    list_roles,
    create_role,
    update_role,
    delete_role,
    list_users,
    create_user,
    update_user,
    delete_user,
)

router = APIRouter()


@router.get("/api/rbac/features")
def api_rbac_features():
    return get_feature_catalogue()


# --------------------------------------------------------------------------
# Roles
# --------------------------------------------------------------------------

@router.get("/api/rbac/roles")
def api_list_roles():
    return list_roles()


@router.post("/api/rbac/roles")
def api_create_role(payload: dict):
    return create_role(payload or {})


@router.put("/api/rbac/roles/{role_id}")
def api_update_role(role_id: int, payload: dict):
    return update_role(role_id, payload or {})


@router.delete("/api/rbac/roles/{role_id}")
def api_delete_role(role_id: int):
    return delete_role(role_id)


# --------------------------------------------------------------------------
# Users
# --------------------------------------------------------------------------

@router.get("/api/rbac/users")
def api_list_users():
    return list_users()


@router.post("/api/rbac/users")
def api_create_user(payload: dict):
    return create_user(payload or {})


@router.put("/api/rbac/users/{user_id}")
def api_update_user(user_id: int, payload: dict):
    return update_user(user_id, payload or {})


@router.delete("/api/rbac/users/{user_id}")
def api_delete_user(user_id: int):
    return delete_user(user_id)