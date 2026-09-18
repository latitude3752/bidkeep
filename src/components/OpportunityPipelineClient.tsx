"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { explainNaicsMatch } from "@/lib/match-explanation";
import { pipelineHref } from "@/lib/pipeline-href";
import { KEEP_SEGMENTS, type KeepSegmentId } from "@/lib/default-criteria";
import RelevanceButtons from "@/components/RelevanceButtons";
import SavedGeo from "@/components/SavedGeo";
import StatusSelect from "@/app/admin/opportunities/StatusSelect";
import { logout as founderLogout } from "@/app/admin/actions";
import { logout as subscriberLogout } from "@/app/login/actions";
import {
  DEFAULT_HORIZON_DAYS_UI,
  DEFAULT_RADIUS_MILES,
  NOTICE_TYPE_OPTIONS,
  PAGE_SIZE,
  RADIUS_OPTIONS,
  SET_ASIDE_BADGE_LABEL,
  type Filters,
  type Row,
  type SetAsideFilter,
  type SortDir,
  type SortKey,
  classifySetAside,
  deadlineSpan,
  formatDeadlineWithZone,
  runPipeline,
  scaleLabel,
} from "@/lib/opportunity-pipeline";

/** All filter/sort/page state lives here, in memory, and is recomputed with
 * useMemo on every change -- no server round-trip for a filter click, a
 * sort click, a page turn, or typing a search term. The parent server
 * component fetches the viewer's full row set exactly once; this component
 * owns everything about how that set is sliced and displayed. The URL is
 * kept in sync via history.replaceState (not router.replace) specifically
 * so filtered views stay bookmarkable/shareable without ever triggering a
 * Next.js navigation or server re-fetch.
 *
 * One control is deliberately excluded from that instant-state model: the
 * "Distance from ZIP" form stays a real GET submission, because changing
 * ZIP/radius needs the server to recompute distance_miles against the
 * centroid dataset (see opportunity-pipeline.ts). Every other filter is
 * instant. */
