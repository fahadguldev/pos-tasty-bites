type IconProps = { className?: string };

const base = 'h-5 w-5';

const Svg = ({
  className = base,
  children,
  fill = 'none',
}: IconProps & { children: React.ReactNode; fill?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill={fill}
    stroke={fill === 'none' ? 'currentColor' : 'none'}
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const CartIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.5a2 2 0 0 0 2-1.5L20 8H6" />
    <circle cx="10" cy="20" r="1.3" fill="currentColor" />
    <circle cx="17" cy="20" r="1.3" fill="currentColor" />
  </Svg>
);

export const WhatsAppIcon = (p: IconProps) => (
  <Svg {...p} fill="currentColor">
    <path d="M12.04 2a9.9 9.9 0 0 0-8.5 15l-1.2 4.4 4.5-1.2A9.9 9.9 0 1 0 12.04 2Zm0 1.8a8.1 8.1 0 1 1-4.16 15.02l-.3-.18-2.5.67.68-2.44-.2-.32A8.1 8.1 0 0 1 12.05 3.8Zm-3.4 4.4c-.2 0-.5.08-.76.36-.26.28-1 .98-1 2.38s1.02 2.76 1.17 2.95c.15.2 2 3.05 4.84 4.28 2.36 1.03 2.84.83 3.35.78.51-.05 1.64-.67 1.87-1.32.23-.65.23-1.2.16-1.32-.07-.11-.26-.18-.55-.31-.28-.13-1.64-.81-1.9-.9-.25-.09-.43-.13-.62.13-.18.27-.7.9-.86 1.08-.16.18-.31.2-.6.07-.28-.13-1.19-.44-2.27-1.4-.84-.75-1.4-1.67-1.57-1.95-.16-.28-.02-.43.12-.57.13-.13.28-.31.42-.47.14-.16.18-.27.28-.46.09-.18.05-.35-.02-.49-.07-.13-.6-1.47-.83-2.01-.21-.52-.43-.45-.6-.46h-.5Z" />
  </Svg>
);

export const PhoneIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 2.5 5.7a2 2 0 0 1 2-2.2Z" />
  </Svg>
);

export const PinIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.6" />
  </Svg>
);

export const ClockIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3 1.8" />
  </Svg>
);

export const StarIcon = ({ className = 'h-4 w-4', filled = false }: IconProps & { filled?: boolean }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9L12 3.6Z" />
  </svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const MinusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
);

export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6" />
  </Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </Svg>
);

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Svg>
);

export const SparkIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
  </Svg>
);

export const ChartIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20V4M4 20h16M8 16v-5M12.5 16V8M17 16v-3" />
  </Svg>
);

export const BoxIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9Z" />
    <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
  </Svg>
);

export const TagIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 12.5V4h8.5l9 9-8 8-9.5-8.5Z" />
    <circle cx="7.8" cy="8.2" r="1.4" />
  </Svg>
);

export const ClipboardIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 4h6v3H9V4ZM7 5.5H5.5v15h13v-15H17" />
    <path d="M9 12h6M9 16h4" />
  </Svg>
);

export const StarReviewIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 4.5h14v15H5z" />
    <path d="m8.5 13 2 2 4-4" />
  </Svg>
);

export const GearIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.8v2.4M12 18.8v2.4M4.4 7.6l2 1.2M17.6 15.2l2 1.2M4.4 16.4l2-1.2M17.6 8.8l2-1.2" />
  </Svg>
);

export const LogoutIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 5H6v14h8M11 12h9M17 9l3 3-3 3" />
  </Svg>
);

export const MenuIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);

export const TruckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 6.5h11v10h-11zM13.5 10h4l3 3v3.5h-7" />
    <circle cx="7" cy="18.5" r="1.6" />
    <circle cx="17" cy="18.5" r="1.6" />
  </Svg>
);

export const RupeeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 4h10M7 8.5h10M7 20l4.5-4.5c2.2 0 5.5-.6 5.5-4 0-2.6-2-4-5.5-4H7" />
  </Svg>
);
