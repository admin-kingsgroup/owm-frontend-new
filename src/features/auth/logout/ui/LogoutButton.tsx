import { Button } from '@/shared/ui';

import { useAuthStore } from '../../model/auth-store';

export function LogoutButton() {
  const logout = useAuthStore((state) => state.logout);

  function handleClick() {
    logout().catch(() => {
      // logout always clears local session, even if the request itself failed
    });
  }

  return (
    <Button type="button" variant="ghost" onClick={handleClick}>
      Log out
    </Button>
  );
}
