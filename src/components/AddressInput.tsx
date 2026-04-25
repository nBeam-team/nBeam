import { useEffect, useId, useRef, useState } from 'react';
import { type Address, loadMaps } from '../lib/google';

function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

interface Props {
  value: Address | null;
  onChange: (a: Address | null) => void;
  placeholder?: string;
  countries?: string[];
}

/**
 * Google Places Autocomplete bound to a styled text input. Uses the legacy
 * google.maps.places.Autocomplete API for the broadest key compatibility.
 */
export function AddressInput({
  value,
  onChange,
  placeholder = 'Start typing your address…',
  countries,
}: Props) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const acRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState(value?.formatted ?? '');
  const onChangeRef = useLatest(onChange);

  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then(() => {
        if (cancelled || !inputRef.current) return;
        const ac = new google.maps.places.Autocomplete(inputRef.current, {
          fields: ['place_id', 'formatted_address', 'geometry', 'address_components'],
          types: ['address'],
          ...(countries ? { componentRestrictions: { country: countries } } : {}),
        });
        ac.addListener('place_changed', () => {
          const place = ac.getPlace();
          const loc = place.geometry?.location;
          if (!loc) return;
          const components = place.address_components ?? [];
          const city =
            components.find((c) => c.types.includes('locality'))?.long_name ??
            components.find((c) => c.types.includes('postal_town'))?.long_name ??
            components.find((c) => c.types.includes('administrative_area_level_2'))?.long_name;
          const country = components.find((c) => c.types.includes('country'))?.short_name;
          const next: Address = {
            formatted: place.formatted_address ?? inputRef.current?.value ?? '',
            lat: loc.lat(),
            lng: loc.lng(),
            city,
            countryCode: country,
            placeId: place.place_id,
          };
          setText(next.formatted);
          onChangeRef.current(next);
        });
        acRef.current = ac;
        setReady(true);
      })
      .catch((e: Error) => {
        // eslint-disable-next-line no-console
        console.error('Maps load failed', e);
        setError('Could not load address search. Check that Maps JS + Places APIs are enabled on your key.');
      });

    return () => {
      cancelled = true;
      if (acRef.current) {
        google.maps.event.clearInstanceListeners(acRef.current);
      }
    };
  }, [countries, onChangeRef]);

  // If parent clears the value, reflect it
  useEffect(() => {
    if (value === null) setText('');
    else if (value.formatted !== text) setText(value.formatted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="nb-eyebrow">
        your address
      </label>
      <div className="relative">
        <span aria-hidden className="absolute left-0 top-1/2 -translate-y-1/2 text-ink-400">
          <PinIcon />
        </span>
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (value) onChange(null); // user is editing → invalidate selection
          }}
          placeholder={ready ? placeholder : 'Loading…'}
          autoComplete="off"
          className="w-full bg-transparent
            text-[18px] leading-snug text-ink
            placeholder:text-ink-300 placeholder:italic
            font-serif
            outline-none
            border-0 border-b border-hairline
            pl-7 pr-3 py-3
            focus:border-ink transition-colors duration-200"
        />
        {value ? (
          <span
            aria-label="address selected"
            className="absolute right-0 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-sage text-paper-light"
          >
            <CheckIcon />
          </span>
        ) : null}
      </div>
      {error ? (
        <p className="text-[12px] italic font-serif text-terracotta">{error}</p>
      ) : (
        <p className="nb-helper">
          we'll use this to find your roof on satellite — only stays in your browser.
        </p>
      )}
    </div>
  );
}

function PinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 22s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="m3 7.2 2 2 4-4.4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
