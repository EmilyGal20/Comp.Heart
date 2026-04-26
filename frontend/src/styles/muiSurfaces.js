import { alpha } from "@mui/material/styles";

const SLATE = "#0f172a";

/**
 * List/card "glass" row backgrounds: dark = frosted white, light = soft slate tint.
 */
export function surfaceSubtle(theme) {
  return theme.palette.mode === "light" ? alpha(SLATE, 0.04) : alpha("#ffffff", 0.03);
}

export function surfaceSubtleWeaker(theme) {
  return theme.palette.mode === "light" ? alpha(SLATE, 0.03) : alpha("#ffffff", 0.025);
}

export function surfaceSubtleRow(theme) {
  return theme.palette.mode === "light" ? alpha(SLATE, 0.055) : alpha("#ffffff", 0.035);
}

export function surfaceSubtleAlt(theme) {
  return theme.palette.mode === "light" ? alpha(SLATE, 0.05) : alpha("#ffffff", 0.04);
}

/** Slightly more contrast than {@link surfaceSubtle} (e.g. alternates, dense lists). */
export function surfaceSubtleEmphasis(theme) {
  return theme.palette.mode === "light" ? alpha(SLATE, 0.06) : alpha("#ffffff", 0.06);
}

export function surfaceSubtleEmphasis2(theme) {
  return theme.palette.mode === "light" ? alpha(SLATE, 0.07) : alpha("#ffffff", 0.06);
}

export function borderSubtle(theme) {
  return theme.palette.mode === "light" ? alpha(SLATE, 0.1) : "rgba(148, 163, 184, 0.08)";
}

function primaryTint(theme) {
  return theme.palette.mode === "light" ? theme.palette.primary.main : "#74b8ff";
}

export function brandSurfacePinned(theme) {
  return alpha(primaryTint(theme), 0.1);
}

export function brandSurfaceSelected(theme) {
  return alpha(theme.palette.primary.main, theme.palette.mode === "light" ? 0.12 : 0.14);
}

export function userBubbleBg(theme) {
  return theme.palette.mode === "light" ? alpha(theme.palette.primary.main, 0.12) : "rgba(116, 184, 255, 0.16)";
}

/** Non-user chat / neutral bubble. */
export function assistantBubbleBg(theme) {
  return theme.palette.mode === "light" ? alpha(SLATE, 0.05) : alpha("#ffffff", 0.04);
}

export function successTintBox(theme) {
  return theme.palette.mode === "light" ? alpha(theme.palette.success.main, 0.1) : "rgba(57, 217, 138, 0.10)";
}

export function borderLaneAccent(theme) {
  return alpha(theme.palette.primary.main, theme.palette.mode === "light" ? 0.5 : 0.75);
}

export function progressTrackBg(theme) {
  return theme.palette.mode === "light" ? alpha(SLATE, 0.1) : "rgba(255, 255, 255, 0.05)";
}
