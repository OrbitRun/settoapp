import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy invitation path — existing links keep working. */
export const Route = createFileRoute("/join/$token")({
  ssr: false,
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/invite/$token", params: { token: params.token }, replace: true });
  },
});
