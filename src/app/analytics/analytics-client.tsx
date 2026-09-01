'use client'

import { useState, useTransition } from 'react'
import Header from '@/components/Header'
import Toast from '@/components/Toast'
import { 
  TrendingUp, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Star, 
  Loader2, 
  Award,
  ChevronDown,
  BookOpen,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  X,
  AlertCircle
} from 'lucide-react'
import { getMonthlyAnalytics, getDailyStandups } from '../actions'

interface Profile {
  id: string
  name: string
  email: string
  role: string
  avatar_url: string
}

interface GroupDist {
  name: string
  color: string
  totalMinutes: number
  totalHours: number
}

interface DailyBreakdownItem {
  date: string
  workMinutes: number
  journalMinutes: number
  tasksCount: number
  productivityScore: number
  mood: string
  standupDetails?: any
}

interface AnalyticsData {
  personalSummary: {
    totalJournalHours: number
    totalTaskHours: number
    completedTasksCount: number
    daysLogged: number
    avgProductivity: number
    comparison: {
      hoursDiff: number
      tasksDiff: number
      journalDiff: number
    }
  }
  groupDistribution: GroupDist[]
  dailyBreakdown: DailyBreakdownItem[]
}

interface AnalyticsClientProps {
  currentProfile: Profile
  initialData: AnalyticsData
  initialMonth: number
  initialYear: number
}

const months = [
  { value: 1, label: 'يناير' },
  { value: 2, label: 'فبراير' },
  { value: 3, label: 'مارس' },
  { value: 4, label: 'أبريل' },
  { value: 5, label: 'مايو' },
  { value: 6, label: 'يونيو' },
  { value: 7, label: 'يوليو' },
  { value: 8, label: 'أغسطس' },
  { value: 9, label: 'سبتمبر' },
  { value: 10, label: 'أكتوبر' },
  { value: 11, label: 'نوفمبر' },
  { value: 12, label: 'ديسمبر' }
]

const years = [2025, 2026, 2027]

const moodMap: Record<string, string> = {
  energetic: 'طاقة عالية 🚀',
  stable: 'مستقر 😊',
  tired: 'متعب 🥱',
  stressed: 'مضغوط 🤯'
}

