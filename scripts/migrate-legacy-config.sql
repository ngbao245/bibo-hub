-- ============================================================
-- Migration Script: Legacy Config → Service Provider Architecture
-- ============================================================
-- Script này migrate data từ app_settings sang bảng mới
-- Chạy SAU KHI đã chạy service-provider-migration.sql

-- ============================================================
-- 1. Migrate Gemini Credit Pool
-- ============================================================

DO $$
DECLARE
  gemini_provider_id UUID;
  gemini_profile_id UUID;
  gemini_config JSONB;
  key_entry JSONB;
  key_index INT := 0;
BEGIN
  -- Lấy provider ID
  SELECT id INTO gemini_provider_id
  FROM service_providers
  WHERE code = 'gemini';

  -- Tạo default profile
  INSERT INTO service_profiles (provider_id, name, description, status, settings)
  VALUES (
    gemini_provider_id,
    'Default Gemini Pool',
    'Shared Gemini API keys for RAG, AI generation, and other services',
    'active',
    '{
      "keySelectionStrategy": "round_robin",
      "defaultModel": "gemini-1.5-flash",
      "defaultTemperature": 0.7,
      "maxRetries": 3
    }'::jsonb
  )
  RETURNING id INTO gemini_profile_id;

  -- Load gemini_credit_pool từ app_settings
  SELECT value INTO gemini_config
  FROM app_settings
  WHERE key = 'gemini_credit_pool';

  -- Nếu không có, thử key cũ 'rag_tokens'
  IF gemini_config IS NULL THEN
    SELECT value INTO gemini_config
    FROM app_settings
    WHERE key = 'rag_tokens';
  END IF;

  -- Migrate từng key entry
  IF gemini_config IS NOT NULL AND gemini_config ? 'keys' THEN
    FOR key_entry IN SELECT * FROM jsonb_array_elements(gemini_config->'keys')
    LOOP
      INSERT INTO service_credentials (
        profile_id,
        name,
        identifier,
        public_data,
        secret_encrypted,
        status,
        priority,
        weight,
        quota_limit,
        quota_used
      )
      VALUES (
        gemini_profile_id,
        COALESCE(key_entry->>'name', 'Gemini Key ' || key_index),
        'gemini-api-key-' || key_index,
        '{}'::jsonb,
        key_entry->>'key', -- TODO: Encrypt this in production
        'active',
        key_index,
        1,
        1500, -- Default Gemini free tier quota
        0
      );
      
      key_index := key_index + 1;
    END LOOP;
  END IF;

  -- Tạo bindings cho các tool đang dùng Gemini
  INSERT INTO tool_service_bindings (tool_code, capability, profile_id, is_primary, priority, enabled, overrides)
  VALUES
    ('rag-search', 'ai.embed', gemini_profile_id, true, 0, true, '{}'::jsonb),
    ('rag-search', 'ai.chat', gemini_profile_id, true, 0, true, '{"model": "gemini-1.5-flash"}'::jsonb),
    ('email-generator', 'ai.generate', gemini_profile_id, true, 0, true, '{"model": "gemini-1.5-pro", "temperature": 0.8}'::jsonb);

  RAISE NOTICE 'Migrated Gemini credentials: % keys', key_index;
END $$;

-- ============================================================
-- 2. Migrate iLovePDF Compress Config
-- ============================================================

DO $$
DECLARE
  ilovepdf_provider_id UUID;
  ilovepdf_profile_id UUID;
  compress_config JSONB;
  key_entry JSONB;
  key_index INT := 0;
  compression_level TEXT;
BEGIN
  -- Lấy provider ID
  SELECT id INTO ilovepdf_provider_id
  FROM service_providers
  WHERE code = 'ilovepdf';

  -- Load compress_config
  SELECT value INTO compress_config
  FROM app_settings
  WHERE key = 'compress_config';

  IF compress_config IS NULL THEN
    RAISE NOTICE 'No compress_config found, skipping iLovePDF migration';
    RETURN;
  END IF;

  -- Lấy compression level
  compression_level := COALESCE(compress_config->>'compression_level', 'recommended');

  -- Tạo profile
  INSERT INTO service_profiles (provider_id, name, description, status, settings)
  VALUES (
    ilovepdf_provider_id,
    'Main PDF Pool',
    'iLovePDF API credentials for PDF operations',
    'active',
    jsonb_build_object(
      'keySelectionStrategy', 'round_robin',
      'defaultCompressionLevel', compression_level
    )
  )
  RETURNING id INTO ilovepdf_profile_id;

  -- Migrate credentials
  IF compress_config ? 'keys' THEN
    FOR key_entry IN SELECT * FROM jsonb_array_elements(compress_config->'keys')
    LOOP
      INSERT INTO service_credentials (
        profile_id,
        name,
        identifier,
        public_data,
        secret_encrypted,
        status,
        priority,
        weight
      )
      VALUES (
        ilovepdf_profile_id,
        COALESCE(key_entry->>'name', 'iLovePDF Account ' || key_index),
        key_entry->>'public_key',
        jsonb_build_object('public_key', key_entry->>'public_key'),
        key_entry->>'secret_key', -- TODO: Encrypt this
        'active',
        key_index,
        1
      );
      
      key_index := key_index + 1;
    END LOOP;
  END IF;

  -- Tạo binding
  INSERT INTO tool_service_bindings (tool_code, capability, profile_id, is_primary, priority, enabled, overrides)
  VALUES
    ('pdf-compress', 'pdf.compress', ilovepdf_profile_id, true, 0, true, 
     jsonb_build_object('compressionLevel', compression_level));

  RAISE NOTICE 'Migrated iLovePDF credentials: % keys', key_index;
