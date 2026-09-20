import { cn } from "@/lib/utils";

/**
 * Scrolling ticker rail.
 *
 * The items are rendered twice and the track is translated by exactly -50%, so
 * the second copy is in position the instant the first scrolls out and the loop
 * is seamless. Pure CSS — no scroll listener, no rAF loop, nothing running on
 * the main thread.
 *
 * `aria-hidden` on the duplicate keeps a screen reader from reading the whole
 * list twice.
 */
export function Marquee({
  items,
  className,
  separator = "★",
}: {
  items: string[];
  className?: string;
  separator?: string;
}) {
  const track = (
    <ul className="flex shrink-0 items-center gap-8 pr-8">
      {items.map((item, index) => (
        <li key={index} className="flex items-center gap-8 whitespace-nowrap">
          <span>{item}</span>
          <span aria-hidden className="text-mustard">
            {separator}
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <div
      className={cn(
        "flex overflow-hidden border-y-2 border-ink bg-ink py-3",
        "text-sm font-bold uppercase tracking-widest text-cream",
        className,
      )}
    >
      <div className="flex animate-marquee">
        {track}
        <div aria-hidden>{track}</div>
      </div>
    </div>
  );
}
