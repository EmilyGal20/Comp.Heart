import { Alert, Box, Button, CircularProgress, Skeleton, Stack, Typography } from "@mui/material";

function PageState({
  loading = false,
  error = "",
  empty = false,
  title = "Nothing to show yet",
  description = "",
  retryLabel = "Retry",
  onRetry,
  minHeight = 260,
}) {
  if (loading) {
    return (
      <Stack spacing={2} sx={{ py: 3, minHeight }}>
        <Skeleton variant="rounded" height={18} width="24%" />
        <Skeleton variant="rounded" height={44} />
        <Skeleton variant="rounded" height={44} />
        <Skeleton variant="rounded" height={160} />
        <Stack alignItems="center" justifyContent="center" sx={{ pt: 1.5 }}>
          <CircularProgress size={26} />
        </Stack>
      </Stack>
    );
  }

  if (error) {
    return (
      <Box sx={{ py: 3 }}>
        <Alert
          severity="error"
          action={onRetry ? <Button color="inherit" size="small" onClick={onRetry}>{retryLabel}</Button> : null}
        >
          {error}
        </Alert>
      </Box>
    );
  }

  if (empty) {
    return (
      <Stack spacing={1.2} alignItems="center" justifyContent="center" textAlign="center" sx={{ py: 8, minHeight }}>
        <Typography variant="h6">{title}</Typography>
        {description ? <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520 }}>{description}</Typography> : null}
        {onRetry ? <Button variant="outlined" onClick={onRetry}>{retryLabel}</Button> : null}
      </Stack>
    );
  }

  return null;
}

export default PageState;
