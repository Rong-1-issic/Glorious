export default function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
    >
      <g
        stroke="currentColor"
        strokeWidth="3.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="60" cy="60" r="36" />
        <path
          d="M26 57c10-20 49-27 68-8M29 75c17 15 45 16 62-9M60 24c-20 19-25 46-6 70M60 24c18 16 25 36 15 58M24 60h69M60 25v67"
          opacity=".55"
        />
        <path
          d="m79 39-12 29-26 14 13-30 25-13Z"
          fill="var(--logo-fill,#e4effb)"
        />
        <path d="m79 39-25 13 13 16 12-29Z" fill="currentColor" />
        <circle cx="60" cy="60" r="6" fill="var(--logo-fill,#e4effb)" />
        <circle cx="60" cy="11" r="7" />
        <path d="M58 18v6M62 18v6" />
        {[
          [22, 25],
          [98, 25],
          [22, 96],
          [98, 96],
        ].map(([x, y]) => (
          <g key={x + "-" + y} transform={`translate(${x} ${y})`}>
            <path
              d="M0-11C6-15 12-9 10-4c11 0 12 12 4 15-2 9-13 10-16 2-10 4-17-6-11-13-5-8 5-16 13-11Z"
              fill="var(--logo-fill,#e4effb)"
            />
            <path
              d="M0-5c-5-5-9 2-2 5-7 2-4 10 1 5 2 7 10 4 5-1 7-2 4-10-1-5 3-6-4-9-3-4Z"
              fill="currentColor"
              strokeWidth="1"
            />
          </g>
        ))}
      </g>
    </svg>
  );
}