export default function AnalyticsClient({ currentProfile, initialData, initialMonth, initialYear }: AnalyticsClientProps) {
  const [data, setData] = useState<AnalyticsData>(initialData)
  const [month, setMonth] = useState<number>(initialMonth)
  const [year, setYear] = useState<number>(initialYear)
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null)
  
  // حالات المخططات البيانية التفاعلية
  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null)

  // حالات تفاصيل اليوم المنبثقة (Popup)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedDayDate, setSelectedDayDate] = useState<string>('')
  const [selectedDayDetails, setSelectedDayDetails] = useState<any>(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [selectedDayTasksCount, setSelectedDayTasksCount] = useState<number>(0)
  const [selectedDayWorkMinutes, setSelectedDayWorkMinutes] = useState<number>(0)

  const showToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToast({ message, type })
  }

  const handleDayClick = (dateStr: string, dayItem: any) => {
    setSelectedDayDate(dateStr)
    setSelectedDayTasksCount(dayItem?.tasksCount || 0)
    setSelectedDayWorkMinutes(dayItem?.workMinutes || 0)
    setSelectedDayDetails(dayItem?.standupDetails || null)
    setIsModalOpen(true)
  }

  const handleFetchData = async (selectedMonth: number, selectedYear: number) => {
    setMonth(selectedMonth)
    setYear(selectedYear)
    startTransition(async () => {
      try {
        const res = await getMonthlyAnalytics(selectedMonth, selectedYear)
        setData(res)
      } catch (err: any) {
        showToast('فشل جلب بيانات التقارير: ' + err.message, 'error')
      }
    })
  }

  // إعداد بيانات المخطط
  const chartData = data.groupDistribution.filter(g => g.totalHours > 0)
  const totalHoursSum = chartData.reduce((sum, item) => sum + item.totalHours, 0)

  const formatComparison = (val: number, unit: string) => {
    if (val > 0) {
      return (
        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-md font-bold flex items-center gap-0.5 mt-1 border border-emerald-500/25">
          <ArrowUpRight className="w-3 h-3" />
          <span>+{val} {unit}</span>
        </span>
      )
    } else if (val < 0) {
      return (
        <span className="text-[10px] bg-rose-500/10 text-rose-450 px-2 py-0.5 rounded-md font-bold flex items-center gap-0.5 mt-1 border border-rose-500/25">
          <ArrowDownRight className="w-3 h-3" />
          <span>{val} {unit}</span>
        </span>
      )
    }
    return (
      <span className="text-[10px] bg-theme-bg text-theme-text-muted px-2 py-0.5 rounded-md font-bold flex items-center gap-0.5 mt-1 border border-theme-border/60">
        <span>مستقر</span>
      </span>
    )
  }

  return (
    <div className="flex-grow flex flex-col min-h-screen pb-24 md:pb-8">
      <Header user={currentProfile} />

      <main className="flex-grow max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="space-y-6">
          
          {/* الترويسة والتحكم بالفلتر */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-theme-border pb-5 text-right">
            <div>
              <h1 className="text-2xl font-black text-theme-text flex items-center gap-2 md:justify-start justify-center">
                <span>📈</span>
                <span>تحليل الأداء والإنتاجية الشخصية</span>
              </h1>
              <p className="text-xs text-theme-text-muted mt-1">تتبع إحصائياتك من ساعات العمل، المهام المكتملة، وتوزيع وقتك الشخصي على المشاريع</p>
            </div>

            <div className="flex items-center gap-3 justify-end">
              {isPending && (
                <Loader2 className="w-5 h-5 animate-spin text-theme-accent" />
              )}
              
              <div className="flex items-center gap-2">
                <select
                  value={month}
                  onChange={(e) => handleFetchData(parseInt(e.target.value), year)}
                  className="bg-theme-panel border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-3 py-2 text-xs transition-all outline-none cursor-pointer font-bold"
                >
                  {months.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>

                <select
                  value={year}
                  onChange={(e) => handleFetchData(month, parseInt(e.target.value))}
                  className="bg-theme-panel border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-3 py-2 text-xs transition-all outline-none cursor-pointer font-bold"
                >
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* لوحة مؤشرات الأداء الإجمالية */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            {/* ساعات العمل (المهام) */}
            <div className="bg-theme-panel rounded-2xl p-4 border border-theme-border shadow-sm flex flex-col justify-between text-right relative overflow-hidden">
              <div className="absolute top-0 right-0 bottom-0 w-1 bg-indigo-500"></div>
              <div className="flex justify-between items-start">
                <p className="text-[10px] text-theme-text-muted font-bold">ساعات العمل (المهام)</p>
                <Clock className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="mt-3">
                <h3 className="text-xl font-black text-theme-text font-mono">
                  {data.personalSummary.totalTaskHours}س
                </h3>
                {formatComparison(data.personalSummary.comparison.hoursDiff, 'س')}
              </div>
            </div>

            {/* المهام المنجزة */}
            <div className="bg-theme-panel rounded-2xl p-4 border border-theme-border shadow-sm flex flex-col justify-between text-right relative overflow-hidden">
              <div className="absolute top-0 right-0 bottom-0 w-1 bg-emerald-500"></div>
              <div className="flex justify-between items-start">
                <p className="text-[10px] text-theme-text-muted font-bold">المهام المنجزة</p>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-3">
                <h3 className="text-xl font-black text-theme-text font-mono">
                  {data.personalSummary.completedTasksCount}
                </h3>
                {formatComparison(data.personalSummary.comparison.tasksDiff, 'مهمة')}
              </div>
            </div>

            {/* ساعات الجرنال */}
            <div className="bg-theme-panel rounded-2xl p-4 border border-theme-border shadow-sm flex flex-col justify-between text-right relative overflow-hidden">
              <div className="absolute top-0 right-0 bottom-0 w-1 bg-purple-500"></div>
              <div className="flex justify-between items-start">
                <p className="text-[10px] text-theme-text-muted font-bold">ساعات الجرنال المسجلة</p>
                <BookOpen className="w-4 h-4 text-purple-400" />
              </div>
              <div className="mt-3">
                <h3 className="text-xl font-black text-theme-text font-mono">
                  {data.personalSummary.totalJournalHours}س
                </h3>
                {formatComparison(data.personalSummary.comparison.journalDiff, 'س')}
              </div>
            </div>

            {/* متوسط تقييم الإنتاجية */}
            <div className="bg-theme-panel rounded-2xl p-4 border border-theme-border shadow-sm flex flex-col justify-between text-right relative overflow-hidden">
              <div className="absolute top-0 right-0 bottom-0 w-1 bg-amber-500"></div>
              <div className="flex justify-between items-start">
                <p className="text-[10px] text-theme-text-muted font-bold">متوسط الإنتاجية اليومية</p>
                <Star className="w-4 h-4 text-amber-500 fill-amber-500/10" />
              </div>
              <div className="mt-3">
                <h3 className="text-xl font-black text-theme-text font-mono flex items-baseline gap-0.5">
                  <span>{data.personalSummary.avgProductivity}</span>
                  <span className="text-[10px] text-theme-text-muted font-bold">/ 5</span>
                </h3>
                <span className="text-[10px] text-theme-text-muted block mt-1 font-bold">أيام التدوين: {data.personalSummary.daysLogged} يوم</span>
              </div>
            </div>

          </div>

          {/* قسم المخططات والتحليل اليومي */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* الجزء الأيمن: مخطط توزيع الوقت الدائري */}
            <div className="lg:col-span-12 bg-theme-panel rounded-3xl p-6 border border-theme-border shadow-sm text-right flex flex-col">
              <div>
                <h3 className="text-sm font-black text-theme-text flex items-center gap-2">
                  <PieChart className="w-4.5 h-4.5 text-theme-accent" />
                  <span>توزيع الوقت على مجموعات المشاريع</span>
                </h3>
                <p className="text-[10px] text-theme-text-muted mt-0.5">تحليل الساعات المخصصة لكل مجموعة عمل هذا الشهر</p>
              </div>

              <div className="mt-8 flex flex-col md:flex-row items-center justify-center gap-12 w-full">
                {/* الدائرة البيانية */}
                <div className="relative w-40 h-40 shrink-0">
                  {totalHoursSum > 0 ? (
                    <svg viewBox="0 0 140 140" className="w-full h-full transform -rotate-90">
                      <circle cx="70" cy="70" r="50" fill="transparent" stroke="var(--theme-border)" strokeWidth="0.5" className="opacity-20" />
                      
                      {(() => {
                        let cumulativePercent = 0
                        return chartData.map((item, idx) => {
                          const pct = item.totalHours / totalHoursSum
                          const strokeDashoffset = 314.16 - (pct * 314.16)
                          const rotation = (cumulativePercent * 360)
                          cumulativePercent += pct

                          const isHovered = hoveredSlice === idx

                          return (
                            <circle
                              key={item.name}
                              cx="70"
                              cy="70"
                              r="50"
                              fill="transparent"
                              stroke={item.color === 'pastel-purple' ? '#a855f7' : item.color === 'pastel-blue' ? '#0ea5e9' : item.color === 'pastel-green' ? '#10b981' : item.color === 'pastel-red' ? '#f43f5e' : item.color === 'pastel-amber' ? '#f59e0b' : 'var(--theme-accent)'}
                              strokeWidth={isHovered ? 14 : 10}
                              strokeDasharray="314.16"
                              strokeDashoffset={strokeDashoffset}
                              transform={`rotate(${rotation - 90} 70 70)`}
                              style={{
                                transition: 'stroke-width 0.2s ease, stroke-dashoffset 0.5s ease',
                                cursor: 'pointer',
                              }}
                              onMouseEnter={() => setHoveredSlice(idx)}
                              onMouseLeave={() => setHoveredSlice(null)}
                            />
                          )
                        })
                      })()}
                      
                      <g transform="rotate(90 70 70)" className="text-center select-none pointer-events-none">
                        {hoveredSlice !== null && chartData[hoveredSlice] ? (
                          <>
                            <text x="70" y="64" textAnchor="middle" className="fill-theme-text text-[8px] font-black">
                              {chartData[hoveredSlice].name}
                            </text>
                            <text x="70" y="78" textAnchor="middle" className="fill-theme-text text-[11px] font-black font-mono">
                              {chartData[hoveredSlice].totalHours} س
                            </text>
                            <text x="70" y="90" textAnchor="middle" className="fill-theme-text-muted text-[7px] font-bold">
                              {((chartData[hoveredSlice].totalHours / totalHoursSum) * 100).toFixed(0)}%
                            </text>
                          </>
                        ) : (
                          <>
                            <text x="70" y="64" textAnchor="middle" className="fill-theme-text-muted text-[8px] font-bold">
                              المجموع
                            </text>
                            <text x="70" y="78" textAnchor="middle" className="fill-theme-text text-[13px] font-black font-mono">
                              {totalHoursSum}س
                            </text>
                            <text x="70" y="90" textAnchor="middle" className="fill-theme-text-muted text-[7px] font-bold">
                              {chartData.length} مجموعة
                            </text>
                          </>
                        )}
                      </g>
                    </svg>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center border-2 border-dashed border-theme-border rounded-full text-[10px] text-theme-text-muted font-bold text-center p-4 leading-normal">
                      لا توجد ساعات عمل مسجلة
                    </div>
                  )}
                </div>

                {/* وسيلة الإيضاح */}
                <div className="w-full md:max-w-md space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                  {chartData.map((item, idx) => {
                    const pct = totalHoursSum > 0 ? (item.totalHours / totalHoursSum) * 100 : 0
                    const isHovered = hoveredSlice === idx

                    return (
                      <div
                        key={item.name}
                        className={`flex items-center justify-between text-[11px] p-2 rounded-xl border transition-all duration-150 ${
                          isHovered 
                            ? 'bg-theme-bg border-theme-accent/30 scale-[1.01]' 
                            : 'bg-transparent border-transparent'
                        }`}
                        onMouseEnter={() => setHoveredSlice(idx)}
                        onMouseLeave={() => setHoveredSlice(null)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color === 'pastel-purple' ? '#a855f7' : item.color === 'pastel-blue' ? '#0ea5e9' : item.color === 'pastel-green' ? '#10b981' : item.color === 'pastel-red' ? '#f43f5e' : item.color === 'pastel-amber' ? '#f59e0b' : 'var(--theme-accent)' }}></span>
                          <span className="font-bold text-theme-text">{item.name}</span>
                        </div>
                        <span className="font-black text-theme-text font-mono text-xs">
                          {item.totalHours}س <span className="text-[9px] font-normal text-theme-text-muted">({pct.toFixed(0)}%)</span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* الجزء الأيسر: النشاط اليومي التفصيلي (تقويم تفاعلي) */}
            <div className="lg:col-span-12 bg-theme-panel rounded-3xl p-6 border border-theme-border shadow-sm text-right space-y-6">
              {/* ترويسة التقويم ومفتاح الألوان */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-theme-border pb-4 w-full" dir="rtl">
                <div>
                  <h2 className="text-sm font-black text-theme-text">
                    تقويم نشاط الشهر للإنتاجية
                  </h2>
                  <p className="text-[10px] text-theme-text-muted mt-0.5">(انقر على أي يوم لعرض تفاصيله)</p>
                </div>
                
                <div className="flex items-center gap-3 text-[10px] font-bold">
                  <div className="flex items-center gap-1 text-theme-text-muted">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                    <span>ساعات العمل</span>
                  </div>
                  <div className="flex items-center gap-1 text-theme-text-muted">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span>المهام المنتجزة</span>
                  </div>
                </div>
              </div>

              {/* حسابات شبكة التقويم */}
              {(() => {
                const daysInMonth = new Date(year, month, 0).getDate()
                const firstDayIndex = new Date(year, month - 1, 1).getDay() // 0 = الأحد، ..., 6 = السبت
                const emptyCells = Array.from({ length: firstDayIndex })
                const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1)
                
                const today = new Date()
                const currentYear = today.getFullYear()
                const currentMonth = today.getMonth() + 1
                const currentDay = today.getDate()

                const weekdays = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
                
                const formatWorkTimeArabic = (minutes: number) => {
                  if (!minutes) return 'لا يوجد'
                  const hours = Math.floor(minutes / 60)
                  const mins = minutes % 60
                  if (hours === 0) return `${mins} دقيقة`
                  if (hours === 1 && mins === 0) return 'ساعة'
                  if (hours === 1 && mins > 0) return `ساعة و ${mins} دقيقة`
                  if (hours === 2 && mins === 0) return 'ساعتين'
                  if (hours === 2 && mins > 0) return `ساعتين و ${mins} دقيقة`
                  if (hours >= 3 && hours <= 10 && mins === 0) return `${hours} ساعات`
                  if (hours > 10 && mins === 0) return `${hours} ساعة`
                  return `${hours}س و ${mins}د`
                }

                const formatTasksCountArabic = (count: number) => {
                  if (count === 1) return 'مهمة واحدة'
                  if (count === 2) return '2 مهام'
                  if (count >= 3 && count <= 10) return `${count} مهام`
                  return `${count} مهمة`
                }

                const moodEmojiMap: Record<string, string> = {
                  energetic: '⚡',
                  stable: '😊',
                  tired: '😫',
                  stressed: '🤯'
                }

                return (
                  <div className="w-full overflow-x-auto pb-2 scrollbar-thin" dir="rtl">
                    <div className="min-w-[650px] lg:min-w-0">
                      {/* أيام الأسبوع */}
                      <div className="grid grid-cols-7 gap-2 text-center text-[10px] md:text-xs font-bold text-theme-text-muted mb-2">
                        {weekdays.map(dName => (
                          <div key={dName} className="py-1">
                            {dName}
                          </div>
                        ))}
                      </div>

                      {/* شبكة الأيام */}
                      <div className="grid grid-cols-7 gap-2">
                        {/* المربعات الفارغة لبداية الشهر */}
                        {emptyCells.map((_, idx) => (
                          <div 
                            key={`empty-${idx}`} 
                            className="bg-transparent border border-transparent rounded-2xl h-24 sm:h-28 md:h-32 opacity-0 pointer-events-none"
                          />
                        ))}

                        {/* أيام الشهر الفعالة */}
                        {daysArray.map(d => {
                          const isFuture = year > currentYear || 
                            (year === currentYear && month > currentMonth) || 
                            (year === currentYear && month === currentMonth && d > currentDay)
                            
                          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                          const dayItem = data.dailyBreakdown.find(item => item.date === dateStr)
                          
                          const hasLogged = dayItem && (
                            dayItem.workMinutes > 0 || 
                            dayItem.journalMinutes > 0 || 
                            dayItem.tasksCount > 0 || 
                            dayItem.productivityScore > 0 || 
                            (dayItem.mood && dayItem.mood !== '')
                          )
                          
                          let cellClasses = ""
                          let contentColorClasses = ""
                          let numberColorClass = ""
                          
                          if (isFuture) {
                            cellClasses = "bg-theme-panel/20 border border-theme-border/30 opacity-40 cursor-default"
                            numberColorClass = "text-theme-text-muted/40"
                          } else if (!hasLogged) {
                            cellClasses = "bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/10 transition-all cursor-pointer shadow-2xs hover:scale-[1.02]"
                            numberColorClass = "text-rose-500 dark:text-rose-400"
                          } else {
                            const mins = dayItem?.workMinutes || 0
                            if (mins === 0) {
                              cellClasses = "bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/15 hover:bg-emerald-500/10 transition-all cursor-pointer shadow-2xs hover:scale-[1.02]"
                              contentColorClasses = "text-emerald-600 dark:text-emerald-400"
                              numberColorClass = "text-emerald-600 dark:text-emerald-400"
                            } else if (mins > 0 && mins < 120) {
                              cellClasses = "bg-emerald-500/15 dark:bg-emerald-500/20 border border-emerald-500/25 hover:bg-emerald-500/20 transition-all cursor-pointer shadow-2xs hover:scale-[1.02]"
                              contentColorClasses = "text-emerald-600 dark:text-emerald-400"
                              numberColorClass = "text-emerald-600 dark:text-emerald-400"
                            } else if (mins >= 120 && mins < 180) {
                              cellClasses = "bg-emerald-500/25 dark:bg-emerald-500/35 border border-emerald-500/40 hover:bg-emerald-500/30 transition-all cursor-pointer shadow-xs hover:scale-[1.02]"
                              contentColorClasses = "text-emerald-700 dark:text-emerald-300"
                              numberColorClass = "text-emerald-700 dark:text-emerald-300"
                            } else {
                              // mins >= 180 (3 ساعات أو أكثر)
                              cellClasses = "bg-emerald-600 dark:bg-emerald-700 border border-emerald-600 dark:border-emerald-700 hover:bg-emerald-550 dark:hover:bg-emerald-650 transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
                              contentColorClasses = "text-white"
                              numberColorClass = "text-white"
                            }
                          }

                          return (
                            <div
                              key={d}
                              onClick={() => !isFuture && handleDayClick(dateStr, dayItem)}
                              className={`rounded-2xl p-2 md:p-3 h-24 sm:h-28 md:h-32 flex flex-col justify-between text-right relative overflow-hidden select-none active:scale-98 ${cellClasses}`}
                            >
                              {/* الصف العلوي: الإيموجي ورقم اليوم */}
                              <div className="flex justify-between items-start w-full">
                                {!isFuture && dayItem?.mood && (
                                  <span className="text-xs md:text-sm">
                                    {moodEmojiMap[dayItem.mood] || dayItem.mood}
                                  </span>
                                )}
                                <span className={`text-[10px] md:text-xs font-black font-mono ${numberColorClass}`}>
                                  {d}
                                </span>
                              </div>
                              
                              {/* الصف السفلي: تفاصيل الساعات والمهام */}
                              {!isFuture && dayItem && hasLogged && (
                                <div className={`flex flex-col items-center justify-end gap-0.5 mt-auto text-[9px] md:text-[10px] font-bold ${contentColorClasses}`}>
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" />
                                    <span className="whitespace-nowrap">{formatWorkTimeArabic(dayItem.workMinutes)}</span>
                                  </div>
                                  {dayItem.tasksCount > 0 && (
                                    <div className="flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" />
                                      <span className="whitespace-nowrap">{formatTasksCountArabic(dayItem.tasksCount)}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>

          </div>

        </div>
      </main>

      {/* نافذة التفاصيل المنبثقة (Modal) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-opacity duration-200">
          <div 
            className="bg-theme-panel border border-theme-border rounded-3xl w-full max-w-lg shadow-xl relative overflow-hidden animate-modal-in flex flex-col max-h-[90vh] text-right"
            dir="rtl"
          >
            {/* خط جمالي علوي */}
            <div className="h-1.5 w-full bg-gradient-to-l from-theme-accent to-indigo-500 shrink-0"></div>

            {/* ترويسة المودال */}
            <div className="flex items-center justify-between p-5 border-b border-theme-border shrink-0">
              <div>
                <h3 className="text-base font-black text-theme-text">
                  تفاصيل يوم {selectedDayDate}
                </h3>
                <p className="text-[10px] text-theme-text-muted mt-0.5">تفاصيل الإنتاجية والجرنال اليومي</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-theme-bg text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* محتوى المودال */}
            <div className="p-6 overflow-y-auto space-y-6 flex-grow scrollbar-hide">
              {isLoadingDetails ? (
                <div className="flex flex-col items-center justify-center py-12 text-theme-text-muted">
                  <Loader2 className="w-8 h-8 animate-spin text-theme-accent mb-2" />
                  <span className="text-xs">جاري تحميل التفاصيل...</span>
                </div>
              ) : selectedDayDetails ? (
                /* يومية مسجلة بالفعل */
                <div className="space-y-6">
                  {/* النجوم والمؤشرات السريعة */}
                  <div className="flex flex-wrap gap-2 items-center justify-between bg-theme-bg/30 border border-theme-border/40 rounded-2xl p-4">
                    <div className="flex items-center gap-0.5 text-amber-500">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < selectedDayDetails.productivity_score 
                              ? 'fill-amber-500 text-amber-500' 
                              : 'text-theme-text-muted opacity-30'
                          }`}
                        />
                      ))}
                    </div>

                    <div className="flex gap-2">
                      {selectedDayWorkMinutes > 0 && (
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          ⏱️ {Math.floor(selectedDayWorkMinutes / 60)}س {selectedDayWorkMinutes % 60}د
                        </span>
                      )}
                      {selectedDayTasksCount > 0 && (
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          ✅ {selectedDayTasksCount === 1 ? 'مهمة واحدة' : selectedDayTasksCount === 2 ? '2 مهام' : `${selectedDayTasksCount} مهام`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* شارات الحالة */}
                  <div className="flex flex-wrap gap-2">
                    {selectedDayDetails.mood && (
                      <span className="text-[10px] font-bold px-3 py-1.5 rounded-xl border bg-indigo-500/5 text-indigo-400 border-indigo-500/20">
                        المزاج: {selectedDayDetails.mood === 'energetic' ? 'طاقة عالية 🚀' : selectedDayDetails.mood === 'stable' ? 'مستقر 😊' : selectedDayDetails.mood === 'tired' ? 'متعب 🥱' : 'مضغوط 🤯'}
                      </span>
                    )}
                    {selectedDayDetails.progress_rate && (
                      <span className="text-[10px] font-bold px-3 py-1.5 rounded-xl border bg-emerald-500/5 text-emerald-400 border-emerald-500/20">
                        الوتيرة: {selectedDayDetails.progress_rate === 'all' ? 'أنجزت كل المخطط 💯' : selectedDayDetails.progress_rate === 'most' ? 'أنجزت معظم المخطط 🔄' : selectedDayDetails.progress_rate === 'half' ? 'أنجزت نصف المخطط ⏳' : 'واجهت صعوبات ⚠️'}
                      </span>
                    )}
                    {selectedDayDetails.milestone && (
                      <span className="text-[10px] font-bold px-3 py-1.5 rounded-xl bg-theme-accent/10 text-theme-accent border border-theme-accent/20">
                        🎯 المحطة: {selectedDayDetails.milestone.title}
                      </span>
                    )}
                  </div>

                  {/* الإنجاز اليومي */}
                  <div className="bg-theme-bg/30 border border-theme-border/40 rounded-2xl p-4 space-y-2">
                    <h4 className="text-xs font-black text-theme-accent">✍️ ماذا أنجزت اليوم؟</h4>
                    <p className="text-xs text-theme-text leading-relaxed whitespace-pre-line font-medium">
                      {selectedDayDetails.today_tasks}
                    </p>
                  </div>

                  {/* خطة الغد */}
                  <div className="bg-theme-bg/30 border border-theme-border/40 rounded-2xl p-4 space-y-2">
                    <h4 className="text-xs font-black text-theme-accent-hover">🎯 خطة الغد والخطوات القادمة</h4>
                    <p className="text-xs text-theme-text leading-relaxed whitespace-pre-line font-medium">
                      {selectedDayDetails.tomorrow_tasks}
                    </p>
                  </div>

                  {/* العقبات والملاحظات */}
                  {selectedDayDetails.blockers?.trim() && (
                    <div className="bg-rose-500/[0.03] border border-rose-500/20 rounded-2xl p-4 space-y-2">
                      <h4 className="text-xs font-black text-rose-500">⚠️ عقبات وملاحظات</h4>
                      <p className="text-xs text-rose-600 dark:text-rose-450 leading-relaxed whitespace-pre-line font-medium">
                        {selectedDayDetails.blockers}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* لا توجد يومية مسجلة */
                <div className="space-y-4 py-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  {selectedDayWorkMinutes === 0 && selectedDayTasksCount === 0 ? (
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-theme-text">لا توجد مساهمات في هذا اليوم</h4>
                      <p className="text-xs text-theme-text-muted leading-relaxed">
                        لم يتم تسجيل أي ساعات عمل أو مهام منجزة في هذا التاريخ.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-theme-text">لم تقم بتسجيل يومياتك لهذا اليوم</h4>
                      <p className="text-xs text-theme-text-muted leading-relaxed">
                        الجرنال اليومي يساعدك على تتبع وتوثيق إنجازاتك المزاجية والإنتاجية.
                      </p>
                    </div>
                  )}

                  {/* عرض النشاط التلقائي من المهام */}
                  {(selectedDayWorkMinutes > 0 || selectedDayTasksCount > 0) && (
                    <div className="bg-theme-bg/30 border border-theme-border/40 rounded-2xl p-4 text-right space-y-2 max-w-sm mx-auto">
                      <h5 className="text-[10px] font-bold text-theme-text-muted">النشاط المسجل تلقائياً من المهام:</h5>
                      <div className="flex flex-col gap-1 text-xs">
                        {selectedDayWorkMinutes > 0 && (
                          <div className="flex items-center gap-1.5 text-theme-text">
                            <Clock className="w-3.5 h-3.5 text-indigo-400" />
                            <span>وقت العمل: <strong>{Math.floor(selectedDayWorkMinutes / 60)}س {selectedDayWorkMinutes % 60}د</strong></span>
                          </div>
                        )}
                        {selectedDayTasksCount > 0 && (
                          <div className="flex items-center gap-1.5 text-theme-text">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>المهام المنجزة: <strong>{selectedDayTasksCount === 1 ? 'مهمة واحدة' : selectedDayTasksCount === 2 ? '2 مهام' : `${selectedDayTasksCount} مهام`}</strong></span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      window.location.href = `/standup?date=${selectedDayDate}`
                    }}
                    className="w-full bg-theme-accent hover:bg-theme-accent-hover text-theme-panel font-bold py-3.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-98 mt-2"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>كتابة الجرنال اليومي الآن</span>
                  </button>
                </div>
              )}
            </div>

            {/* كعب المودال */}
            <div className="p-4 border-t border-theme-border bg-theme-bg/25 flex justify-end shrink-0">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-theme-panel hover:bg-theme-bg text-theme-text border border-theme-border font-bold rounded-xl text-xs transition-all cursor-pointer active:scale-95"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* توست التنبيهات */}
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
    </div>
  )
}
