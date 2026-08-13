export const ADMIN_USER_ID = 'usr_1785645840720_7coat';

export function canAccessAdminPanel(user: { id?: string; isAdmin?: boolean } | null | undefined): boolean {
  return user?.id === ADMIN_USER_ID && user.isAdmin === true;
}
