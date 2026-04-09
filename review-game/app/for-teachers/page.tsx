import type { Metadata } from 'next';
import Link from 'next/link';
import MarketingNav from '@/components/marketing/MarketingNav';
import MarketingFooter from '@/components/marketing/MarketingFooter';
import {
  PencilSquareIcon,
  LinkIcon,
  TrophyIcon,
  UserGroupIcon,
  HandRaisedIcon,
  ShieldCheckIcon,
  LightBulbIcon,
} from '@heroicons/react/24/outline';

export const metadata: Metadata = {
  title: 'For Teachers | Review Game',
  description:
    'Strategies and classroom tips for running Review Game — keep every student engaged without losing control of the room.',
  openGraph: { type: 'website' },
  twitter: { card: 'summary_large_image' },
};

export default function ForTeachersPage() {
  return (
    <>
      <MarketingNav />

      <main>
        {/* ── Hero ─────────────────────────────────────── */}
        <section className="bg-gradient-to-b from-white to-gray-50 pt-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight tracking-tight">
              Run Review Game{' '}
              <span className="text-blue-600">like a pro</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
              Strategies and classroom tips for teachers who want every student
              engaged — without losing control of the room.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="w-full sm:w-auto px-8 py-3 rounded-lg bg-blue-600 text-white font-semibold text-base hover:bg-blue-700 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
              >
                Get Started Free
              </Link>
              <Link
                href="/pricing"
                className="w-full sm:w-auto px-8 py-3 rounded-lg border border-gray-300 text-gray-700 font-semibold text-base hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
              >
                View Pricing
              </Link>
            </div>
          </div>
        </section>

        {/* ── Section 1: How the Game Works ────────────── */}
        <section className="py-20 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
                How it works
              </h2>
              <p className="mt-4 text-lg text-gray-600 max-w-xl mx-auto">
                From setup to scoreboard in three steps.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  icon: PencilSquareIcon,
                  step: '1',
                  title: 'Build your question bank',
                  body: 'Create categories and questions using any subject matter. Save banks and reuse them across multiple games — no rebuilding from scratch every time.',
                },
                {
                  icon: LinkIcon,
                  step: '2',
                  title: 'Launch and share the code',
                  body: "Start a game session and share the join code with your class. Teams connect from any device — phones, tablets, or laptops. No app install required.",
                },
                {
                  icon: TrophyIcon,
                  step: '3',
                  title: 'Play and review together',
                  body: 'You control the board from your device. Teams buzz in, earn points, and compete for the win. Final Jeopardy keeps everyone in it until the last question.',
                },
              ].map(({ icon: Icon, step, title, body }) => (
                <div
                  key={step}
                  className="relative bg-gray-50 rounded-xl p-8 border border-gray-100"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                      {step}
                    </div>
                    <Icon className="h-6 w-6 text-blue-600" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 2: Setting Up Teams ──────────────── */}
        <section className="py-20 bg-gray-50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-4">
              <UserGroupIcon className="h-7 w-7 text-blue-600 flex-shrink-0" aria-hidden="true" />
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
                Setting up teams
              </h2>
            </div>
            <p className="text-lg text-gray-600 mb-10 max-w-2xl">
              The right team structure makes participation automatic. Here&apos;s what
              works in real classrooms.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  title: 'Keep teams small — 3 to 5 students',
                  body: 'Larger teams let students hide. With 3–5 per team, everyone has a role and there is nowhere to disappear. Fewer than three and shy students feel exposed.',
                },
                {
                  title: 'Assign teams randomly',
                  body: 'Random grouping breaks up friend clusters that tend to carry one student and let others coast. Use a random name picker, draw sticks, or count off around the room.',
                },
                {
                  title: 'Let teams choose their name',
                  body: 'A self-chosen team name builds immediate identity and investment. Give teams 60 seconds — the time limit keeps it from becoming a distraction.',
                },
                {
                  title: 'Assign a rotating spokesperson',
                  body: 'Before the game, tell each team to pick a speaking order. The spokesperson changes every question. This prevents one student from dominating and guarantees everyone speaks.',
                },
                {
                  title: 'Seat teams together, away from other teams',
                  body: 'Physical proximity helps teams huddle. Proximity to other teams invites cross-talk. A horseshoe or cluster arrangement usually works better than rows.',
                },
                {
                  title: 'Match team counts to your class size',
                  body: 'Aim for 4–6 teams in a typical class. Too many teams means long waits between turns; too few and competition disappears. Adjust based on how many students are present.',
                },
              ].map(({ title, body }, i) => (
                <div key={i} className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 3: Encouraging Full Participation ─── */}
        <section className="py-20 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-4">
              <HandRaisedIcon className="h-7 w-7 text-blue-600 flex-shrink-0" aria-hidden="true" />
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
                Getting everyone involved
              </h2>
            </div>
            <p className="text-lg text-gray-600 mb-10 max-w-2xl">
              Competition naturally pulls in confident students. These strategies
              bring in the rest.
            </p>

            <div className="space-y-6">
              {[
                {
                  number: '01',
                  title: 'Use the answer relay',
                  body: 'Assign each team member a number (1, 2, 3…). For question 1, person #1 is the speaker; for question 2, person #2; and so on. Rotate back to #1 after cycling through the team. Every student knows their turn is coming — they cannot check out.',
                },
                {
                  number: '02',
                  title: 'Add a think time rule',
                  body: 'Before any team can buzz in, give the class 15–20 seconds of silent think time. This levels the playing field between fast processors and slower, more deliberate thinkers — and improves answer quality across the board.',
                },
                {
                  number: '03',
                  title: 'Require a full-team discussion before answering',
                  body: 'No team may submit an answer until every member has said at least one thing. One student whispers "I don\'t know" still counts — what matters is that every voice is engaged. This norm is easiest to establish in the first two or three questions.',
                },
                {
                  number: '04',
                  title: 'Award a bonus point for process, not just correctness',
                  body: 'Announce before the game that you will occasionally award a bonus point to a team you observe collaborating well — regardless of whether they got the answer right. Watching for this keeps you actively scanning the room and gives quieter students a path to contribute.',
                },
                {
                  number: '05',
                  title: 'Debrief wrong answers out loud',
                  body: 'When a team answers incorrectly, open the floor briefly before revealing the correct answer. "Does any other team want to add to that?" keeps all teams engaged even when it isn\'t their turn.',
                },
              ].map(({ number, title, body }) => (
                <div key={number} className="flex gap-6 items-start">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                    {number}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 4: Keeping Order ─────────────────── */}
        <section className="py-20 bg-gray-50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheckIcon className="h-7 w-7 text-blue-600 flex-shrink-0" aria-hidden="true" />
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
                Keeping things under control
              </h2>
            </div>
            <p className="text-lg text-gray-600 mb-10 max-w-2xl">
              Excitement is good. Chaos is not. Set these norms before the first
              question and hold them consistently.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Callout */}
              <div className="md:col-span-2 bg-blue-50 border border-blue-200 rounded-xl p-6">
                <p className="font-semibold text-blue-900 text-sm uppercase tracking-wide mb-2">
                  Most important rule
                </p>
                <p className="text-blue-900 font-medium text-lg">
                  You control the board — students never touch the teacher device.
                </p>
                <p className="mt-2 text-blue-800 text-sm leading-relaxed">
                  The game only advances when you advance it. This gives you full
                  control of pacing, the ability to pause for discussion, and a
                  natural way to redirect the room without stopping the game entirely.
                </p>
              </div>

              {[
                {
                  title: 'Set buzz-in rules before you start',
                  body: 'Decide upfront: raised hand, team spokesperson speaks, or a designated clapper. Announce it, demonstrate it, and stick to it. Inconsistent enforcement is the fastest path to noise.',
                },
                {
                  title: 'Use a countdown for answers',
                  body: 'Give teams a fixed window — 30 seconds is usually right — to submit their answer after you read the question. A countdown visible to the room creates urgency without chaos.',
                },
                {
                  title: 'Establish Daily Double wager limits',
                  body: "Before starting, announce a wager cap — for example, no team may wager more than their current score. This prevents the runaway leader problem and keeps all teams competitive.",
                },
                {
                  title: 'Brief Final Jeopardy before the last question',
                  body: "Spend 60 seconds explaining Final Jeopardy rules: wagers are silent, answers are written, all teams reveal at the same time. Students who understand the format play it correctly; students who don't cause confusion.",
                },
                {
                  title: 'Have a reset signal',
                  body: 'Choose a specific signal — a clap pattern, a phrase, or raising your hand — that means "reset and listen." Practice it before the game so students know it means stop, not eventually stop.',
                },
                {
                  title: 'Address disputes immediately, not after the game',
                  body: 'If a team disputes a ruling, make a call and move on. Announce at the start that all teacher rulings are final during play. Post-game reviews are fine, but mid-game debates kill momentum for everyone.',
                },
              ].map(({ title, body }, i) => (
                <div key={i} className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 5: Pro Tips ──────────────────────── */}
        <section className="py-20 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-4">
              <LightBulbIcon className="h-7 w-7 text-blue-600 flex-shrink-0" aria-hidden="true" />
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
                Pro tips
              </h2>
            </div>
            <p className="text-lg text-gray-600 mb-10 max-w-2xl">
              Small adjustments with an outsized impact on how the game feels for
              you and your students.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  title: 'Run a practice game first',
                  body: "Use a low-stakes topic — class trivia, pop culture, school history — for the first game. Students learn the mechanics without the pressure of a grade. The second game, on real content, runs far more smoothly.",
                },
                {
                  title: "Hold off on Final Jeopardy",
                  body: "Skip Final Jeopardy the first time you play. Let students master the core board before adding wager mechanics. Introduce it once they understand how scoring works and are comfortable with the pace.",
                },
                {
                  title: 'Review wrong answers after the game',
                  body: 'The 10 minutes after a game are the highest-retention window of the period. Competitive energy carries over. Walk through missed questions while students are still engaged, not after they have mentally moved on.',
                },
                {
                  title: 'Reuse and iterate your question banks',
                  body: 'Save every question bank. After the game, note which questions stumped everyone — those are your teaching targets. Revise the bank, run it again in a few weeks, and watch scores improve.',
                },
                {
                  title: 'Mix question difficulty intentionally',
                  body: 'Put easier questions in lower point values and harder ones in higher values — but plant one hard question at the 100-point level early. It signals to students that point value is not always a reliable difficulty indicator and keeps them on their toes.',
                },
                {
                  title: 'Celebrate collaboration, not just the winner',
                  body: 'Publicly recognize the team that collaborated most visibly — regardless of their final score. Students remember recognition. A team that communicates well and loses will bring better energy to the next game than a team that won through one loud student.',
                },
              ].map(({ title, body }, i) => (
                <div
                  key={i}
                  className="bg-gray-50 rounded-xl p-6 border border-gray-100"
                >
                  <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA Banner ───────────────────────────────── */}
        <section className="bg-blue-600 py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Ready to try it with your class?
            </h2>
            <p className="text-lg text-blue-100 mb-8 max-w-xl mx-auto">
              Free to start, no credit card required. Build your first game in
              minutes.
            </p>
            <Link
              href="/signup"
              className="inline-block px-8 py-3 rounded-lg bg-white text-blue-600 font-semibold text-base hover:bg-blue-50 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white focus-visible:ring-offset-blue-600"
            >
              Get Started Free
            </Link>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </>
  );
}