export default function OpportunityPipelineClient({
  viewer,
  basePath,
  rows: allFetchedRows,
  votes: votesEntries,
  trackedNaicsCodes: trackedNaicsList,
  initialFilters,
  initialSortBy,
  initialSortDir,
  initialPage,
}: {
  viewer: "founder" | "subscriber";
  basePath: "/admin/opportunities" | "/app/opportunities";
  rows: Row[];
  votes: [string, boolean][];
  trackedNaicsCodes: string[];
  initialFilters: Filters;
  initialSortBy: SortKey;
  initialSortDir: SortDir;
  initialPage: number;
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [sortDir, setSortDir] = useState(initialSortDir);
  const [page, setPage] = useState(initialPage);
  const [qInput, setQInput] = useState(initialFilters.q);
  const deferredQ = useDeferredValue(qInput);

  const votes = useMemo(() => new Map(votesEntries), [votesEntries]);
  const trackedNaicsCodes = useMemo(() => new Set(trackedNaicsList), [trackedNaicsList]);

  const effectiveFilters = useMemo(() => ({ ...filters, q: deferredQ }), [filters, deferredQ]);

  const { rows: allRows, totalOpen, departmentOptions, stateOptions } = useMemo(
    () => runPipeline(allFetchedRows, votes, effectiveFilters, sortBy, sortDir),
    [allFetchedRows, votes, effectiveFilters, sortBy, sortDir]
  );

  const pageCount = Math.max(1, Math.ceil(allRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = allRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const horizonEnd = useMemo(() => {
    if (filters.horizonDays === null) return null;
    const end = new Date();
    end.setUTCDate(end.getUTCDate() + filters.horizonDays);
    return end;
  }, [filters.horizonDays]);
  const horizonLabel = horizonEnd
    ? horizonEnd.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })
    : null;
  const spanLabel = deadlineSpan(allRows);
  const logout = viewer === "founder" ? founderLogout : subscriberLogout;
  const grantsHref = viewer === "founder" ? "/admin/grants" : "/app/grants";
  const radarHref = viewer === "founder" ? "/admin/radar" : "/app/radar";

  useEffect(() => {
    const href = pipelineHref(basePath, {
      type: filters.type,
      noise: filters.noise ? "1" : "0",
      activeOnly: filters.activeOnly ? "1" : "0",
      program: filters.program,
      setAside: filters.setAside,
      noticeType: filters.noticeType,
      department: filters.department,
      state: filters.state,
      q: filters.q,
      horizon: filters.horizonDays === null ? "all" : String(filters.horizonDays),
      page: String(currentPage),
      sort: sortBy,
      dir: sortDir,
      segment: filters.segment,
      junk: filters.hideJunk ? "0" : "1",
      myZip: filters.myZip,
      radius: filters.radiusMiles === null ? String(DEFAULT_RADIUS_MILES) : String(filters.radiusMiles),
    });
    window.history.replaceState(null, "", href);
  }, [basePath, filters, sortBy, sortDir, currentPage]);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  function toggleSort(key: SortKey) {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  }

  function submitSearch() {
    setFilter("q", qInput.trim().slice(0, 200));
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <SavedGeo currentState={filters.state} />
      <SavedGeo currentState={filters.myZip} storageKey="bidkeep-my-zip" paramName="myZip" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-950">Facilities opportunities pipeline</h1>
          <p className="mt-1 text-sm text-ink/60">
            {horizonLabel ? `Due through ${horizonLabel}` : "All response dates"}
            {spanLabel ? ` · In this list ${spanLabel}` : ""}
            {" · "}
            {allRows.length === 0
              ? "0"
              : `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, allRows.length)}`}{" "}
            of {allRows.length} matching filters ({totalOpen} open/actionable notices tracked)
          </p>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://piee.eb.mil"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-ink/50 underline hover:text-ink"
          >
            PIEE ↗
          </a>
          {viewer === "founder" && (
            <>
              <Link href="/admin/naics-codes" className="text-sm font-medium text-ink/50 underline hover:text-ink">
                NAICS codes
              </Link>
              <Link href="/admin/subscribers" className="text-sm font-medium text-ink/50 underline hover:text-ink">
                Subscribers
              </Link>
            </>
          )}
          {viewer === "subscriber" && (
            <Link href="/app/company" className="text-sm font-medium text-ink/50 underline hover:text-ink">
              Company profile
            </Link>
          )}
          <Link href={radarHref} className="text-sm font-medium text-ink/50 underline hover:text-ink">
            Radar
          </Link>
          <Link href={grantsHref} className="text-sm font-medium text-ink/50 underline hover:text-ink">
            Grants
          </Link>
          {viewer === "subscriber" && (
            <Link href="/app/local-bids" className="text-sm font-medium text-ink/50 underline hover:text-ink">
              State & local (beta)
            </Link>
          )}
          <form action={logout}>
            <button type="submit" className="text-sm font-medium text-ink/50 underline hover:text-ink">
              Log out
            </button>
          </form>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2">
        <input
          type="search"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitSearch();
          }}
          placeholder="Search titles…"
          className="w-64 rounded-lg border border-navy-950/20 px-3 py-1.5 text-sm outline-none focus:border-gold-500"
        />
        <button
          type="button"
          onClick={submitSearch}
          className="rounded-lg border border-navy-950/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-navy-950/70 hover:border-navy-950/40"
        >
          Search
        </button>
        {filters.q && (
          <button
            type="button"
            onClick={() => {
              setQInput("");
              setFilter("q", "");
            }}
            className="text-xs font-medium text-ink/50 underline hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>

      {/* Deliberately a real GET form, not client state -- see the
          module-doc note on OpportunityPipeline.tsx about why ZIP/radius
          changes still need a server round-trip. The hidden inputs mirror
          every other current filter so this one navigation doesn't reset
          them. */}
      <form action={basePath} method="GET" className="mt-3 flex flex-wrap items-center gap-2">
        <input type="hidden" name="type" value={filters.type} />
        <input type="hidden" name="noise" value={filters.noise ? "1" : "0"} />
        <input type="hidden" name="activeOnly" value={filters.activeOnly ? "1" : "0"} />
        <input type="hidden" name="program" value={filters.program} />
        <input type="hidden" name="setAside" value={filters.setAside} />
        <input type="hidden" name="noticeType" value={filters.noticeType} />
        <input type="hidden" name="department" value={filters.department} />
        <input type="hidden" name="state" value={filters.state} />
        <input type="hidden" name="q" value={filters.q} />
        <input type="hidden" name="horizon" value={filters.horizonDays === null ? "all" : String(filters.horizonDays)} />
        <input type="hidden" name="sort" value={sortBy} />
        <input type="hidden" name="dir" value={sortDir} />
        <input type="hidden" name="segment" value={filters.segment} />
        <input type="hidden" name="junk" value={filters.hideJunk ? "0" : "1"} />
        <input type="hidden" name="page" value="1" />
        <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">Distance from</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="\d{5}"
          name="myZip"
          defaultValue={filters.myZip}
          placeholder="Your ZIP"
          className="w-28 rounded-lg border border-navy-950/20 px-3 py-1.5 text-sm outline-none focus:border-gold-500"
        />
        <select
          name="radius"
          defaultValue={filters.radiusMiles ?? DEFAULT_RADIUS_MILES}
          className="rounded-lg border border-navy-950/20 bg-white px-2 py-1.5 text-sm outline-none focus:border-gold-500"
        >
          {RADIUS_OPTIONS.map((r) => (
            <option key={r} value={r}>
              within {r} mi
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg border border-navy-950/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-navy-950/70 hover:border-navy-950/40"
        >
          Apply
        </button>
        {filters.myZip && (
          <Link href={pipelineHref(basePath, { myZip: "" })} className="text-xs font-medium text-ink/50 underline hover:text-ink">
            Clear
          </Link>
        )}
        {filters.myZip && (
          <span className="text-xs text-ink/40">
            Distance is estimated from ZIP centroids, not routing -- treat it as approximate.
          </span>
        )}
      </form>

      <div className="mt-6 flex flex-wrap gap-6">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">Acquisition</span>
          <FilterButton active={filters.type === "material"} onClick={() => setFilter("type", "material")}>
            Material
          </FilterButton>
          <FilterButton active={filters.type === "service"} onClick={() => setFilter("type", "service")}>
            Service
          </FilterButton>
          <FilterButton active={filters.type === "all"} onClick={() => setFilter("type", "all")}>
            All
          </FilterButton>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">NAICS</span>
          {(Object.values(KEEP_SEGMENTS) as { id: KeepSegmentId; label: string }[]).map((seg) => (
            <FilterButton key={seg.id} active={filters.segment === seg.id} onClick={() => setFilter("segment", seg.id)}>
              {seg.label}
            </FilterButton>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">Notice Type</span>
          <FilterButton active={filters.noticeType === "all"} onClick={() => setFilter("noticeType", "all")}>
            All
          </FilterButton>
          {NOTICE_TYPE_OPTIONS.map((nt) => (
            <FilterButton key={nt} active={filters.noticeType === nt} onClick={() => setFilter("noticeType", nt)}>
              {nt}
            </FilterButton>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">Noise</span>
          <FilterButton active={!filters.noise} onClick={() => setFilter("noise", false)}>
            Hide awarded/justifications
          </FilterButton>
          <FilterButton active={filters.noise} onClick={() => setFilter("noise", true)}>
            Show all
          </FilterButton>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">Relevance</span>
          <FilterButton active={filters.hideJunk} onClick={() => setFilter("hideJunk", true)}>
            Hide junk I marked
          </FilterButton>
          <FilterButton active={!filters.hideJunk} onClick={() => setFilter("hideJunk", false)}>
            Show junk
          </FilterButton>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">Status</span>
          <FilterButton active={filters.activeOnly} onClick={() => setFilter("activeOnly", true)}>
            Active pipeline
          </FilterButton>
          <FilterButton active={!filters.activeOnly} onClick={() => setFilter("activeOnly", false)}>
            Include expired/lost
          </FilterButton>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">Deadline</span>
          <FilterButton
            active={filters.horizonDays === 30}
            onClick={() => {
              setFilter("horizonDays", 30);
              setSortBy("deadline");
              setSortDir("asc");
            }}
          >
            30 days
          </FilterButton>
          <FilterButton
            active={filters.horizonDays === DEFAULT_HORIZON_DAYS_UI}
            onClick={() => {
              setFilter("horizonDays", DEFAULT_HORIZON_DAYS_UI);
              setSortBy("deadline");
              setSortDir("asc");
            }}
          >
            90 days
          </FilterButton>
          <FilterButton
            active={filters.horizonDays === null}
            onClick={() => {
              setFilter("horizonDays", null);
              setSortBy("deadline");
              setSortDir("asc");
            }}
          >
            All dates
          </FilterButton>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">Scale</span>
          <FilterButton active={filters.program === "all"} onClick={() => setFilter("program", "all")}>
            All
          </FilterButton>
          <FilterButton active={filters.program === "big"} onClick={() => setFilter("program", "big")}>
            BPA / IDIQ
          </FilterButton>
          <FilterButton active={filters.program === "single"} onClick={() => setFilter("program", "single")}>
            Single-buy
          </FilterButton>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">Set-Aside</span>
          {(
            [
              ["all", "All"],
              ["small-business", "Small Business"],
              ["8a", "8(a)"],
              ["sdvosb", "SDVOSB"],
              ["wosb", "WOSB"],
              ["hubzone", "HUBZone"],
              ["none", "Full and Open"],
            ] as [SetAsideFilter, string][]
          ).map(([value, label]) => (
            <FilterButton key={value} active={filters.setAside === value} onClick={() => setFilter("setAside", value)}>
              {label}
            </FilterButton>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">Department</span>
          <FilterButton active={filters.department === "all"} onClick={() => setFilter("department", "all")}>
            All
          </FilterButton>
          {departmentOptions.map((d) => (
            <FilterButton key={d.name} active={filters.department === d.name} onClick={() => setFilter("department", d.name)}>
              {d.name} ({d.count})
            </FilterButton>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">State</span>
          <FilterButton active={filters.state === "all"} onClick={() => setFilter("state", "all")}>
            All
          </FilterButton>
          {stateOptions.map((s) => (
            <FilterButton key={s.name} active={filters.state === s.name} onClick={() => setFilter("state", s.name)}>
              {s.name} ({s.count})
            </FilterButton>
          ))}
        </div>
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-navy-950/10">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy-950/10 bg-navy-950/[0.03] text-ink/50">
              <SortableHeader sortKey="title" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}>
                Title
              </SortableHeader>
              <SortableHeader sortKey="agency" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}>
                Agency
              </SortableHeader>
              <SortableHeader sortKey="naics" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}>
                NAICS / PSC
              </SortableHeader>
              <SortableHeader sortKey="setAside" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}>
                Set-Aside
              </SortableHeader>
              <SortableHeader sortKey="state" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}>
                State
              </SortableHeader>
              <SortableHeader sortKey="type" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}>
                Type
              </SortableHeader>
              <SortableHeader sortKey="ceiling" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}>
                Ceiling
              </SortableHeader>
              <SortableHeader sortKey="deadline" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}>
                Deadline
              </SortableHeader>
              <SortableHeader sortKey="status" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}>
                Status
              </SortableHeader>
            </tr>
          </thead>
          <tbody>
            {rows.map((op) => (
              <tr key={op.id} className="border-b border-navy-950/10 last:border-0">
                <td className="max-w-xs p-3">
                  {op.notice_url ? (
                    <a
                      href={op.notice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-gold-500 decoration-2 underline-offset-2 hover:text-gold-600"
                    >
                      {op.title}
                    </a>
                  ) : (
                    op.title
                  )}
                  <div className="mt-1 flex items-center gap-2 text-xs text-ink/40">
                    <span>{op.notice_type ?? "—"}</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-ink/55">
                    {explainNaicsMatch(op.naics_code, trackedNaicsCodes).label}
                  </p>
                  <RelevanceButtons opportunityId={op.id} vote={votes.has(op.id) ? votes.get(op.id)! : null} />
                  <Link
                    href={`${basePath}/${op.id}`}
                    className="mt-1.5 inline-block rounded-full bg-gold-500 px-3 py-1 text-xs font-bold text-navy-950 transition-colors hover:bg-gold-400"
                  >
                    Research →
                  </Link>
                </td>
                <td className="p-3 text-ink/70">{op.agency ?? "—"}</td>
                <td className="p-3 font-mono text-xs text-ink/70">
                  {op.naics_code ?? "—"} / {op.psc_code ?? "—"}
                  {op.naics_code && !trackedNaicsCodes.has(op.naics_code) && (
                    <span
                      title="NAICS code on this notice doesn't match a currently-tracked code — it may have been retired since this row was synced"
                      className="ml-1.5 rounded-full bg-gold-500/20 px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase text-gold-700"
                    >
                      Untracked NAICS
                    </span>
                  )}
                </td>
                <td className="p-3 text-ink/70">
                  {(() => {
                    const category = classifySetAside(op.set_aside_type);
                    const text = op.set_aside_type ?? "Full and open";
                    if (category === "none") {
                      return text;
                    }
                    return (
                      <span title={text} className="rounded-full bg-gold-500/20 px-2 py-0.5 text-xs font-semibold text-gold-700">
                        {SET_ASIDE_BADGE_LABEL[category] ?? text}
                      </span>
                    );
                  })()}
                </td>
                <td className="p-3 text-ink/70">
                  {op.place_of_performance_state ?? "—"}
                  {filters.myZip && op.distance_miles !== null && (
                    <span className="ml-1 text-xs text-ink/40">({Math.round(op.distance_miles)} mi)</span>
                  )}
                </td>
                <td className="p-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      op.acquisition_type === "material"
                        ? "bg-gold-500/20 text-gold-700"
                        : op.acquisition_type === "service"
                          ? "bg-navy-950/10 text-navy-900"
                          : "bg-ink/10 text-ink/50"
                    }`}
                  >
                    {op.acquisition_type ?? "unknown"}
                  </span>
                </td>
                <td className="p-3 text-xs text-ink/70">
                  {(() => {
                    const label = scaleLabel(op);
                    if (!label) return <span className="text-ink/30">—</span>;
                    return (
                      <span title={label} className="rounded-full bg-navy-950/10 px-2 py-0.5 font-semibold text-navy-900">
                        {label}
                      </span>
                    );
                  })()}
                </td>
                <td className="p-3 text-ink/70">{op.response_deadline ? formatDeadlineWithZone(op.response_deadline) : "—"}</td>
                <td className="p-3">
                  <StatusSelect id={op.id} status={op.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-6 text-sm text-ink/50">No opportunities match these filters.</p>}
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          {currentPage > 1 ? (
            <button
              type="button"
              onClick={() => setPage(currentPage - 1)}
              className="font-medium text-navy-900 underline hover:text-navy-950"
            >
              ← Previous
            </button>
          ) : (
            <span />
          )}
          <span className="text-ink/50">
            Page {currentPage} of {pageCount}
          </span>
          {currentPage < pageCount ? (
            <button
              type="button"
              onClick={() => setPage(currentPage + 1)}
              className="font-medium text-navy-900 underline hover:text-navy-950"
            >
              Next →
            </button>
          ) : (
            <span />
          )}
        </div>
      )}
    </section>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
        active ? "bg-navy-950 text-cream" : "border border-navy-950/20 text-navy-950/70 hover:border-navy-950/40"
      }`}
    >
      {children}
    </button>
  );
}

function SortableHeader({
  sortKey,
  sortBy,
  sortDir,
  onSort,
  children,
}: {
  sortKey: SortKey;
  sortBy: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  children: React.ReactNode;
}) {
  const active = sortBy === sortKey;
  return (
    <th className="p-3 font-medium">
      <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1 hover:text-ink">
        {children}
        <span className={`text-[10px] ${active ? "text-navy-900" : "text-ink/20"}`}>
          {active ? (sortDir === "asc" ? "▲" : "▼") : "▲"}
        </span>
      </button>
    </th>
  );
}
