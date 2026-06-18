import { useId } from "react";

type BrandLogoProps = {
  className?: string;
  title?: string;
};

export function BrandLogo({ className, title = "OmniHR" }: BrandLogoProps) {
  const id = useId().replace(/:/g, "");
  const badgeGradient = `${id}-badge`;
  const edgeGradient = `${id}-edge`;
  const shineGradient = `${id}-shine`;

  return (
    <span
      aria-label={title}
      className={["brand-logo", className].filter(Boolean).join(" ")}
      role="img"
    >
      <svg viewBox="0 0 72 72" focusable="false" aria-hidden="true">
        <defs>
          <linearGradient id={badgeGradient} x1="11" y1="9" x2="61" y2="64">
            <stop offset="0" stopColor="#12b886" />
            <stop offset="0.42" stopColor="#1971c2" />
            <stop offset="1" stopColor="#243b6b" />
          </linearGradient>
          <linearGradient id={edgeGradient} x1="16" y1="12" x2="57" y2="61">
            <stop offset="0" stopColor="#fff3bf" />
            <stop offset="0.46" stopColor="#74c0fc" />
            <stop offset="1" stopColor="#63e6be" />
          </linearGradient>
          <linearGradient id={shineGradient} x1="18" y1="12" x2="50" y2="55">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M36 4.5 58.5 17.7v36.6L36 67.5 13.5 54.3V17.7L36 4.5Z"
          fill={`url(#${badgeGradient})`}
        />
        <path
          d="M36 7.8 55.6 19.3v33.4L36 64.2 16.4 52.7V19.3L36 7.8Z"
          stroke={`url(#${edgeGradient})`}
          strokeWidth="2.8"
        />
        <path
          d="M19.2 20.8 36 10.9l16.8 9.9v9.7C41.6 26.8 30.4 26.8 19.2 30.5v-9.7Z"
          fill={`url(#${shineGradient})`}
        />
        <path
          d="M35.9 18.3c9.9 0 17.8 8 17.8 17.7 0 9.8-7.9 17.7-17.8 17.7-9.8 0-17.7-7.9-17.7-17.7 0-9.7 7.9-17.7 17.7-17.7Z"
          stroke="#ffffff"
          strokeOpacity="0.9"
          strokeWidth="5.4"
        />
        <path
          d="M27.8 26.6v18.8M44.2 26.6v18.8M27.8 36h16.4"
          stroke="#ffffff"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="5.2"
        />
        <path
          d="M48.9 17.8 55.1 21.4 51.5 27.6"
          stroke="#ffe066"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3.4"
        />
      </svg>
    </span>
  );
}
