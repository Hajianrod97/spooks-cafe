/** Spook's head as an inline icon: the unit for completed focus blocks. Takes the text colour. */
export function SpookFace({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="spook-face">
      <path
        d="M12 2.5c5 0 7.5 3.6 7.5 8.3v9.4q-1.6-1.4-3.1 0t-3.1 0q-1.3-1.3-2.6 0t-3.1 0q-1.6-1.4-3.1 0v-9.4C4.5 6.1 7 2.5 12 2.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <ellipse cx="9.3" cy="10.5" rx="1.4" ry="2" fill="currentColor" />
      <ellipse cx="14.7" cy="10.5" rx="1.4" ry="2" fill="currentColor" />
    </svg>
  );
}
