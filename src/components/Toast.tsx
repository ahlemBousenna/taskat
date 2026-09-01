'use client'

import { useEffect } from 'react'
import { CheckCircle2, AlertTriangle, X } from 'lucide-react'

interface ToastProps {
  message: string
  type?: 'success' | 'warning' | 'error'
  onClose: () => void
  duration?: number
}

export default function Toast({ message, type = 'success', onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, duration)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  const typeStyles = {
    success: 'bg-emerald-50 border-emerald-100 text-emerald-800',
    warning: 'bg-amber-50 border-amber-100 text-amber-800',
    error: 'bg-rose-50 border-rose-100 text-rose-800',
  }

  const icon = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    error: <AlertTriangle className="w-5 h-5 text-rose-500" />,
  }

  return (
    <div className="animate-toast-in fixed bottom-24 right-4 sm:bottom-6 sm:right-6 max-w-sm w-full bg-white border border-gray-100 rounded-2xl p-4 shadow-xl z-50 flex items-center justify-between gap-3 text-right">
      <div className="flex items-center gap-3 flex-1">
        <div className={`p-2 rounded-xl shrink-0 ${typeStyles[type]}`}>
          {icon[type]}
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold text-gray-900">{message}</p>
        </div>
      </div>
      <button 
        onClick={onClose}
        className="p-1 hover:bg-gray-100 text-gray-400 hover:text-black rounded-lg transition-colors cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
