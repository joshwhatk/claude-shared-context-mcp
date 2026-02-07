import { useEffect } from 'react';

const APP_NAME = 'Shared Context MCP';

export function usePageTitle(page?: string) {
  useEffect(() => {
    document.title = page ? `${page} | ${APP_NAME}` : APP_NAME;
    return () => { document.title = APP_NAME; };
  }, [page]);
}
