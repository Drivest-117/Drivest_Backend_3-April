export type ApiUserRole = 'learner' | 'instructor' | 'admin';

export interface AuthenticatedRequestUser {
  userId: string;
  email?: string;
  role?: string;
}

export function normaliseRole(role: string | undefined): ApiUserRole | null {
  if (!role) return null;
  const value = role.toLowerCase();
  if (value === 'admin') return 'admin';
  if (value === 'instructor') return 'instructor';
  if (value === 'learner' || value === 'user') return 'learner';
  return null;
}
