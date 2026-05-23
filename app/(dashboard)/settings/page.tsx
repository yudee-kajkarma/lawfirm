import { redirect } from 'next/navigation';

export default function SettingsIndex() {
  // Land on Users by default — most common reason to open Settings is to
  // onboard or modify a teammate.
  redirect('/settings/users');
}