END $$;

-- ============================================================
-- 3. Migrate Google Drive Backup Config
-- ============================================================

DO $$
DECLARE
  drive_provider_id UUID;
  drive_profile_id UUID;
  drive_config JSONB;
BEGIN
  -- Lấy provider ID
  SELECT id INTO drive_provider_id
  FROM service_providers
  WHERE code = 'google_drive';

  -- Load drive_backup_config
  SELECT value INTO drive_config
  FROM app_settings
  WHERE key = 'drive_backup_config';

  IF drive_config IS NULL THEN
    RAISE NOTICE 'No drive_backup_config found, skipping Google Drive migration';
    RETURN;
  END IF;

  -- Tạo profile
  INSERT INTO service_profiles (provider_id, name, description, status, settings)
  VALUES (
    drive_provider_id,
    'Library Backup',
    'Google Drive OAuth for backing up library files',
    'active',
    jsonb_build_object(
      'folderId', drive_config->>'folder_id'
    )
  )
  RETURNING id INTO drive_profile_id;

  -- Tạo credential
  INSERT INTO service_credentials (
    profile_id,
    name,
    identifier,
    public_data,
    secret_encrypted,
    status,
    priority,
    weight
  )
  VALUES (
    drive_profile_id,
    COALESCE(drive_config->>'name', 'Library Backup Account'),
    drive_config->>'client_id',
    jsonb_build_object(
      'client_id', drive_config->>'client_id',
      'folder_id', drive_config->>'folder_id'
    ),
    jsonb_build_object(
      'client_secret', drive_config->>'client_secret',
      'refresh_token', drive_config->>'refresh_token'
    )::text, -- TODO: Encrypt this
    'active',
    0,
    1
  );

  -- Tạo binding
  INSERT INTO tool_service_bindings (tool_code, capability, profile_id, is_primary, priority, enabled, overrides)
  VALUES
    ('library', 'storage.backup', drive_profile_id, true, 0, true, '{}'::jsonb);

  RAISE NOTICE 'Migrated Google Drive backup config';
END $$;

-- ============================================================
-- 4. Migrate P2P Config
-- ============================================================

DO $$
DECLARE
  firebase_provider_id UUID;
  firebase_profile_id UUID;
  metered_provider_id UUID;
  metered_profile_id UUID;
  p2p_config JSONB;
BEGIN
  -- Load p2p_config
  SELECT value INTO p2p_config
  FROM app_settings
  WHERE key = 'p2p_config';

  IF p2p_config IS NULL THEN
    RAISE NOTICE 'No p2p_config found, skipping P2P migration';
    RETURN;
  END IF;

  -- Firebase
  SELECT id INTO firebase_provider_id FROM service_providers WHERE code = 'firebase';
  
  IF p2p_config ? 'firebase' THEN
    INSERT INTO service_profiles (provider_id, name, description, status, settings)
    VALUES (
      firebase_provider_id,
      'P2P Signaling',
      'Firebase Realtime Database for WebRTC signaling',
      'active',
      p2p_config->'firebase'
    )
    RETURNING id INTO firebase_profile_id;

    INSERT INTO tool_service_bindings (tool_code, capability, profile_id, is_primary, priority, enabled, overrides)
    VALUES
      ('p2p-transfer', 'realtime.signaling', firebase_profile_id, true, 0, true, '{}'::jsonb);
  END IF;

  -- Metered TURN
  SELECT id INTO metered_provider_id FROM service_providers WHERE code = 'metered_turn';
  
  IF p2p_config ? 'metered' THEN
    INSERT INTO service_profiles (provider_id, name, description, status, settings)
    VALUES (
      metered_provider_id,
      'P2P TURN Server',
      'Metered TURN server for WebRTC NAT traversal',
      'active',
      p2p_config->'metered'
    )
    RETURNING id INTO metered_profile_id;

    INSERT INTO tool_service_bindings (tool_code, capability, profile_id, is_primary, priority, enabled, overrides)
    VALUES
      ('p2p-transfer', 'networking.turn', metered_profile_id, true, 0, true, '{}'::jsonb);
  END IF;

  RAISE NOTICE 'Migrated P2P config';
END $$;

-- ============================================================
-- Summary
-- ============================================================

SELECT 
  'Migration Summary' as step,
  (SELECT COUNT(*) FROM service_profiles) as profiles_created,
  (SELECT COUNT(*) FROM service_credentials) as credentials_created,
  (SELECT COUNT(*) FROM tool_service_bindings) as bindings_created;
