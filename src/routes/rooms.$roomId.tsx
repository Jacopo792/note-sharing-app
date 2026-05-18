import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/rooms/$roomId")({
  beforeLoad: () => { throw redirect({ to: "/notes" }); },
  component: () => null,
});
