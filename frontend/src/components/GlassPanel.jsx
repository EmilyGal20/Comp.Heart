import { memo } from "react";
import { Card, CardContent, Stack, Typography } from "@mui/material";

function GlassPanel({ title, subtitle, action, children, minHeight }) {
  return (
    <Card
      sx={{
        minHeight,
        borderRadius: 3,
        boxShadow: (theme) =>
          theme.palette.mode === "light"
            ? "0 20px 48px rgba(15, 23, 42, 0.08)"
            : "0 22px 54px rgba(0, 0, 0, 0.24)",
      }}
    >
      <CardContent sx={{ p: { xs: 2.25, md: 2.75 }, "&:last-child": { pb: { xs: 2.25, md: 2.75 } } }}>
        {(title || action) && (
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} sx={{ mb: 2.5 }} spacing={1.5}>
            <div>
              {title ? <Typography variant="h6" sx={{ mb: 0.5 }}>{title}</Typography> : null}
              {subtitle ? (
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720 }}>
                  {subtitle}
                </Typography>
              ) : null}
            </div>
            {action}
          </Stack>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

export default memo(GlassPanel);
