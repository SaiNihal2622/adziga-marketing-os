// /app/creatives/_creative-card — preview tile for a creative
import Link from "next/link";

type Creative = {
  id: string;
  name: string;
  format: string;
  platform: string;
  source: string;
  status: string;
  hook: string | null;
  headline: string | null;
  primaryCopy: string | null;
  cta: string | null;
  audience: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  version: number;
  updatedAt: Date;
  campaign?: { id: string; name: string; client: { businessName: string } } | null;
};

const STATUS_TINT: Record<string, string> = {
  DRAFT: "bg-ink-100 text-ink-700 ring-ink-200",
  IN_REVIEW: "bg-amber-50 text-amber-700 ring-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ACTIVE: "bg-brand-50 text-brand-700 ring-brand-200",
  PAUSED: "bg-orange-50 text-orange-700 ring-orange-200",
  ARCHIVED: "bg-ink-50 text-ink-500 ring-ink-200"
};

const SOURCE_LABEL: Record<string, string> = {
  AI_GENERATED: "AI",
  CLIENT_UPLOAD: "Client",
  DESIGNER: "Designer",
  STOCK: "Stock",
  USER_TEMPLATE: "Template"
};

const FORMAT_ICON: Record<string, string> = {
  IMAGE: "🖼",
  VIDEO: "🎬",
  CAROUSEL: "🎴",
  STORY: "📱",
  REEL: "▶",
  TEXT: "T",
  UGC: "👤",
  AUDIO: "🎙"
};

export function CreativeCard({ creative }: { creative: Creative }) {
  const isImage = creative.mediaUrl && /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(creative.mediaUrl);
  const updated = timeAgo(creative.updatedAt);

  return (
    <Link
      href={`/app/creatives/${creative.id}`}
      className="group card-v0 overflow-hidden hover:border-ink-300 hover:shadow-md transition-all flex flex-col"
    >
      {/* Media preview */}
      <div className="relative aspect-square bg-gradient-to-br from-ink-50 to-ink-100 overflow-hidden">
        {creative.mediaUrl && isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={creative.mediaUrl} alt={creative.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-5xl opacity-50">
            {FORMAT_ICON[creative.format] ?? "?"}
          </div>
        )}
        {/* Source badge */}
        <div className="absolute top-2 left-2">
          <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-black/60 text-white">
            {SOURCE_LABEL[creative.source] ?? creative.source}
          </span>
        </div>
        {/* Status badge */}
        <div className="absolute top-2 right-2">
          <span className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ring-1 ${STATUS_TINT[creative.status] ?? STATUS_TINT.DRAFT}`}>
            {creative.status.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* Metadata */}
      <div className="p-3 flex-1 flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink-900 line-clamp-2 leading-tight group-hover:text-brand-600 transition-colors">
            {creative.name}
          </h3>
          <span className="shrink-0 text-[10px] text-ink-400 font-mono">v{creative.version}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-ink-500">
          <span className="px-1.5 py-0.5 rounded bg-ink-50 text-ink-700 font-medium">{creative.platform}</span>
          <span>·</span>
          <span>{creative.format}</span>
        </div>
        {creative.headline && (
          <p className="text-xs text-ink-700 line-clamp-2 mt-1">{creative.headline}</p>
        )}
        {creative.campaign?.client?.businessName && (
          <p className="text-[10px] text-ink-400 mt-auto pt-2 truncate">
            {creative.campaign.client.businessName} · {updated}
          </p>
        )}
      </div>
    </Link>
  );
}

function timeAgo(d: Date): string {
  const ms = Date.now() - new Date(d).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(d).toLocaleDateString();
}
