import { Chip } from "@mui/material";

const colorMap = {
  todo: "default",
  in_progress: "info",
  review: "secondary",
  done: "success",
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
