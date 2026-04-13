import { Card, CardContent, Stack, Typography } from "@mui/material";

function GlassPanel({ title, subtitle, action, children, minHeight }) {
  return (
    <Card sx={{ minHeight, borderRadius: 5 }}>
      <CardContent sx={{ p: { xs: 2.25, md: 2.75 }, "&:last-child": { pb: { xs: 2.25, md: 2.75 } } }}>
        {(title || action) && (
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} sx={{ mb: 2.5 }} spacing={1.5}>
            <div>
              {title ? <Typography variant="h6" sx={{ mb: 0.5 }}>{title}</Typography> : null}
              {subtitle ? (
                <Typography variant="body2" sx={{ color: "rgba(226, 232, 240, 0.64)", maxWidth: 720 }}>
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

export default GlassPanel;
