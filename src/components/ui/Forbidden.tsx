import EmptyState from "./EmptyState";

export default function Forbidden() {
  return <EmptyState title="Access denied" description="Your role does not have permission to view this section." />;
}
