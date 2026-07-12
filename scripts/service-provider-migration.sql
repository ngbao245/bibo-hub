-- ============================================================
-- Service Provider Architecture Migration
-- ============================================================
-- Refactor từ tool-centric config sang provider-centric config
-- với credential pooling, fail-over và quota management.
-- ============================================================

-- 1. Service Providers
-- Đại diện cho loại external service
CREATE TABLE IF NOT EXISTS service_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- ai, pdf, storage, realtime, networking, conversion, ocr, email
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'disabled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_service_providers_code ON service_providers(code);
CREATE INDEX idx_service_providers_category ON service_providers(category);

-- 2. Service Profiles
-- Một provider có thể có nhiều profile hoặc pool
CREATE TABLE IF NOT EXISTS service_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES service_providers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'archived')),
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(provider_id, name)
);

CREATE INDEX idx_service_profiles_provider ON service_profiles(provider_id);
CREATE INDEX idx_service_profiles_status ON service_profiles(status);

-- 3. Service Credentials
-- Mỗi API key, OAuth account là một record riêng
CREATE TABLE IF NOT EXISTS service_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES service_profiles(id) ON DELETE CASCADE,
  name TEXT,
  identifier TEXT, -- email, account ID, key name
  public_data JSONB DEFAULT '{}'::jsonb, -- non-sensitive data
  secret_encrypted TEXT, -- encrypted API key, tokens, etc
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'exhausted', 'cooldown', 'invalid', 'error')),
  priority INTEGER DEFAULT 0,
  weight INTEGER DEFAULT 1, -- for weighted selection
  
  -- Quota management
  quota_limit INTEGER,
  quota_used INTEGER DEFAULT 0,
  quota_reset_at TIMESTAMPTZ,
  
  -- Health tracking
  last_used_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  last_error_code TEXT,
  last_error_message TEXT,
  cooldown_until TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_service_credentials_profile ON service_credentials(profile_id);
CREATE INDEX idx_service_credentials_status ON service_credentials(status);
CREATE INDEX idx_service_credentials_priority ON service_credentials(priority DESC);

-- 4. Tool Service Bindings
-- Nối tool với shared service profile
CREATE TABLE IF NOT EXISTS tool_service_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_code TEXT NOT NULL, -- pdf-compress, rag-search, email-generator
  capability TEXT NOT NULL, -- pdf.compress, ai.generate, storage.backup
  profile_id UUID NOT NULL REFERENCES service_profiles(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- 0 = primary, 1+ = fallback
  enabled BOOLEAN DEFAULT true,
  overrides JSONB DEFAULT '{}'::jsonb, -- tool-specific overrides
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tool_code, capability, profile_id)
);

CREATE INDEX idx_tool_bindings_tool ON tool_service_bindings(tool_code);
CREATE INDEX idx_tool_bindings_capability ON tool_service_bindings(capability);
CREATE INDEX idx_tool_bindings_profile ON tool_service_bindings(profile_id);
CREATE INDEX idx_tool_bindings_priority ON tool_service_bindings(tool_code, capability, priority);

-- 5. Tool Settings
-- Config thuộc riêng tool, không thuộc provider
CREATE TABLE IF NOT EXISTS tool_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_code TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tool_settings_code ON tool_settings(tool_code);

-- ============================================================
-- Seed Data - Common Providers
-- ============================================================

INSERT INTO service_providers (code, name, category, description) VALUES
  ('gemini', 'Google Gemini', 'ai', 'Google Generative AI for embeddings and chat'),
  ('ilovepdf', 'iLovePDF', 'pdf', 'PDF manipulation and compression service'),
  ('cloudconvert', 'CloudConvert', 'conversion', 'Universal file conversion service'),
  ('google_drive', 'Google Drive', 'storage', 'Google Drive cloud storage'),
  ('firebase', 'Firebase', 'realtime', 'Firebase Realtime Database and services'),
  ('metered_turn', 'Metered TURN', 'networking', 'TURN server for WebRTC'),
  ('ocr_space', 'OCR.space', 'ocr', 'OCR service for text extraction'),
  ('sendgrid', 'SendGrid', 'email', 'Email delivery service')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- Migration Helper Views
-- ============================================================

-- View to see all active credentials per profile
CREATE OR REPLACE VIEW v_active_credentials AS
SELECT 
  sp.code as provider_code,
  sp.name as provider_name,
  spr.name as profile_name,
  sc.name as credential_name,
  sc.status,
  sc.quota_used,
  sc.quota_limit,
  sc.last_success_at,
  sc.cooldown_until
FROM service_credentials sc
JOIN service_profiles spr ON sc.profile_id = spr.id
JOIN service_providers sp ON spr.provider_id = sp.id
WHERE sc.status IN ('active', 'cooldown')
  AND spr.status = 'active'
  AND sp.status = 'active'
ORDER BY sp.code, spr.name, sc.priority DESC;

-- View to see tool-service bindings with provider info
CREATE OR REPLACE VIEW v_tool_bindings AS
SELECT 
  tsb.tool_code,
  tsb.capability,
  sp.code as provider_code,
  sp.name as provider_name,
  spr.name as profile_name,
  tsb.is_primary,
  tsb.priority,
  tsb.enabled,
  tsb.overrides
FROM tool_service_bindings tsb
JOIN service_profiles spr ON tsb.profile_id = spr.id
JOIN service_providers sp ON spr.provider_id = sp.id
WHERE tsb.enabled = true
  AND spr.status = 'active'
  AND sp.status = 'active'
ORDER BY tsb.tool_code, tsb.capability, tsb.priority;

-- ============================================================
-- RLS Policies (nếu cần)
-- ============================================================
-- Tùy theo yêu cầu security, có thể thêm RLS policies
-- Ví dụ: chỉ admin mới được quản lý credentials

-- ALTER TABLE service_providers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE service_profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE service_credentials ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tool_service_bindings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tool_settings ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY admin_all_providers ON service_providers
--   FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================================
-- Trigger to update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_service_providers_updated_at BEFORE UPDATE ON service_providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_profiles_updated_at BEFORE UPDATE ON service_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_credentials_updated_at BEFORE UPDATE ON service_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tool_service_bindings_updated_at BEFORE UPDATE ON tool_service_bindings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tool_settings_updated_at BEFORE UPDATE ON tool_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
