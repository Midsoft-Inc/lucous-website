"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import {
  ArrowRight,
  BookOpen,
  Bot,
  ChartLine,
  ClipboardCheck,
  Flame,
  Gamepad2,
  GraduationCap,
  Lightbulb,
  Sparkles,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { useDialogs } from "@/components/site/dialogs"
import { AnimatedBar, AnimatedRing, Counter, Reveal } from "@/components/site/anim"
import { Eyebrow, Section } from "@/components/site/section"

const TOPIC_BARS = [
  { label: "Quadratic Equations", value: 86, bar: "bg-sky-400" },
  { label: "Chemical Bonding", value: 64, bar: "bg-emerald-400" },
  { label: "Trigonometry", value: 41, bar: "bg-rose-400" },
]

const MASTERY = [
  { label: "Maths", value: 82, color: "text-sky-400" },
  { label: "Science", value: 68, color: "text-emerald-400" },
  { label: "English", value: 74, color: "text-amber-400" },
]

const QUICK_FEATURES = [
  { title: "Study Content", subtitle: "Concepts, notes & more", icon: BookOpen, tone: "blue" },
  { title: "Games", subtitle: "Learn while you play", icon: Gamepad2, tone: "purple" },
  { title: "Test Module", subtitle: "Practice & boost scores", icon: ClipboardCheck, tone: "green" },
  { title: "AI Teacher", subtitle: "Personalized guidance", icon: Bot, tone: "orange" },
  { title: "Track Progress", subtitle: "Know, improve & grow", icon: ChartLine, tone: "pink" },
] as const

