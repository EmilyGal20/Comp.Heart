import { Box } from "@mui/material";

const DEFAULT_MAX_VISIBLE = 5;
const DEFAULT_ROW_PX = 90;

/**
 * When `count` exceeds `maxVisible`, the inner list gets a max height
 * (about `maxVisible` rows) and scrolls, so the card does not grow without bound.
 */
function CardListScroll({ count, maxVisible = DEFAULT_MAX_VISIBLE, rowEstimatePx = DEFAULT_ROW_PX, children, sx, ...rest }) {
  const scroll = typeof count === "number" && count > maxVisible;
  return (
    <Box
      {...rest}
      sx={[
        scroll
          ? {
              maxHeight: maxVisible * rowEstimatePx,
              minHeight: 0,
              overflowX: "hidden",
              overflowY: "auto",
              pr: 0.5,
            }
          : { minHeight: 0 },
        ...(Array.isArray(sx) ? sx : sx != null ? [sx] : []),
      ]}
    >
      {children}
    </Box>
  );
}

export default CardListScroll;
export { DEFAULT_MAX_VISIBLE, DEFAULT_ROW_PX };
