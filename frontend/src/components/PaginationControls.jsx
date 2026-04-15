import { memo } from "react";
import { Button, Chip, Stack } from "@mui/material";

function PaginationControls({ meta, onChange, disabled = false }) {
  if (!meta) return null;

  const page = meta.page || 1;
  const totalPages = Math.max(meta.total_pages || 0, 1);

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="flex-end" sx={{ mt: 2.5 }}>
      <Chip size="small" variant="outlined" label={`${meta.total} total`} />
      <Button size="small" variant="outlined" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </Button>
      <Chip size="small" label={`Page ${page} / ${totalPages}`} />
      <Button size="small" variant="outlined" disabled={disabled || page >= totalPages} onClick={() => onChange(page + 1)}>
        Next
      </Button>
    </Stack>
  );
}

export default memo(PaginationControls);
