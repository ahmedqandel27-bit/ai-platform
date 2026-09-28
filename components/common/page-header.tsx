import { getTranslations } from "next-intl/server";
import { NAV_ITEMS, type NavKey } from "@/lib/nav";
import { Reveal } from "@/components/motion/reveal";

/**
 * Editorial page header: numbered eyebrow + hairline, a serif headline ending
 * in the accent, and a short standfirst. Numbers follow the sidebar order.
 */
export async function PageHeader({ navKey, actions }: { navKey: NavKey; actions?: React.ReactNode }) {
  const t = await getTranslations();
  const index = NAV_ITEMS.findIndex((i) => i.key === navKey);
  const item = NAV_ITEMS[index]!;
  const number = String(index + 1).padStart(2, "0");

  return (
    <Reveal className="mb-10">
      <div className="mb-5 flex items-center gap-3">
        <span className="font-display text-sm italic text-accent" dir="ltr">
          {number}
        </span>
        <span className="eyebrow">{t(`nav.${item.group}`)}</span>
        <span className="h-px flex-1 bg-gradient-to-r from-border-strong to-transparent rtl:bg-gradient-to-l" />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <h1 className="font-display text-4xl leading-[1.05] sm:text-5xl">
            {t(`pages.${navKey}.title`)}
            <span className="text-gradient">.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">{t(`pages.${navKey}.description`)}</p>
        </div>
        {actions}
      </div>
    </Reveal>
  );
}
