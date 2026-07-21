// ============================================================
// Vault types
// ============================================================

/** Template types for vault entries. */
export type VaultTemplate = 'secret_note' | 'account' | 'card' | 'custom';

/** A field in a vault entry. */
export interface VaultField {
  key: string;
  value: string;
  /** Whether this field should be masked by default (e.g. passwords). */
  sensitive?: boolean;
}

/** Decrypted entry data (client-side only, never sent to server). */
export interface VaultEntryData {
  title: string;
  fields: VaultField[];
}

/** Entry as stored on server (encrypted). */
export interface VaultEntryRow {
  id: string;
  user_id: string;
  template_type: VaultTemplate;
  /** Base64-encoded encrypted title. */
  encrypted_title: string;
  /** Base64-encoded IV for title. */
  iv_title: string;
  /** Base64-encoded encrypted data (JSON of VaultField[]). */
  encrypted_data: string;
  /** Base64-encoded IV for data. */
  iv_data: string;
  created_at: string;
  updated_at: string;
}

/** Vault metadata row (1 per user). */
export interface VaultMetaRow {
  user_id: string;
  /** Base64-encoded salt for PBKDF2. */
  salt: string;
  /** Base64-encoded passphrase verifier (SHA-256 of derived key). */
  passphrase_verifier: string;
  /** Base64-encoded wrapped master key (by passphrase-derived key). */
  encrypted_master_key_passphrase: string;
  /** Base64-encoded wrapped master key (by recovery key). */
  encrypted_master_key_recovery: string;
  created_at: string;
  updated_at: string;
}

/** Decrypted entry for UI rendering. */
export interface VaultEntry {
  id: string;
  templateType: VaultTemplate;
  title: string;
  fields: VaultField[];
  createdAt: string;
  updatedAt: string;
}

/** Template field definitions. */
export interface TemplateDefinition {
  type: VaultTemplate;
  label: string;
  icon: string;
  defaultFields: Omit<VaultField, 'value'>[];
}