import { Chip } from "@mui/material";

const colorMap = {
  TODO: "default",
  IN_PROGRESS: "info",
  BLOCKED: "warning",
  REVIEW: "secondary",
  DONE: "success",
  low: "default",
  medium: "info",
  high: "warning",
  critical: "error",
  on_track: "success",
  warning: "warning",
  breached: "error",
  resolved: "success",
};

function StatusPill({ value }) {
  return <Chip size="small" label={String(value).replaceAll("_", " ")} color={colorMap[value] || "default"} />;
}

export default StatusPill;