function DashboardMock() {
  return (
    <div className="relative mx-auto w-full max-w-[610px]">
      <div aria-hidden className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-cyan-400/20 via-blue-500/10 to-fuchsia-500/20 blur-2xl" />
      <div className="relative rounded-[1.35rem] border border-cyan-300/25 bg-[#101b32]/95 p-4 shadow-[0_0_34px_rgba(34,211,238,0.13),0_20px_70px_rgba(0,0,0,0.38)] sm:p-5">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-300">AS</div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">Aarav S.</p>
            <p className="truncate text-xs text-slate-400">Class 10 · CBSE</p>
          </div>
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-300">
            <Trophy className="size-3.5" /> Lv 12
          </span>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs text-slate-300">
            <span className="font-semibold text-white"><Counter to={2840} suffix=" XP" /></span>
            <span>180 XP to Lv 13</span>
          </div>
          <AnimatedBar value={95} className="h-2 bg-slate-800" barClassName="bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400" />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {[
            { icon: Flame, value: "12", label: "Day Streak", color: "text-orange-400" },
            { icon: Trophy, value: "5/8", label: "Badges", color: "text-amber-400" },
            { icon: ChartLine, value: "#4", label: "Class Rank", color: "text-sky-400" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-700/70 bg-[#0b1428] p-2.5 text-center">
              <item.icon className={`mx-auto size-4 ${item.color}`} />
              <p className="mt-1 text-base font-bold leading-none text-white">{item.value}</p>
              <p className="mt-1 text-[10px] font-medium text-slate-400">{item.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-3.5 grid grid-cols-3 gap-2 rounded-xl border border-slate-700/70 bg-[#0b1428]/80 p-3 sm:p-4">
          {MASTERY.map((item, index) => (
            <AnimatedRing key={item.label} value={item.value} size={76} strokeWidth={7} delay={0.2 + index * 0.15} className={item.color}>
              <span className="text-xs font-bold text-white">{item.value}%</span>
              <span className="text-[10px] text-slate-400">{item.label}</span>
            </AnimatedRing>
          ))}
        </div>

        <div className="mt-3.5 space-y-3">
          {TOPIC_BARS.map((topic, index) => (
            <div key={topic.label}>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-200">
                <span>{topic.label}</span><span className="text-slate-400">{topic.value}%</span>
              </div>
              <AnimatedBar value={topic.value} delay={0.15 * index} className="h-1.5 bg-slate-800" barClassName={topic.bar} />
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-orange-400/30 bg-gradient-to-r from-orange-500/10 to-fuchsia-500/10 p-3">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-orange-400"><Target className="size-4" /> Focus Next</p>
          <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-slate-200">
            <span>Trigonometry — Identities</span><span className="font-semibold text-orange-400">Drill →</span>
          </div>
        </div>
      </div>

      <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }} className="absolute -right-2 -top-5 hidden items-center gap-2.5 rounded-xl border border-slate-700 bg-[#121e35] p-3 shadow-xl sm:flex lg:-right-7">
        <span className="grid size-8 place-items-center rounded-lg bg-emerald-400/15 text-emerald-300"><Zap className="size-4" /></span>
        <span><span className="block text-xs font-bold text-white">+120 XP</span><span className="block text-[10px] text-slate-400">Boss Challenge cleared</span></span>
      </motion.div>
    </div>
  )
}

function MascotOrbit() {
  const orbitItems = [
    { icon: BookOpen, className: "left-[4%] top-[17%] bg-blue-500", delay: 0 },
    { icon: Gamepad2, className: "left-[31%] top-[3%] bg-violet-500", delay: 0.4 },
    { icon: ClipboardCheck, className: "right-[14%] top-[7%] bg-emerald-500", delay: 0.8 },
    { icon: GraduationCap, className: "right-[1%] top-[31%] bg-orange-500", delay: 1.2 },
    { icon: ChartLine, className: "right-[0%] bottom-[28%] bg-pink-500", delay: 1.6 },
  ]

  return (
    <div className="relative mx-auto hidden h-[500px] w-full max-w-[390px] items-end justify-center lg:flex">
      <div aria-hidden className="absolute left-1/2 top-[12%] size-[300px] -translate-x-1/2 rounded-full border border-cyan-400/20" />
      <div aria-hidden className="absolute left-1/2 top-[17%] size-[250px] -translate-x-1/2 rounded-full border border-blue-400/15" />
      <motion.div aria-hidden animate={{ rotate: 360 }} transition={{ duration: 26, repeat: Infinity, ease: "linear" }} className="absolute left-1/2 top-[12%] size-[300px] -translate-x-1/2 rounded-full border-t border-cyan-300/60" />
      {orbitItems.map(({ icon: Icon, className, delay }) => (
        <motion.div key={className} animate={{ y: [0, -9, 0], rotate: [-3, 3, -3] }} transition={{ duration: 4.5, delay, repeat: Infinity, ease: "easeInOut" }} className={`absolute z-20 grid size-[58px] place-items-center rounded-2xl border border-white/25 text-white shadow-[0_10px_35px_rgba(0,0,0,.35)] ${className}`}>
          <Icon className="size-7" />
        </motion.div>
      ))}
      <motion.div animate={{ y: [0, -7, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} className="relative z-10 h-[470px] w-[350px]">
        <Image src="/chatbot/lucous-mascot.png" alt="LUCOUS student mascot holding a book" fill priority sizes="350px" className="object-contain object-bottom drop-shadow-[0_18px_35px_rgba(0,0,0,.45)]" />
      </motion.div>
      <div aria-hidden className="absolute bottom-5 left-1/2 h-8 w-[360px] -translate-x-1/2 rounded-[50%] border-2 border-cyan-300/80 shadow-[0_0_22px_rgba(34,211,238,.8)]" />
      <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 3, repeat: Infinity }} className="absolute right-[5%] top-[38%] text-amber-300"><Lightbulb className="size-11 drop-shadow-[0_0_14px_rgba(251,191,36,.7)]" /></motion.div>
    </div>
  )
}

function FeatureStrip() {
  return (
    <div className="mt-9 grid grid-cols-2 gap-2 rounded-[1.5rem] border border-blue-400/25 bg-[#0c1830]/90 p-2.5 shadow-[0_14px_45px_rgba(0,0,0,.22)] sm:grid-cols-3 lg:grid-cols-5 lg:gap-3 lg:p-3">
      {QUICK_FEATURES.map(({ title, subtitle, icon: Icon, tone }) => (
        <a key={title} href={title === "Games" ? "#games" : title === "AI Teacher" ? "#ai-team" : title === "Track Progress" ? "#student-dashboard" : "#how-it-works"} className="group flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-3 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/40 hover:bg-white/[0.09]">
          <span className={`grid size-11 shrink-0 place-items-center rounded-xl text-white shadow-lg transition group-hover:scale-105 ${tone === "blue" ? "bg-gradient-to-br from-blue-500 to-cyan-500" : tone === "purple" ? "bg-gradient-to-br from-violet-500 to-purple-600" : tone === "green" ? "bg-gradient-to-br from-emerald-500 to-green-600" : tone === "orange" ? "bg-gradient-to-br from-orange-500 to-amber-500" : "bg-gradient-to-br from-pink-500 to-fuchsia-600"}`}><Icon className="size-5" /></span>
          <span className="min-w-0"><span className="block truncate text-xs font-bold text-white sm:text-sm">{title}</span><span className="mt-0.5 block truncate text-[10px] text-slate-400 sm:text-xs">{subtitle}</span></span>
        </a>
      ))}
    </div>
  )
}

export function Hero() {
  const { openAuth } = useDialogs()

  return (
    <Section id="home" className="overflow-hidden bg-[#060d1d] pb-8 pt-10 text-white sm:pt-14 lg:pt-12" innerClassName="max-w-[1640px]">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
        <div className="absolute -left-48 top-20 size-[30rem] rounded-full bg-blue-600/10 blur-[110px]" />
        <div className="absolute right-[20%] top-10 size-[28rem] rounded-full bg-cyan-500/10 blur-[110px]" />
        <div className="absolute -right-48 top-48 size-[30rem] rounded-full bg-fuchsia-600/10 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.12] [background-image:radial-gradient(#7894c7_0.7px,transparent_0.7px)] [background-size:24px_24px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
      </div>

      <div className="relative z-10 grid items-center gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(250px,.78fr)_minmax(0,1.18fr)] lg:gap-5 xl:gap-8">
        <div className="max-w-[560px]">
          <Reveal><Eyebrow icon={Sparkles} tone="blue" className="border-blue-400/35 bg-blue-500/15 text-blue-300">Learn · Play · Test · Improve</Eyebrow></Reveal>
          <Reveal delay={0.08}>
            <h1 className="mt-5 text-[2.65rem] font-extrabold leading-[1.04] tracking-[-0.045em] text-balance sm:text-5xl xl:text-[3.65rem]">
              Learning should feel like <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-400 bg-clip-text text-transparent">progress.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-5 max-w-[540px] text-base leading-[1.65] text-slate-300 sm:text-lg">LUCOUS turns any syllabus into bite-sized lessons, fun games and a personal AI team — then shows you exactly what to improve next, every single day.</p>
          </Reveal>
          <Reveal delay={0.24}>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button size="lg" className="h-12 rounded-xl border-0 bg-gradient-to-r from-cyan-500 via-blue-600 to-fuchsia-600 px-7 text-[15px] font-bold text-white shadow-[0_0_25px_rgba(59,130,246,.35)] transition hover:brightness-110" onClick={() => openAuth("signup")}>Start Learning <ArrowRight data-icon="inline-end" /></Button>
              <a href="#games" className="inline-flex h-12 items-center gap-2 rounded-xl border border-slate-500/70 bg-slate-900/50 px-6 text-[15px] font-semibold text-white transition hover:border-cyan-300/70 hover:bg-slate-800"><Gamepad2 className="size-4" /> Explore Games</a>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-medium text-slate-400 sm:text-xs">
              {["Free forever plan", "No credit card", "Works on any device"].map((item) => <span key={item} className="flex items-center gap-1.5"><span className="grid size-4 place-items-center rounded-full border border-cyan-400 text-cyan-300">✓</span>{item}</span>)}
            </div>
          </Reveal>
          <Reveal delay={0.32}>
            <dl className="mt-9 flex flex-wrap gap-x-7 gap-y-4 border-t border-slate-700/70 pt-5 sm:gap-x-9">
              {[
                { to: 10, suffix: "+", label: "Learning Games", icon: Gamepad2, color: "text-violet-400" },
                { to: 8, suffix: "+", label: "AI Teammates", icon: Users, color: "text-cyan-400" },
                { to: 990, suffix: "+", label: "Bite-sized Lessons", icon: BookOpen, color: "text-amber-400" },
              ].map(({ to, suffix, label, icon: Icon, color }) => <div key={label} className="min-w-[95px]"><dd className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl"><Icon className={`size-5 ${color}`} /><Counter to={to} suffix={suffix} /></dd><dt className="mt-1 text-[11px] text-slate-400 sm:text-xs">{label}</dt></div>)}
            </dl>
          </Reveal>
        </div>

        <MascotOrbit />

        <Reveal delay={0.15} y={24}><DashboardMock /></Reveal>
      </div>

      <div className="relative z-10"><FeatureStrip /></div>
    </Section>
  )
}
