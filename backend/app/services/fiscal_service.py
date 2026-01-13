from backend.supabase_client import supabase

def create_fiscal_data(user_id: str, data: dict):
    payload = {**data, "user_id": user_id}
    return supabase.table("user_fiscal_data").insert(payload).execute()

def update_fiscal_data(user_id: str, data: dict):
    return (
        supabase.table("user_fiscal_data")
        .update(data)
        .eq("user_id", user_id)
        .execute()
    )

def get_fiscal_data(user_id: str):
    res = (
        supabase.table("user_fiscal_data")
        .select("*")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None
