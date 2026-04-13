import { Card, CardContent, Stack, Typography } from "@mui/material";

function GlassPanel({ title, subtitle, action, children, minHeight }) {
  return (
    <Card sx={{ minHeight }}>
      <CardContent>
        {(title || action) && (
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <div>
              {title ? <Typography variant="h6">{title}</Typography> : null}
              {subtitle ? (
                <Typography variant="body2" sx={{ color: "rgba(226, 232, 240, 0.64)" }}>
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
