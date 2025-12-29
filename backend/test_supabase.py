from supabase_client import get_supabase

supabase = get_supabase()

res = supabase.table("prints").select("*").limit(1).execute()
print(res)
