export * from './ui/AppShell';
/* Screens publish their own actions to the shell's button bar; the rest of the model is the
   shell's own business. */
export { useButtonBar } from './model/button-bar';
export type { ButtonBarAction } from './model/button-bar';
/* What the frame already knows about the open company, so a screen need not ask again. */
export { useCompanyReadout } from './model/use-company-context';
