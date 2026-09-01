'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Play, Pause, RotateCcw, X, Minimize2, Timer } from 'lucide-react'

export default function ChronoWidget() {
  const pathname = usePathname()
  const [displayMode, setDisplayMode] = useState<'closed' | 'open' | 'minimized'>('closed')
  const [time, setTime] = useState<number>(0)
  const [isRunning, setIsRunning] = useState<boolean>(false)

  // إخفاء العداد في صفحة تسجيل الدخول
  if (pathname === '/login') return null

  // دالة لمزامنة حالة المؤقت من localStorage
  const syncState = () => {
    try {
      const running = localStorage.getItem('chrono_is_running') === 'true'
      const mode = (localStorage.getItem('chrono_display_mode') || 'closed') as 'closed' | 'open' | 'minimized'
      
      if (running) {
        const startTime = parseInt(localStorage.getItem('chrono_start_time') || '0', 10)
        const elapsedBefore = parseInt(localStorage.getItem('chrono_elapsed_before') || '0', 10)
        
        if (startTime > 0) {
          const currentElapsed = Math.floor((Date.now() - startTime) / 1000) + elapsedBefore
          setTime(currentElapsed)
          setIsRunning(true)
          setDisplayMode(prev => prev === 'closed' ? 'minimized' : prev)
        }
      } else {
        const elapsed = parseInt(localStorage.getItem('chrono_elapsed') || '0', 10)
        setTime(elapsed)
        setIsRunning(false)
        // لا تغير وضع العرض تلقائياً عند الإيقاف المؤقت
      }
    } catch (e) {
      console.error('[ChronoWidget] Sync state error:', e)
    }
  }

  // تحميل ومراقبة حالة المؤقت
  useEffect(() => {
    syncState()

    // الاستماع لأي تغييرات تحدث في صفحة /timer أو تابات أخرى
    window.addEventListener('chrono-state-changed', syncState)
    window.addEventListener('storage', syncState)

    // قراءة وضع العرض المخزن عند أول تحميل
    try {
      const mode = localStorage.getItem('chrono_display_mode') as 'closed' | 'open' | 'minimized'
      if (mode) setDisplayMode(mode)
    } catch (e) {}

    return () => {
      window.removeEventListener('chrono-state-changed', syncState)
      window.removeEventListener('storage', syncState)
    }
  }, [])

  // الحفاظ على تشغيل العداد وتحديثه في الخلفية
  useEffect(() => {
    let intervalId: any = null

    if (isRunning) {
      intervalId = setInterval(() => {
        try {
          const startTime = parseInt(localStorage.getItem('chrono_start_time') || '0', 10)
          const elapsedBefore = parseInt(localStorage.getItem('chrono_elapsed_before') || '0', 10)
          if (startTime > 0) {
            const currentElapsed = Math.floor((Date.now() - startTime) / 1000) + elapsedBefore
            setTime(currentElapsed)
          }
        } catch (e) {}
      }, 250)
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [isRunning])

  // إرسال حدث مخصص للمزامنة اللحظية مع تابات و صفحات أخرى
  const dispatchStateChange = () => {
    window.dispatchEvent(new CustomEvent('chrono-state-changed'))
  }

  // حفظ حالة وضع العرض عند تغييره
  const changeDisplayMode = (newMode: 'closed' | 'open' | 'minimized') => {
    setDisplayMode(newMode)
    try {
      localStorage.setItem('chrono_display_mode', newMode)
    } catch (e) {}
  }

  // بدء المؤقت
  const handleStart = () => {
    setIsRunning(true)
    const now = Date.now()
    try {
      localStorage.setItem('chrono_is_running', 'true')
      localStorage.setItem('chrono_start_time', now.toString())
      localStorage.setItem('chrono_elapsed_before', time.toString())
    } catch (e) {}
    dispatchStateChange()
  }

  // إيقاف مؤقت
  const handlePause = () => {
    setIsRunning(false)
    try {
      localStorage.setItem('chrono_is_running', 'false')
      localStorage.setItem('chrono_elapsed', time.toString())
    } catch (e) {}
    dispatchStateChange()
  }

  // تصفير العداد
  const handleReset = () => {
    setIsRunning(false)
    setTime(0)
    try {
      localStorage.setItem('chrono_is_running', 'false')
      localStorage.setItem('chrono_elapsed', '0')
      localStorage.setItem('chrono_start_time', '0')
      localStorage.setItem('chrono_elapsed_before', '0')
    } catch (e) {}
    dispatchStateChange()
  }

  // تنسيق الوقت المكتوب (ساعات:دقائق:ثواني)
  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600)
    const mins = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // تنسيق وقت مصغر (دقائق:ثواني أو ساعات:دقائق)
  const formatCompactTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600)
    const mins = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60
    if (hrs > 0) {
      return `${hrs}س ${mins}د`
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // حساب طول الدائرة لثانية التحديث (حلقة الدوران)
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - ((time % 60) / 60) * circumference

  if (displayMode === 'closed') {
    return (
      <div className="fixed bottom-24 left-4 md:bottom-6 md:left-6 z-50 animate-modal-in">
        <button
          onClick={() => changeDisplayMode('open')}
          className="w-12 h-12 rounded-full bg-theme-panel hover:bg-theme-bg text-theme-text-muted hover:text-theme-text border border-theme-border shadow-2xl flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95 group relative"
          title="مؤقت العمل المساعد"
        >
          <Timer className="w-5.5 h-5.5 text-theme-accent group-hover:rotate-12 transition-transform" />
          {time > 0 && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-theme-accent rounded-full animate-ping" />
          )}
        </button>
      </div>
    )
  }

  if (displayMode === 'minimized') {
    return (
      <div className="fixed bottom-24 left-4 md:bottom-6 md:left-6 z-50 animate-modal-in">
        <div
          onClick={() => changeDisplayMode('open')}
          className="flex items-center gap-2 bg-theme-accent text-theme-panel font-mono font-bold text-[11px] py-2 px-3.5 rounded-full shadow-2xl cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200 border border-theme-accent-hover/30"
          title="توسيع عداد العمل"
        >
          <Timer className="w-4 h-4 animate-pulse shrink-0" />
          <span>{formatCompactTime(time)}</span>
          {isRunning && (
            <span className="w-1.5 h-1.5 rounded-full bg-theme-panel animate-ping shrink-0" />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-24 left-4 md:bottom-6 md:left-6 z-50 w-64 bg-theme-panel/95 backdrop-blur-md border border-theme-border rounded-3xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.3)] text-right animate-modal-in select-none">
      
      {/* الترويسة وأزرار التحكم بالوضع */}
      <div className="flex items-center justify-between gap-4 border-b border-theme-border/50 pb-2 mb-4">
        <span className="text-[10px] font-bold text-theme-text-muted flex items-center gap-1">
          <Timer className="w-3.5 h-3.5 text-theme-accent animate-pulse" />
          <span>مؤقت الإنتاجية الطائر</span>
        </span>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => changeDisplayMode('minimized')}
            className="p-1 hover:bg-theme-bg rounded-lg text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
            title="تصغير"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => changeDisplayMode('closed')}
            className="p-1 hover:bg-theme-bg rounded-lg text-theme-text-muted hover:text-rose-500 transition-colors cursor-pointer"
            title="إغلاق تماماً"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* حلقة المؤقت الدائرية */}
      <div className="relative w-36 h-36 mx-auto flex items-center justify-center my-4">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="72"
            cy="72"
            r={radius}
            fill="transparent"
            stroke="var(--theme-border)"
            strokeWidth="4"
            className="opacity-45"
          />
          <circle
            cx="72"
            cy="72"
            r={radius}
            fill="transparent"
            stroke="var(--theme-accent)"
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-300"
            style={{
              filter: isRunning ? 'drop-shadow(0 0 3px var(--theme-accent))' : 'none'
            }}
          />
        </svg>
        
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-mono text-lg font-black text-theme-text tracking-tight">
            {formatTime(time)}
          </span>
          <span className="text-[9px] font-bold text-theme-text-muted mt-0.5">
            {isRunning ? 'جاري الحساب...' : 'متوقف مؤقتاً'}
          </span>
        </div>
      </div>

      {/* أزرار التحكم بالعداد */}
      <div className="flex flex-col gap-2 pt-2">
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={handleReset}
            className="flex-1 bg-theme-bg hover:bg-theme-border border border-theme-border text-theme-text-muted hover:text-theme-text font-bold py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            title="إعادة تعيين العداد"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>تصفير</span>
          </button>

          {isRunning ? (
            <button
              onClick={handlePause}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-lg shadow-amber-500/10"
              title="إيقاف مؤقت"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>إيقاف</span>
            </button>
          ) : (
            <button
              onClick={handleStart}
              className="flex-1 bg-theme-accent hover:bg-theme-accent-hover text-theme-panel font-bold py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-lg shadow-theme-accent/15"
              title="بدء الحساب"
            >
              <Play className="w-3.5 h-3.5" />
              <span>بدء</span>
            </button>
          )}
        </div>

        {time > 0 && (
          <button
            onClick={() => {
              window.location.href = '/timer?save=true'
            }}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-md shadow-indigo-500/10 mt-1"
          >
            <span>📥 تسجيل الوقت على مهمة</span>
          </button>
        )}
      </div>

    </div>
  )
}
