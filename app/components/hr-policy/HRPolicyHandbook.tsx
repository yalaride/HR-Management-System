import { HR_POLICY_SECTIONS, HR_POLICY_TITLE } from "./policyContent";

const SECTION_STYLES = [
  "border-slate-200 bg-white",
  "border-amber-200 bg-amber-50/40",
  "border-emerald-200 bg-emerald-50/40",
  "border-sky-200 bg-sky-50/40",
  "border-rose-200 bg-rose-50/40",
  "border-indigo-200 bg-indigo-50/40",
  "border-teal-200 bg-teal-50/40",
  "border-orange-200 bg-orange-50/40",
  "border-slate-300 bg-slate-50",
];

export default function HRPolicyHandbook({ audience }: { audience: "admin" | "employee" }) {
  return (
    <div className="min-h-screen bg-surface-main pb-16">
      <div className="w-full space-y-6 px-2 py-6">
        <header className="border-b border-line-subtle pb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-accent">
            {audience === "admin" ? "Company policy" : "Your workplace rules"}
          </p>
          <h1 className="mt-1 max-w-3xl text-2xl font-extrabold tracking-tight text-content-main sm:text-3xl">
            {HR_POLICY_TITLE}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-content-secondary">
            {audience === "admin"
              ? "This policy is fixed for every employee. It is not added or edited from the admin panel."
              : "Read the probation, leave, and attendance rules that apply to you at Sync Up."}
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
          <nav className="h-fit rounded-2xl border border-line-subtle bg-white p-3 lg:sticky lg:top-4">
            <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-content-muted">Sections</p>
            <ol className="space-y-1">
              {HR_POLICY_SECTIONS.map((section) => (
                <li key={section.number}>
                  <a
                    href={`#policy-${section.number}`}
                    className="block rounded-lg px-2 py-1.5 text-xs font-semibold text-content-secondary hover:bg-slate-50 hover:text-content-main"
                  >
                    {section.number}. {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="space-y-4">
            {HR_POLICY_SECTIONS.map((section, index) => (
              <article
                key={section.number}
                id={`policy-${section.number}`}
                className={`scroll-mt-4 rounded-2xl border p-5 shadow-xs ${SECTION_STYLES[index]}`}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-black text-brand-accent ring-1 ring-line-subtle">
                    {section.number}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-content-main">{section.title}</h2>
                    <div className="mt-3 space-y-3">
                      {section.paragraphs.map((paragraph) => (
                        <p key={paragraph} className="text-sm leading-6 text-content-secondary">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
