
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_credits(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refund_credits(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_generation_credit() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refund_generation_credit(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_credit_status(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.consume_credits(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credits(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_generation_credit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_generation_credit(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_credit_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
