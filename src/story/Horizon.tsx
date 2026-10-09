import { useEffect, useRef } from "react";
export default function Horizon({
  paused,
  mood,
}: {
  paused: boolean;
  mood: string;
}) {
  const host = useRef<HTMLDivElement>(null),
    pause = useRef(paused),
    theme = useRef(mood);
  pause.current = paused;
  theme.current = mood;
  useEffect(() => {
    let dispose: (() => void) | undefined;
    let cancelled = false;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)"),
      small = matchMedia("(max-width: 767px)");
    if (reduced.matches || small.matches) return;
    import("./atmosphere")
      .then(({ mountAtmosphere }) => {
        if (!cancelled && host.current)
          dispose = mountAtmosphere(
            host.current,
            () =>
              pause.current ||
              document.hidden ||
              reduced.matches ||
              small.matches,
            () => theme.current,
          );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);
  return (
    <div className="atmosphere" aria-hidden="true">
      <div className="css-horizon" />
      <div ref={host} className="horizon-canvas" />
    </div>
  );
}
