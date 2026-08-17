import { BrowserRouter, useRoutes } from 'react-router-dom';

import { routes } from './routes';

function Routes() {
  return useRoutes(routes);
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes />
    </BrowserRouter>
  );
}
