import { Box, Stack, Typography } from "@mui/material";

function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      justifyContent="space-between"
      spacing={2.5}
      sx={{ mb: 4, position: "relative", zIndex: 1, px: { xs: 0.25, md: 0.5 } }}
    >
      <Box>
        <Typography variant="overline" sx={{ color: "primary.main", letterSpacing: 2 }}>
          {eyebrow}
        </Typography>
        <Typography variant="h4" sx={{ mb: 1.25 }}>
          {title}
        </Typography>
        <Typography variant="body1" sx={{ color: "rgba(226, 232, 240, 0.72)", maxWidth: 760, lineHeight: 1.7 }}>
          {description}
        </Typography>
      </Box>
      {actions ? <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }}>{actions}</Stack> : null}
    </Stack>
  );
}

export default PageHeader;
