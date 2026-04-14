import type { Metadata } from 'next';
import MarketingNav from '@/components/marketing/MarketingNav';
import MarketingFooter from '@/components/marketing/MarketingFooter';

export const metadata: Metadata = {
  title: 'Network Requirements | Review Game',
  description:
    'Firewall and network configuration guide for school IT administrators deploying Review Game.',
};

interface RequirementRow {
  domain: string;
  protocol: string;
  port: string;
  purpose: string;
}

const classroomRequirements: RequirementRow[] = [
  {
    domain: 'Your app domain (e.g. reviewgame.com)',
    protocol: 'HTTPS',
    port: '443',
    purpose: 'Application — all pages, assets, and API calls',
  },
  {
    domain: '*.supabase.co',
    protocol: 'HTTPS',
    port: '443',
    purpose: 'Database API and authentication (REST + Auth)',
  },
  {
    domain: '*.supabase.co',
    protocol: 'WSS',
    port: '443',
    purpose: 'Real-time game updates (WebSocket over TLS)',
  },
];

const billingRequirements: RequirementRow[] = [
  {
    domain: 'js.stripe.com',
    protocol: 'HTTPS',
    port: '443',
    purpose: 'Stripe payment library (subscription checkout only)',
  },
  {
    domain: 'api.stripe.com',
    protocol: 'HTTPS',
    port: '443',
    purpose: 'Stripe payment API (subscription checkout only)',
  },
];

function RequirementsTable({ rows }: { rows: RequirementRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-gray-700">Domain</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-700">Protocol</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-700">Port</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-700">Purpose</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {rows.map((row) => (
            <tr key={`${row.domain}-${row.protocol}`}>
              <td className="px-4 py-3 font-mono text-gray-900 whitespace-nowrap">{row.domain}</td>
              <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {row.protocol}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{row.port}</td>
              <td className="px-4 py-3 text-gray-600">{row.purpose}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function NetworkRequirementsPage() {
  return (
    <>
      <MarketingNav />

      <main className="pt-16">
        {/* Header */}
        <section className="bg-gray-50 border-b border-gray-200">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16">
            <div className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 mb-4">
              For IT Administrators
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Network Requirements
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl">
              This page lists every external domain that student and teacher browsers contact
              when using Review Game. Share this URL with your IT team to simplify firewall
              configuration.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 space-y-12">

          {/* Classroom use */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Classroom use
            </h2>
            <p className="text-gray-600 mb-4">
              Required for teachers running games and students joining them. These are the
              only connections made during an active classroom session.
            </p>
            <RequirementsTable rows={classroomRequirements} />
            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              <strong>Note on WebSocket:</strong> Real-time game state (scores, buzzers,
              question reveals) relies on a persistent WebSocket connection to{' '}
              <span className="font-mono">*.supabase.co</span> over port 443 using the
              WSS protocol. Your firewall must allow outbound WebSocket connections on
              port 443, not just standard HTTPS.
            </div>
          </section>

          {/* Billing / admin */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Account and billing administration
            </h2>
            <p className="text-gray-600 mb-4">
              Only needed on devices where teachers manage their subscription. Not required
              for students or for running games.
            </p>
            <RequirementsTable rows={billingRequirements} />
          </section>

          {/* What is NOT needed */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              What is not required
            </h2>
            <ul className="space-y-2 text-gray-600 text-sm list-disc list-inside">
              <li>
                <strong>Google Fonts / fonts.gstatic.com</strong> — fonts are bundled
                with the application and served from the app domain.
              </li>
              <li>
                <strong>Sentry / o4510321317773312.ingest.us.sentry.io</strong> — error
                reporting is routed through the app domain and never contacts Sentry
                directly from the browser.
              </li>
              <li>
                <strong>Any CDN or third-party analytics</strong> — Review Game does
                not load external analytics scripts in student or teacher browsers.
              </li>
            </ul>
          </section>

          {/* Summary card */}
          <section className="rounded-xl bg-blue-600 text-white px-6 py-8">
            <h2 className="text-lg font-semibold mb-3">Quick-reference summary</h2>
            <p className="text-blue-100 text-sm mb-4">
              For most school firewalls, the allow-list for classroom use is:
            </p>
            <div className="space-y-2 font-mono text-sm">
              <div className="flex gap-3">
                <span className="text-blue-300 shrink-0">HTTPS/443</span>
                <span>Your app domain</span>
              </div>
              <div className="flex gap-3">
                <span className="text-blue-300 shrink-0">HTTPS/443</span>
                <span>*.supabase.co</span>
              </div>
              <div className="flex gap-3">
                <span className="text-blue-300 shrink-0">WSS/443 &nbsp;</span>
                <span>*.supabase.co</span>
              </div>
            </div>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Questions?</h2>
            <p className="text-gray-600 text-sm">
              If you need additional details, packet captures, or have questions about
              specific firewall policies, please contact us at{' '}
              <a
                href="mailto:support@reviewgame.app"
                className="text-blue-600 hover:text-blue-700 underline"
              >
                support@reviewgame.app
              </a>
              . We are happy to work directly with your IT team.
            </p>
          </section>

        </div>
      </main>

      <MarketingFooter />
    </>
  );
}
