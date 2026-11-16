
"use client";

import { type FormEvent, useState } from "react";
import {
  Award,
  CalendarDays,
  CheckCircle2,
  Download,
  FileBadge,
  Loader2,
  Mail,
  MapPin,
  Search,
  ShieldCheck,
} from "lucide-react";

type PublicEvent = {
  name: string;
  slug: string;
  description: string;
  startDate: string;
  endDate: string;
  venue: string;
  city: string;
  organizer: string;
  imageUrl?: string;
};

type CertificateResult = {
  id: string;
  certificateId: string;
  fileName: string;
  generatedAt: string;
  categoryId: string;
};

type SearchResult = {
  success: boolean;
  message?: string;
  participantName?: string;
  certificates?: CertificateResult[];
};

export default function PublicEventPage({
  event,
}: {
  event: PublicEvent;
}) {
  const [email, setEmail] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [certificates, setCertificates] = useState<CertificateResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [downloadingId, setDownloadingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

  async function handleSearch(eventObject: FormEvent<HTMLFormElement>) {
    eventObject.preventDefault();
    setSearching(true);
    setError("");
    setNotice("");
    setCertificates([]);
    setParticipantName("");

    try {
      const response = await fetch(
        `/api/public/events/${encodeURIComponent(event.slug)}/certificates/search`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
          }),
        }
      );

      const result = (await response.json()) as SearchResult;

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to find your certificates.");
      }

      setParticipantName(result.participantName || "");
      setCertificates(result.certificates || []);

      if (!result.certificates?.length) {
        setNotice(
          result.message || "No generated certificates are available yet."
        );
      }
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSearching(false);
    }
  }

  async function handleDownload(certificate: CertificateResult) {
    setDownloadingId(certificate.id);
    setError("");

    try {
      const response = await fetch(
        `/api/public/events/${encodeURIComponent(event.slug)}/certificates/download`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            generatedCertificateId: certificate.id,
          }),
        }
      );

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;

        throw new Error(
          result?.message || "Unable to download the certificate."
        );
      }

      const blob = await response.blob();

      if (!blob.size) {
        throw new Error("The certificate PDF is empty.");
      }

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = objectUrl;
      anchor.download = certificate.fileName || "certificate.pdf";

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Unable to download the certificate."
      );
    } finally {
      setDownloadingId("");
    }
  }

  return (
    <main className="min-h-screen bg-[#fffaf7] text-[#241000]">
      {/* Header */}
      <header className="border-b border-orange-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EA580C] text-white shadow-lg shadow-orange-500/20">
              <Award size={24} />
            </div>

            <div>
              <p className="text-sm font-extrabold tracking-tight">
                Certificate Studio
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[2px] text-orange-600">
                Public Certificate Portal
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:flex">
            <ShieldCheck size={14} />
            Secure verification
          </div>
        </div>
      </header>

      {/* Event Hero */}
      <section
        className={`relative isolate overflow-hidden border-b border-orange-100 ${
          event.imageUrl
            ? "bg-[#241000] text-white"
            : "bg-white text-[#241000]"
        }`}
      >
        {event.imageUrl ? (
          <>
            <img
              src={event.imageUrl}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 -z-20 h-full w-full object-cover"
            />
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#180b04]/95 via-[#241000]/80 to-[#241000]/40" />
            <div className="absolute inset-0 -z-10 bg-black/20" />
          </>
        ) : (
          <>
            <div className="pointer-events-none absolute -right-24 -top-32 -z-10 h-80 w-80 rounded-full bg-orange-100/70 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-40 -left-10 -z-10 h-80 w-80 rounded-full bg-amber-100/50 blur-3xl" />
          </>
        )}

        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24 lg:py-28">
          <div className="max-w-3xl">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${
                event.imageUrl
                  ? "border-white/25 bg-white/10 text-white backdrop-blur-md"
                  : "border-orange-100 bg-orange-50 text-orange-700"
              }`}
            >
              <Award size={14} />
              Official event certificate portal
            </span>

            <h1
              className={`mt-6 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl ${
                event.imageUrl ? "text-white" : "text-[#241000]"
              }`}
            >
              {event.name}
            </h1>

            {event.description && (
              <p
                className={`mt-5 max-w-2xl text-sm leading-7 sm:text-base ${
                  event.imageUrl ? "text-white/85" : "text-[#806e63]"
                }`}
              >
                {event.description}
              </p>
            )}

            <div
              className={`mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm ${
                event.imageUrl ? "text-white/90" : "text-[#806e63]"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <CalendarDays
                  size={16}
                  className={
                    event.imageUrl ? "text-orange-300" : "text-orange-600"
                  }
                />
                {formatDate(event.startDate)} – {formatDate(event.endDate)}
              </span>

              <span className="inline-flex items-center gap-2">
                <MapPin
                  size={16}
                  className={
                    event.imageUrl ? "text-orange-300" : "text-orange-600"
                  }
                />
                {event.venue}, {event.city}
              </span>
            </div>

            {event.organizer && (
              <p
                className={`mt-4 text-xs ${
                  event.imageUrl ? "text-white/75" : "text-[#a18d81]"
                }`}
              >
                Organized by {event.organizer}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Certificate Access */}
      <section className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:py-16">
        <div className="space-y-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[2px] text-orange-600">
              Certificate access
            </p>

            <h2 className="mt-2 text-2xl font-extrabold tracking-tight">
              Download your certificate
            </h2>

            <p className="mt-3 text-sm leading-7 text-[#806e63]">
              Enter your registered email address. We will verify it against
              the participant records for this event and show available certificates.
            </p>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm sm:p-6">
            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-xs font-bold text-[#49372c]"
                >
                  Registered email address
                </label>

                <div className="relative">
                  <Mail
                    size={17}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a18d81]"
                  />

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    maxLength={254}
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="h-12 w-full rounded-xl border border-[#eee2da] bg-[#fffaf7] pl-11 pr-4 text-sm outline-none transition placeholder:text-[#b4a399] focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={searching || !email.trim()}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#EA580C] px-5 text-sm font-bold text-white shadow-lg shadow-orange-200 transition hover:bg-[#c94b08] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {searching ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <Search size={17} />
                )}

                {searching ? "Verifying details..." : "Find my certificates"}
              </button>
            </form>

            <div className="mt-5 flex items-start gap-2 rounded-xl bg-[#fffaf7] p-3 text-[11px] leading-5 text-[#8b776b]">
              <ShieldCheck
                size={15}
                className="mt-0.5 shrink-0 text-emerald-600"
              />
              Your email address is used only to verify certificate access and
              is never displayed publicly.
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="min-w-0">
          <div className="flex h-full min-h-[360px] flex-col rounded-2xl border border-[#f1e6df] bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center gap-3 border-b border-[#f5ede8] pb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <Award size={22} />
              </div>

              <div>
                <h3 className="font-bold text-[#241000]">
                  Your certificates
                </h3>
                <p className="mt-0.5 text-xs text-[#a18d81]">
                  Verified event certificates appear here
                </p>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            {notice && !error && (
              <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
                {notice}
              </div>
            )}

            {certificates.length > 0 ? (
              <div className="mt-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-[#241000]">
                      Hello, {participantName}
                    </p>

                    <p className="mt-1 text-xs text-[#8b776b]">
                      {certificates.length} certificate
                      {certificates.length === 1 ? "" : "s"} available
                    </p>
                  </div>

                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                    <CheckCircle2 size={12} />
                    Verified
                  </span>
                </div>

                <div className="space-y-3">
                  {certificates.map((certificate) => (
                    <div
                      key={certificate.id}
                      className="flex flex-col gap-3 rounded-xl border border-[#f1e6df] p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                          <FileBadge size={19} />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[#241000]">
                            {certificate.fileName}
                          </p>

                          <p className="mt-1 text-[11px] text-[#9a877c]">
                            Certificate ID: {certificate.certificateId}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleDownload(certificate)}
                        disabled={Boolean(downloadingId)}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#EA580C] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#c94b08] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {downloadingId === certificate.id ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <Download size={15} />
                        )}

                        {downloadingId === certificate.id
                          ? "Preparing..."
                          : "Download PDF"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : !error && !notice ? (
              <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#fff5ef] text-orange-500">
                  <FileBadge size={29} />
                </div>

                <h4 className="mt-5 text-sm font-bold text-[#49372c]">
                  Your certificates will appear here
                </h4>

                <p className="mt-2 max-w-xs text-xs leading-6 text-[#a18d81]">
                  Complete the verification form to check whether your event
                  certificates are ready.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-orange-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-center text-[11px] text-[#a18d81] sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:text-left">
          <span>
            © {new Date().getFullYear()} {event.name}. All rights reserved.
          </span>

          <span className="inline-flex items-center justify-center gap-1.5">
            <ShieldCheck size={13} className="text-emerald-600" />
            Powered by Certificate Studio
          </span>
        </div>
      </footer>
    </main>
  );
}
