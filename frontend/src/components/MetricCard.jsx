import { Card, CardContent, Stack, Typography } from "@mui/material";

function MetricCard({ label, value, helper, accent }) {
  return (
    <Card
      sx={{
        position: "relative",
        overflow: "hidden",
        "&::after": {
          content: '""',
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at top right, ${accent || "rgba(116,184,255,0.24)"} 0%, transparent 42%)`,
          pointerEvents: "none",
        },
      }}
    >
      <CardContent sx={{ position: "relative", zIndex: 1 }}>
        <Typography variant="body2" sx={{ color: "rgba(226, 232, 240, 0.68)" }}>
          {label}
        </Typography>
        <Stack direction="row" alignItems="baseline" spacing={1} sx={{ my: 1 }}>
          <Typography variant="h4">{value}</Typography>
        </Stack>
        <Typography variant="body2" sx={{ color: "rgba(226, 232, 240, 0.62)" }}>
          {helper}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default MetricCard;
