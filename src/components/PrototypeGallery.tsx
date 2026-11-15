import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PROTOTYPE_PHOTOS } from "../data/prototype";

export function PrototypeGallery() {
  const [open, setOpen] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const count = PROTOTYPE_PHOTOS.length;

  const show = (i: number) => {
    lastFocus.current = document.activeElement as HTMLElement;
    setOpen(i);
  };
  const close = useCallback(() => {
    setOpen(null);
    lastFocus.current?.focus();
  }, []);
  const step = useCallback(
    (d: number) => setOpen((cur) => (cur === null ? cur : (cur + d + count) % count)),
    [count],
  );

  useEffect(() => {
    if (open === null) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close, step]);

  const photo = open === null ? null : PROTOTYPE_PHOTOS[open];

  return (
    <div className="mt-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-15%" }}
        transition={{ duration: 0.7 }}
        className="mb-10 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end"
      >
        <div>
          <p className="mb-3 font-mono text-xs tracking-[0.25em] text-cyan">BUILT PROTOTYPE</p>
          <h3 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            From schematic to hardware
          </h3>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-muted">
          The working ResQBot rover as built and tested. Select a photo to view it full size.
        </p>
      </motion.div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {PROTOTYPE_PHOTOS.map((p, i) => (
          <motion.figure
            key={p.src}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="m-0"
          >
            <button
              type="button"
              onClick={() => show(i)}
              aria-label={`View photo: ${p.title}`}
              className="group relative block aspect-[3/4] w-full overflow-hidden border border-line/10 bg-graphite transition-colors duration-300 hover:border-cyan/60 focus-visible:border-cyan focus-visible:outline-none"
            >
              <img
                src={p.src}
                alt={`${p.title} — ${p.caption}`}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
              />
              <span className="absolute left-3 top-3 bg-black/60 px-2 py-1 font-mono text-[10px] tracking-[0.2em] text-white">
                {String(i + 1).padStart(2, "0")}
              </span>
            </button>
            <figcaption className="mt-3">
              <p className="font-display text-base font-medium text-paper">{p.title}</p>
              <p className="mt-1 hidden text-xs leading-relaxed text-muted sm:block">{p.caption}</p>
            </figcaption>
          </motion.figure>
        ))}
      </div>

      <AnimatePresence>
        {photo && (
          <motion.div
            data-theme="dark"
            role="dialog"
            aria-modal="true"
            aria-label={photo.title}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 p-4 backdrop-blur-sm sm:p-8"
          >
            <div className="flex w-full max-w-5xl items-center justify-between pb-3 text-white">
              <p className="font-mono text-xs tracking-[0.2em] text-white/70">
                {String((open ?? 0) + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
              </p>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                className="border border-white/25 px-3 py-1.5 font-mono text-xs tracking-[0.2em] text-white transition-colors hover:border-cyan hover:text-cyan"
              >
                CLOSE ✕
              </button>
            </div>

            <div className="relative flex min-h-0 w-full max-w-5xl flex-1 items-center justify-center">
              <motion.img
                key={photo.src}
                src={photo.src}
                alt={`${photo.title} — ${photo.caption}`}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25 }}
                onClick={(e) => e.stopPropagation()}
                className="max-h-full max-w-full object-contain"
              />
              <button
                type="button"
                aria-label="Previous photo"
                onClick={(e) => { e.stopPropagation(); step(-1); }}
                className="absolute left-0 top-1/2 -translate-y-1/2 border border-white/25 bg-black/50 px-3 py-3 font-mono text-white transition-colors hover:border-cyan hover:text-cyan"
              >
                ←
              </button>
              <button
                type="button"
                aria-label="Next photo"
                onClick={(e) => { e.stopPropagation(); step(1); }}
                className="absolute right-0 top-1/2 -translate-y-1/2 border border-white/25 bg-black/50 px-3 py-3 font-mono text-white transition-colors hover:border-cyan hover:text-cyan"
              >
                →
              </button>
            </div>

            <div className="w-full max-w-3xl pt-4 text-center" onClick={(e) => e.stopPropagation()}>
              <p className="font-display text-lg font-medium text-white">{photo.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-white/70">{photo.caption}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
