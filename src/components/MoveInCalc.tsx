import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ProLockSheet } from "./ProLockSheet";
import type { ListingOut, MoveInTerms } from "../types";

type Props = {
  listing: ListingOut;
};

function formatRub(n: number) {
  return `${Math.round(n).toLocaleString("ru-RU")} ₽`;
}

function resolveTerms(listing: ListingOut, commissionPctOverride: number | null): {
  rent: number | null;
  deposit: number | null;
  commissionPct: number | null;
  commissionRub: number | null;
  utilities: string | null;
  total: number | null;
  source: MoveInTerms["source"];
  editableCommission: boolean;
} {
  const mi = listing.move_in;
  const rent = mi?.rent ?? listing.price ?? null;
  const source = mi?.source ?? "estimate";
  const factual = source === "yandex" || source === "parsed_text";

  if (factual && mi) {
    const deposit = mi.deposit ?? null;
    const commissionPct = mi.commission_pct ?? null;
    const commissionRub =
      mi.commission_rub ??
      (rent != null && commissionPct != null
        ? Math.round((rent * commissionPct) / 100)
        : null);
    const parts = [rent, deposit, commissionRub].filter((x): x is number => x != null);
    return {
      rent,
      deposit,
      commissionPct,
      commissionRub,
      utilities: mi.utilities_note ?? null,
      total: mi.total ?? (parts.length ? parts.reduce((a, b) => a + b, 0) : null),
      source,
      editableCommission: false,
    };
  }

  const isOwner = listing.seller_type === "owner";
  const commissionPct =
    commissionPctOverride ?? mi?.commission_pct ?? (isOwner ? 0 : 50);
  const deposit = mi?.deposit ?? (rent != null ? rent : null);
  const commissionRub =
    rent != null ? Math.round((rent * commissionPct) / 100) : null;
  const parts = [rent, deposit, commissionRub].filter((x): x is number => x != null);
  return {
    rent,
    deposit,
    commissionPct,
    commissionRub,
    utilities: mi?.utilities_note ?? null,
    total: parts.length ? parts.reduce((a, b) => a + b, 0) : null,
    source: "estimate",
    editableCommission: !isOwner,
  };
}

export function SellerBadge({ listing }: { listing: ListingOut }) {
  if (listing.seller_type === "owner") {
    return <span className="seller-badge seller-badge--owner">Собственник</span>;
  }
  if (listing.seller_type === "agent") {
    return <span className="seller-badge seller-badge--agent">Риэлтор</span>;
  }
  return null;
}

/** Close without letting the same touch fall through to the chip under the portal. */
function useSafeClose(onClose: () => void) {
  return (e?: { preventDefault?: () => void; stopPropagation?: () => void }) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    // Defer unmount one frame so the touch/click doesn't hit the deck chip.
    window.setTimeout(() => onClose(), 0);
  };
}

export function MoveInSheet({
  open,
  listing,
  onClose,
}: {
  open: boolean;
  listing: ListingOut;
  onClose: () => void;
}) {
  const isOwner = listing.seller_type === "owner";
  const [commissionPct, setCommissionPct] = useState(isOwner ? 0 : 50);
  const safeClose = useSafeClose(onClose);

  useEffect(() => {
    if (!open) return;
    const mi = listing.move_in;
    if (mi?.source === "estimate" || !mi) {
      setCommissionPct(listing.seller_type === "owner" ? 0 : (mi?.commission_pct ?? 50));
    }
  }, [open, listing.id, listing.move_in, listing.seller_type]);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.classList.add("move-in-open");
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.classList.remove("move-in-open");
      root.style.overflow = prev;
    };
  }, [open]);

  const terms = useMemo(
    () => resolveTerms(listing, commissionPct),
    [listing, commissionPct],
  );

  if (!open) return null;

  const sourceLabel =
    terms.source === "yandex"
      ? "из объявления Яндекса"
      : terms.source === "parsed_text"
        ? "из текста объявления"
        : "оценка";

  return createPortal(
    <div
      className="move-in-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="К въезду"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="move-in-backdrop"
        aria-label="Закрыть"
        onPointerDown={safeClose}
        onClick={safeClose}
      />
      <div
        className="move-in-card"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="move-in-card-head">
          <strong>К въезду</strong>
          <span className={`move-in-source move-in-source--${terms.source}`}>{sourceLabel}</span>
        </div>

        {!terms.rent ? (
          <p className="muted">Цена не указана — считаем после открытия объявления.</p>
        ) : (
          <>
            {terms.editableCommission ? (
              <div className="chips movein-calc-chips">
                {[0, 50, 100].map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`chip ${commissionPct === p ? "on" : ""}`}
                    onClick={() => setCommissionPct(p)}
                  >
                    Комиссия {p}%
                  </button>
                ))}
              </div>
            ) : null}

            <div className="movein-rows">
              <div className="movein-row">
                <span className="muted">Аренда / мес</span>
                <strong>{formatRub(terms.rent)}</strong>
              </div>
              <div className="movein-row">
                <span className="muted">Залог</span>
                <strong>{terms.deposit != null ? formatRub(terms.deposit) : "—"}</strong>
              </div>
              <div className="movein-row">
                <span className="muted">
                  Комиссия агенту
                  {terms.commissionPct != null ? ` ${terms.commissionPct}%` : ""}
                </span>
                <strong>
                  {terms.commissionRub != null ? formatRub(terms.commissionRub) : "—"}
                </strong>
              </div>
              {terms.utilities ? (
                <div className="movein-row">
                  <span className="muted">Коммунальные</span>
                  <strong className="movein-util">{terms.utilities}</strong>
                </div>
              ) : null}
              <div className="movein-row movein-row--total">
                <span>Итого</span>
                <strong>{terms.total != null ? formatRub(terms.total) : "—"}</strong>
              </div>
            </div>
          </>
        )}

        <button
          type="button"
          className="btn block"
          onPointerDown={safeClose}
          onClick={safeClose}
        >
          Закрыть
        </button>
      </div>
    </div>,
    document.body,
  );
}

/** Chip + sheet (Pro) or ProLockSheet (Trial). */
export function MoveInChip({
  listing,
  isPro = false,
  interactive = true,
  onUpgrade,
  stopPropagation = true,
}: {
  listing: ListingOut;
  isPro?: boolean;
  interactive?: boolean;
  onUpgrade?: () => void;
  stopPropagation?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="card-chip"
        tabIndex={interactive ? 0 : -1}
        onClick={(e) => {
          if (stopPropagation) e.stopPropagation();
          if (!interactive) return;
          if (isPro) setOpen(true);
          else setLockOpen(true);
        }}
        onPointerDown={(e) => {
          if (stopPropagation) e.stopPropagation();
        }}
      >
        <span className="card-chip-ico" aria-hidden>
          ₽
        </span>
        К въезду
        {!isPro ? <span className="card-chip-pro">Pro</span> : null}
      </button>
      <MoveInSheet open={open} listing={listing} onClose={() => setOpen(false)} />
      <ProLockSheet
        open={lockOpen}
        title="Калькулятор въезда — в Pro"
        onClose={() => setLockOpen(false)}
        onUpgrade={() => {
          setLockOpen(false);
          onUpgrade?.();
        }}
      />
    </>
  );
}

/** @deprecated inline card calc — use MoveInChip + MoveInSheet */
export function MoveInCalc({ listing }: Props) {
  return (
    <div className="movein-calc">
      <strong>Калькулятор въезда</strong>
      <p className="muted movein-calc-hint">Откройте «К въезду» справа.</p>
      <MoveInChip listing={listing} isPro interactive />
    </div>
  );
}
