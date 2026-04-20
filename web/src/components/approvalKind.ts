export const APPROVAL_KIND_COLOR: Record<string, string> = {
  package_install:     '#f97316',
  lockfile_change:     '#eab308',
  merge_conflict:      '#ef4444',
  protected_merge:     '#ef4444',
  major_change:        '#f97316',
  sensitive_file:      '#ef4444',
  destructive_delete:  '#ef4444',
  network_deploy:      '#a855f7',
  architectural_block: '#a855f7',
  milestone:           '#3b82f6',
}

export const APPROVAL_KIND_ICON: Record<string, string> = {
  package_install:     '📦',
  lockfile_change:     '🔒',
  merge_conflict:      '⚡',
  protected_merge:     '🛡',
  major_change:        '⚠️',
  sensitive_file:      '🚨',
  destructive_delete:  '🗑',
  network_deploy:      '🚀',
  architectural_block: '🏗',
  milestone:           '🏁',
}

export function approvalKindColor(kind: string): string {
  return APPROVAL_KIND_COLOR[kind] ?? '#6b7280'
}

export function approvalKindIcon(kind: string): string {
  return APPROVAL_KIND_ICON[kind] ?? '⚠️'
}
