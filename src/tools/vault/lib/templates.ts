// ============================================================
// Vault entry templates
// ============================================================

import type { VaultTemplate, VaultField } from '../types';

export interface TemplateConfig {
  type: VaultTemplate;
  label: string;
  description: string;
  defaultFields: Omit<VaultField, 'value'>[];
}

export const TEMPLATES: TemplateConfig[] = [
  {
    type: 'secret_note',
    label: 'Secret Note',
    description: 'Ghi chu bi mat — title + noi dung',
    defaultFields: [
      { key: 'content', sensitive: false },
    ],
  },
  {
    type: 'account',
    label: 'Account',
    description: 'Tai khoan — username, password, URL',
    defaultFields: [
      { key: 'username', sensitive: false },
      { key: 'password', sensitive: true },
      { key: 'url', sensitive: false },
      { key: 'notes', sensitive: false },
    ],
  },
  {
    type: 'card',
    label: 'Card',
    description: 'The ngan hang — so the, ngay het han, CVV',
    defaultFields: [
      { key: 'card_number', sensitive: true },
      { key: 'expiry', sensitive: false },
      { key: 'cvv', sensitive: true },
      { key: 'notes', sensitive: false },
    ],
  },
  {
    type: 'custom',
    label: 'Custom',
    description: 'Tu dinh nghia fields',
    defaultFields: [],
  },
];

export function getTemplateConfig(type: VaultTemplate): TemplateConfig {
  return TEMPLATES.find((t) => t.type === type) ?? TEMPLATES[3]; // fallback custom
}