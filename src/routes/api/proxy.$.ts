import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/api/proxy/$")({
  beforeLoad: () => { throw redirect({ to: "/" }); },
  component: () => null,
});
