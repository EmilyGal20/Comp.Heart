import Grid from "@mui/material/Grid";

function AppGrid({ item, container, xs, sm, md, lg, xl, size, offset, children, ...props }) {
  const resolvedSize = size || {
    ...(xs !== undefined ? { xs } : {}),
    ...(sm !== undefined ? { sm } : {}),
    ...(md !== undefined ? { md } : {}),
    ...(lg !== undefined ? { lg } : {}),
    ...(xl !== undefined ? { xl } : {}),
  };

  return (
    <Grid
      container={container}
      size={item ? resolvedSize : (Object.keys(resolvedSize).length ? resolvedSize : size)}
      offset={offset}
      {...props}
    >
      {children}
    </Grid>
  );
}

export default AppGrid;
