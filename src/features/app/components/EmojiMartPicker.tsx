import { useEffect, useMemo, useRef } from "react";
import data from "@emoji-mart/data";
import { Picker } from "emoji-mart";

type EmojiMartPickerProps = {
  onSelect: (emoji: string) => void;
};

export function EmojiMartPicker({ onSelect }: EmojiMartPickerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onSelectRef = useRef(onSelect);
  const pickerTheme = useMemo(() => {
    if (typeof document === "undefined") {
      return "light";
    }
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  }, []);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    host.replaceChildren();
    const picker = new Picker({
      data,
      theme: pickerTheme,
      previewPosition: "none",
      navPosition: "top",
      skinTonePosition: "search",
      onEmojiSelect: (entry: { native?: string }) => {
        const nativeEmoji = entry.native?.trim();
        if (!nativeEmoji) {
          return;
        }
        onSelectRef.current(nativeEmoji);
      },
    });
    const pickerElement = picker as unknown as HTMLElement;
    pickerElement.style.setProperty("--em-emoji-picker-height", "360px");
    pickerElement.style.setProperty("--em-emoji-picker-width", "320px");
    host.appendChild(pickerElement);
    return () => {
      host.replaceChildren();
    };
  }, [pickerTheme]);

  return <div ref={hostRef} className="workspace-emoji-mart" />;
}
