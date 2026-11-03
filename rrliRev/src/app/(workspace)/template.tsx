import { ViewTransition } from "react";

export default function WorkspaceTemplate({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ViewTransition
      enter="routex-page-enter"
      exit="routex-page-exit"
      default="none"
    >
      <div className="route-template">{children}</div>
    </ViewTransition>
  );
}
