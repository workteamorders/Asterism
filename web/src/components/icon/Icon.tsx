import type { SVGProps } from "react";

/**
 * One icon family: 24-unit grid, 1.5-unit stroke (1.25px at 20px), butt caps, mitred joins.
 * Icons inherit colour from text. Decorative by default; pass `label` to expose meaning.
 */
const PATHS = {
  check: "M5 12.5L10 17.5L19 7",
  x: "M6 6L18 18M18 6L6 18",
  alert: "M12 3.5L21.5 20H2.5ZM12 9.5V14.5M12 16.25V18",
  info: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18ZM12 10.5V17M12 7V8.75",
  "arrow-right": "M4 12H20M14 6L20 12L14 18",
  external: "M14 4H20V10M20 4L11 13M18 14V20H4V6H10",
  copy: "M8 8H20V20H8ZM16 8V4H4V16H8",
  "chevron-down": "M6 9L12 15L18 9",
  menu: "M4 7H20M4 12H20M4 17H20",
  wallet: "M3 6H21V19H3ZM3 10H21M15.5 14.5H18",
  eye: "M2 12C5 6.5 19 6.5 22 12C19 17.5 5 17.5 2 12ZM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z",
  lock: "M5 11H19V21H5ZM8 11V7.5a4 4 0 0 1 8 0V11",
  search: "M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13ZM15.5 15.5L20.5 20.5",
  filter: "M4 6H20M7 12H17M10 18H14",
  send: "M4 12L20 4L14 20L11 13ZM11 13L20 4",
  pen: "M15 5L19 9L8 20H4V16ZM12.5 7.5L16.5 11.5",
  reticle: "M12 5a7 7 0 1 0 0 14a7 7 0 1 0 0-14ZM12 2V7M12 17V22M2 12H7M17 12H22",
  spike: "M12 2V22M2 12H22M12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5Z",
  grid: "M4 4H20V20H4ZM4 12H20M12 4V20",
  clock: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18ZM12 7V12L15.5 14",
  shield: "M12 3L19.5 6V11.5C19.5 16 16.5 19.5 12 21C7.5 19.5 4.5 16 4.5 11.5V6Z",
  plus: "M12 5V19M5 12H19",
  minus: "M5 12H19",
  spinner: "M12 3a9 9 0 1 1-9 9",
} as const;

export type IconName = keyof typeof PATHS;
export const ICON_NAMES = Object.keys(PATHS) as IconName[];

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  name: IconName;
  size?: 16 | 20 | 24;
  label?: string;
}

export function Icon({ name, size = 20, label, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="butt"
      strokeLinejoin="miter"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
