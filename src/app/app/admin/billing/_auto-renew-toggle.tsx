"use client";

import { useState } from "react";
import { Toggle } from "../../_components/ui";

export function AutoRenewToggle({ defaultChecked }: { defaultChecked: boolean }) {
  const [on, setOn] = useState(defaultChecked);
  return (
    <Toggle checked={on} onChange={setOn} aria-label="Auto-renew subscription" />
  );
}
