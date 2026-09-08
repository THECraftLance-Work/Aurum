export function getProjectIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const m = cookieHeader.match(/(?:^|; )srivaraha_project=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : null;
}
