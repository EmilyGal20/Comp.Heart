import { Box, Stack, Typography } from "@mui/material";

function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      justifyContent="space-between"
      spacing={2}
      sx={{ mb: 3, position: "relative", zIndex: 1 }}
    >
      <Box>
        <Typography variant="overline" sx={{ color: "primary.main", letterSpacing: 2 }}>
          {eyebrow}
        </Typography>
        <Typography variant="h4" sx={{ mb: 1 }}>
          {title}
        </Typography>
        <Typography variant="body1" sx={{ color: "rgba(226, 232, 240, 0.72)", maxWidth: 720 }}>
          {description}
        </Typography>
      </Box>
      {actions ? <Stack direction="row" spacing={1.5}>{actions}</Stack> : null}
    </Stack>
  );
}

export default PageHeader;
