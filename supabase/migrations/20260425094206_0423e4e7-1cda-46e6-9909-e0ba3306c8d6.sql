-- Secure function to check access without exposing full client table
CREATE OR REPLACE FUNCTION public.check_bolao_access(p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_phone TEXT;
    v_result JSONB;
BEGIN
    -- Normalize search phone (strip non-digits)
    v_clean_phone := regexp_replace(p_phone, '\D', '', 'g');
    
    IF v_clean_phone = '' THEN
        RETURN NULL;
    END IF;

    -- Check clients table
    SELECT jsonb_build_object(
        'id', id,
        'name', name,
        'status', status,
        'is_client', (status = 'active')
    ) INTO v_result
    FROM clients
    WHERE (phone IS NOT NULL AND regexp_replace(phone, '\D', '', 'g') ~ v_clean_phone)
       OR (whatsapp IS NOT NULL AND regexp_replace(whatsapp, '\D', '', 'g') ~ v_clean_phone)
    ORDER BY (status = 'active') DESC
    LIMIT 1;

    IF v_result IS NOT NULL THEN
        RETURN v_result;
    END IF;

    -- Check bolao_leads
    SELECT jsonb_build_object(
        'id', id,
        'name', name,
        'status', 'active',
        'is_client', false
    ) INTO v_result
    FROM bolao_leads
    WHERE regexp_replace(phone, '\D', '', 'g') ~ v_clean_phone
    LIMIT 1;

    RETURN v_result;
END;
$$;

-- Grant access to public for this RPC
GRANT EXECUTE ON FUNCTION public.check_bolao_access(TEXT) TO public;
GRANT EXECUTE ON FUNCTION public.check_bolao_access(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_bolao_access(TEXT) TO authenticated;
